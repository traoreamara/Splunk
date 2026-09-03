# Deploying SC4S for WALLIX Bastion — Docker CE

A working SC4S deployment that lands Bastion events on `sourcetype = wallix:bastion`
in `index = wallix_bastion`, ready for `TA-wallix-bastion`.

This runbook uses **Docker CE**. SC4S is runtime-agnostic and its documentation
supports several; if you would rather run the other common one, use
[`SC4S-DEPLOYMENT-podman.md`](SC4S-DEPLOYMENT-podman.md) — the SC4S configuration is identical, only the unit
file differs.

```
  WALLIX Bastion                SC4S host                    Splunk indexers
  ───────────────               ─────────                    ───────────────
  System >                      Docker container              HEC :8088
  SIEM Integration  ──TCP 2242──▶  syslog-ng     ──HTTPS──▶   (on the indexers,
  (syslog out)                     + parsers                   not on a HF)
                                   + disk buffer
```

Three things decide whether this works, and all three are easy to get wrong:

1. **HEC must be on the indexers.** SC4S documentation is explicit: *"SC4S traffic
   must be sent to HEC endpoints that are configured directly on the indexers."*
   Not a heavy forwarder, not a search head.
2. **Give WALLIX its own listening port.** SC4S's built-in Bastion filter is
   `host('^wasb')`. If your appliances are named anything else it never fires
   and everything lands as generic `nix` data. A dedicated port bypasses the
   hostname test entirely. The variable follows SC4S's documented convention,
   `SC4S_LISTEN_{VENDOR}_{PRODUCT}_{PROTOCOL}_PORT`, with the vendor and
   product the WALLIX parser itself declares - `vendor('wallix')`,
   `product('bastion')`. The WALLIX source page does not spell the variable out,
   so confirm it took effect rather than assuming: section 4 does that with
   `ss -lntp`.
3. **Override the sourcetype and the index.** Left alone, SC4S's Bastion
   source writes to `index = main`, and not as `wallix:bastion`: its own
   documentation gives `infraops` in the metadata table while the prose names
   `WB:syslog` for `rdpproxy` traffic with everything else "treated as nix".
   Whichever you get, the seven-way sourcetype split and the CIM mapping that
   hangs off it never run.

---

## 1. On the Splunk side

### Create the index

On Splunk Cloud, **Settings > Indexes > New Index**. On Splunk Enterprise,
`indexes.conf` on the indexers:

```ini
[wallix_bastion]
homePath   = $SPLUNK_DB/wallix_bastion/db
coldPath   = $SPLUNK_DB/wallix_bastion/colddb
thawedPath = $SPLUNK_DB/wallix_bastion/thaweddb
```

### Know where SC4S writes, before you build the token

SC4S sends to three destinations, not one:

| What | Sourcetype | Index |
|---|---|---|
| Your Bastion events | `wallix:bastion` | `wallix_bastion` |
| SC4S's own log | `sc4s:events` | `main` |
| SC4S's operational metrics *(optional)* | `sc4s:metrics` | `_metrics` |

The metrics feed is opt-in, and `_metrics` almost certainly already exists:
Splunk ships it as an internal metrics index, the metrics analog of
`_internal`. Check before creating anything - `datatype=all` matters, the
endpoint lists event indexes only without it:

```spl
| rest /services/data/indexes datatype=all
| search title="_metrics" | table title, datatype
```

One row back, `datatype = metric`: nothing to do, skip to the token. If the row
is absent, create it, keeping `datatype = metric` - SC4S's metrics feed is
rejected by an events index.

```ini
[_metrics]
datatype   = metric
homePath   = $SPLUNK_DB/_metrics/db
coldPath   = $SPLUNK_DB/_metrics/colddb
thawedPath = $SPLUNK_DB/_metrics/thaweddb
```

### Enable HEC on every indexer

**Settings → Data inputs → HTTP Event Collector → Global Settings**: enabled,
port 8088, and leave *SSL* on.

Then create one token:

| Setting | Value |
|---|---|
| Name | `sc4s` |
| Source type | leave as Automatic — SC4S sets it per event |
| **Selected indexes** | **leave blank** |
| Default index | `wallix_bastion` |
| Indexer acknowledgement | off, unless you deliberately want it |

Leaving *Selected indexes* blank is SC4S's own instruction: *"an attempt to
send data to an index that is not in this list results in a `400` error from
the HEC endpoint"*. HEC rejects the whole batch, so a list missing one of the
three indexes above loses the good events with it.

Same token value on every indexer — push it through your cluster's app, not by
hand on each one.

### If you have several indexers

Point SC4S at all of them, comma separated. Splunk's own guidance is to put HEC
behind a load balancer (VIP, HTTPS round robin) so the SC4S config does not need
touching every time the indexer tier changes.

---

## 2. On the SC4S host

A small Linux VM in the same VLAN as the Bastion. SC4S documentation is blunt
about the network path: *"Avoid crossing a Wireless network, WAN, Firewall, Load
Balancer, or inline IDS."*

### Why Docker CE

Docker is the right choice when your organisation already standardises on it —
an image pipeline, a scanning gate, an ops team that runs `docker` everywhere
else. Familiarity beats theoretical purity for a service your on-call has to
restart at 3am.

### One thing to be clear about

Docker runs a persistent daemon as root, and membership of the `docker` group is
root-equivalent on the host — anyone in it can mount the host filesystem into a
container. On a collector that terminates privileged-access audit traffic, keep
that group empty and drive the service through systemd only.

### Install and create the layout

Install Docker CE from Docker's own repository for your distribution, then:

```bash
sudo systemctl enable --now docker
```

```bash
sudo docker volume create splunk-sc4s-var
sudo mkdir -p /opt/sc4s/local/context /opt/sc4s/archive /opt/sc4s/tls
```

### The systemd unit

Create the file `/lib/systemd/system/sc4s.service`. Paste this **entire block**,
from `sudo tee` down to and including the final `EOF`, into a shell on the SC4S
host:

```bash
sudo tee /lib/systemd/system/sc4s.service > /dev/null <<'EOF'
[Unit]
Description=SC4S Container
Wants=NetworkManager.service network-online.target docker.service
After=NetworkManager.service network-online.target docker.service
Requires=docker.service

[Install]
WantedBy=multi-user.target

[Service]
Environment="SC4S_IMAGE=ghcr.io/splunk/splunk-connect-for-syslog/container3:latest"
Environment="SC4S_PERSIST_MOUNT=splunk-sc4s-var:/var/lib/syslog-ng"
Environment="SC4S_LOCAL_MOUNT=/opt/sc4s/local:/etc/syslog-ng/conf.d/local:z"
Environment="SC4S_ARCHIVE_MOUNT=/opt/sc4s/archive:/var/lib/syslog-ng/archive:z"
Environment="SC4S_TLS_MOUNT=/opt/sc4s/tls:/etc/syslog-ng/tls:z"

TimeoutStartSec=0

ExecStartPre=/usr/bin/docker pull $SC4S_IMAGE
ExecStartPre=/usr/bin/bash -c "/usr/bin/systemctl set-environment SC4SHOST=$(hostname -s)"
ExecStartPre=/usr/bin/bash -c "/usr/bin/docker rm SC4S > /dev/null 2>&1 || true"
ExecStart=/usr/bin/docker run \
        -e "SC4S_CONTAINER_HOST=${SC4SHOST}" \
        -v "$SC4S_PERSIST_MOUNT" \
        -v "$SC4S_LOCAL_MOUNT" \
        -v "$SC4S_ARCHIVE_MOUNT" \
        -v "$SC4S_TLS_MOUNT" \
        --env-file=/opt/sc4s/env_file \
        --health-cmd="/usr/sbin/syslog-ng-ctl healthcheck --timeout 5" \
        --health-interval=2m --health-retries=6 --health-timeout=5s \
        --network host \
        --name SC4S \
        --rm $SC4S_IMAGE

Restart=on-failure
EOF
```

Nothing in this file needs editing. The HEC URL, the token and the WALLIX port
go in `/opt/sc4s/env_file`, next.

Before production, pin the image tag to a release instead of `latest`, and
comment out the `docker pull` line. That `ExecStartPre` runs on every start and
contacts ghcr.io to compare digests even when the image is already local, which
adds a minute or so to each restart. Upgrades then become deliberate:
`docker pull`, edit the tag, `systemctl restart sc4s`.

### The environment file

This is the file you actually customise. Create it the same way, then replace
the three placeholder values — the indexer hostnames, the HEC token, and the
port if you are not using 2242:

```bash
sudo tee /opt/sc4s/env_file > /dev/null <<'EOF'
# ---- destination: HEC on the indexers, comma separated ----
SC4S_DEST_SPLUNK_HEC_DEFAULT_URL=https://idx1.corp.example:8088,https://idx2.corp.example:8088,https://idx3.corp.example:8088
SC4S_DEST_SPLUNK_HEC_DEFAULT_TOKEN=00000000-0000-0000-0000-000000000000

# Leave TLS verification on. Uncomment only for a lab with a self-signed cert.
#SC4S_DEST_SPLUNK_HEC_DEFAULT_TLS_VERIFY=no

# 10 is the default; raise it only if the destination is the bottleneck.
#SC4S_DEST_SPLUNK_HEC_DEFAULT_WORKERS=10

# ---- WALLIX Bastion on its own port ----
# This is what makes the vendor assignment deterministic. Without it SC4S falls
# back to its message filter, which matches host('^wasb') and will miss your
# appliances unless they happen to be named that way.
SC4S_LISTEN_WALLIX_BASTION_TCP_PORT=2242
EOF
```

```bash
sudo chmod 600 /opt/sc4s/env_file
```

That file holds the HEC token, so it should not be world-readable.

Check the URL you just wrote, by reading it back out of the file rather than
retyping it:

```bash
curl -k "$(grep -oP '(?<=SC4S_DEST_SPLUNK_HEC_DEFAULT_URL=)[^,]+' /opt/sc4s/env_file)/services/collector/health"
```

Expected: `{"text":"HEC is healthy","code":17}`. A typo in the address fails
here in a second, instead of costing a 130-second curl timeout on every start.

### Route it to the right index and sourcetype

Create `/opt/sc4s/local/context/splunk_metadata.csv` — three columns, no header:
key, metadata, value.

```bash
sudo tee /opt/sc4s/local/context/splunk_metadata.csv > /dev/null <<'EOF'
wallix_bastion,index,wallix_bastion
wallix_bastion,sourcetype,wallix:bastion
EOF
```

Without the second line your data arrives as `WB:syslog`, the legacy sourcetype.
The add-on parses it, but the index-time sourcetype routing and most of the CIM
mapping never run.

### Start it

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sc4s
sudo systemctl status sc4s --no-pager -l
```

The first start pulls the image, which can take several minutes. The container
does not exist until that finishes, so `docker logs` reports
`No such container: SC4S` in the meantime. Wait for it to appear:

```bash
sudo docker ps --filter name=SC4S
```

If the unit is `failed` rather than `active (running)`:

```bash
sudo journalctl -u sc4s -n 50 --no-pager
```

Once the container is up:

```bash
sudo docker logs -f SC4S
ss -lntp | grep 2242
```

Open the port on the host firewall:

```bash
sudo firewall-cmd --permanent --add-port=2242/tcp && sudo firewall-cmd --reload
```

---

## 3. On the Bastion

**System → SIEM Integration**: add the SC4S host address, port **2242**, protocol
**TCP**. Pick either syslog format — the add-on handles both.

TCP matters here: RDP clipboard and process events routinely exceed 1400 bytes,
and UDP will truncate or drop them in a way that looks exactly like a parsing bug.

---

## 4. Verify, in order

Each step isolates one hop. Do them in sequence — the first failure tells you
where the problem is.

**SC4S is alive and talking to Splunk**

```spl
index=main sourcetype=sc4s:events | stats count by host
```

Any rows at all mean SC4S reached HEC and was accepted - its own log took the
same path your Bastion events will.

**Events are arriving at all**

```spl
index=wallix_bastion | stats count by sourcetype, host
```

**The dedicated port was honoured** — the one check that settles it. If SC4S
is listening on 2242, it accepted the variable; the container environment only
tells you the variable was set, which is not the same thing:

```bash
sudo docker exec SC4S env | grep WALLIX     # the variable reached the container
ss -lntp | grep 2242                       # SC4S actually opened the port
```

No listener on 2242 means the name was not recognised. Fall back to naming your
appliances `wasb*` so the built-in filter matches, and raise it with SC4S.

**The add-on routed them**

```spl
index=wallix_bastion | stats count by sourcetype
```

| Result | Meaning |
|---|---|
| seven `wallix:bastion:*` sourcetypes | SC4S and the add-on are both in place |
| `wallix:bastion` only | SC4S is fine. The add-on is missing from the **indexers** — with SC4S they are the parsing tier, so that is where `transforms.conf` must live |
| `WB:syslog`, `infraops` or `nix` | The `sourcetype` line in `splunk_metadata.csv` did not apply - which of the three you get depends on SC4S's own defaults for this source |
| `nix` or generic syslog | `SC4S_LISTEN_WALLIX_BASTION_TCP_PORT` is not set, so SC4S fell back to its `host('^wasb')` filter |
| nothing in `wallix_bastion` | The `index` line in `splunk_metadata.csv` did not apply |

**Fields and CIM**

```spl
index=wallix_bastion sourcetype=wallix:bastion:session
| table _time, user, src, dest, wallix_service, wallix_type, action | head 20
```

```spl
| datamodel Authentication Authentication search
| search Authentication.authentication_service="wallix:bastion" | stats count
```

`vendor_product` is not a field of the CIM Authentication model - searching it
here returns nothing however well the data is mapped. `authentication_service`
is the handle on WALLIX events. Change, Network Traffic and Endpoint do carry
`vendor_product`.

**Inject test traffic without touching the Bastion**

```bash
python3 tools/wallix_syslog_simulator.py --backfill 2h --sessions 50 \
    --all-scenarios --to tcp:sc4s.corp.example:2242
```

That exercises the whole chain — SC4S parsing, HEC transport, TA routing, CIM —
with events you control. See `TESTING.md`.


---

## 5. When it does not work

| Symptom | Cause |
|---|---|
| `SSL: certificate subject name 'SplunkServerDefaultCert' does not match target hostname` | Splunk is still serving its default self-signed certificate. Lab: uncomment `SC4S_DEST_SPLUNK_HEC_DEFAULT_TLS_VERIFY=no`. Production: issue a certificate whose SAN covers the address SC4S dials, mount your CA under `/opt/sc4s/tls`, and leave verification on. |
| Every restart hangs for ~130 s, then `SC4S_ENV_CHECK_HEC` in the journal | The HEC address in `env_file` is unreachable and SC4S waits out the curl timeout. Read the address back out of the file with the `curl` above rather than trusting what you typed. |
| Every `systemctl restart sc4s` takes about a minute | The `ExecStartPre=/usr/bin/docker pull` line contacts ghcr.io on each start. Comment it out and pin the image tag. |
| `docker logs SC4S` says `No such container: SC4S` | On a first start, the image pull is still running — check `systemctl status sc4s` and wait. If the unit is `failed`: `/opt/sc4s/env_file` missing, the `splunk-sc4s-var` volume not created, or the pull blocked from ghcr.io. |
| `SC4S_ENV_CHECK_HEC: Invalid Splunk HEC URL, invalid token, or other HEC connectivity issue` in the container log | The line above it names the address SC4S tried. Check it against `curl -k https://<indexer>:8088/services/collector/health`, which should answer `{"text":"HEC is healthy","code":17}`. SC4S keeps running and buffering rather than exiting, so the container looks healthy while nothing reaches Splunk. |
| Nothing in `index=wallix_bastion` | SC4S cannot reach HEC. `docker logs SC4S` shows the TLS or connection error. Check the token, the port, and that HEC is on the **indexers**. |
| Batches rejected with HTTP 400 in `docker logs SC4S` | The token has a populated *Selected indexes* list and something SC4S sends is not on it — usually `main` or `_metrics`. HEC drops the entire batch, so good events disappear with the bad one. Blank the list. |
| Events land in `main`, not `wallix_bastion` | `splunk_metadata.csv` missing, in the wrong path, or SC4S not restarted after editing it |
| `sourcetype=WB:syslog` | The `sourcetype` line is missing from `splunk_metadata.csv` |
| `sourcetype=nix` or generic syslog | The WALLIX filter never matched. Your Bastions are not named `wasb*` and you have not set `SC4S_LISTEN_WALLIX_BASTION_TCP_PORT` |
| Everything on the bare `wallix:bastion` | The add-on is not on the indexers, or they were not restarted |
| Events truncated or merged | The Bastion is sending UDP. Switch to TCP. |
| Fields present but data models empty | `Splunk_SA_CIM` missing, or the add-on is not on the search heads |

Editing anything under `/opt/sc4s/local/` needs a restart:

```bash
sudo systemctl restart sc4s
```

### TLS against Splunk's default certificate

Splunk ships `SplunkServerDefaultCert`, whose CN matches no real name, so SC4S's
certificate check fails. Two ways out.

**Lab — stop verifying.** The line is already in `env_file`, commented:

```bash
sudo sed -i 's|^#SC4S_DEST_SPLUNK_HEC_DEFAULT_TLS_VERIFY=no|SC4S_DEST_SPLUNK_HEC_DEFAULT_TLS_VERIFY=no|' /opt/sc4s/env_file
grep TLS_VERIFY /opt/sc4s/env_file
sudo systemctl restart sc4s
```

The HEC token then crosses an encrypted but unauthenticated link. Fine between
two VMs on one hypervisor; not fine for privileged-access audit traffic in
production, especially with the token's index list left blank.

**Production — trust your own CA instead.** Issue a Splunk certificate whose SAN
covers the address in `env_file`, then:

```bash
sudo cp your-internal-ca.pem /opt/sc4s/tls/
sudo sed -i 's|^SC4S_DEST_SPLUNK_HEC_DEFAULT_TLS_VERIFY=no|#&|' /opt/sc4s/env_file
sudo systemctl restart sc4s
```

`/opt/sc4s/tls` is already mounted into the container by the unit.

---

## 6. A note on `vendor_product_by_source.conf`

Older SC4S guidance — including some still circulating — tells you to bind a
source IP to a vendor in `vendor_product_by_source.conf`. That mechanism is
**deprecated**. The supported way to make vendor assignment deterministic is the
dedicated listening port used above:

```
SC4S_LISTEN_{VENDOR}_{PRODUCT}_{PROTOCOL}_PORT={PORT}
```

It is also better: it does not depend on the source address, so it survives the
Bastion being re-addressed or moved behind NAT.

---

## Sources

- [SC4S — Getting started](https://splunk.github.io/splunk-connect-for-syslog/main/gettingstarted/)
- [SC4S — Docker CE + systemd](https://splunk.github.io/splunk-connect-for-syslog/main/gettingstarted/docker-systemd-general/)
- [SC4S — Splunk setup](https://splunk.github.io/splunk-connect-for-syslog/main/gettingstarted/getting-started-splunk-setup/)
- [SC4S — Sources and listening ports](https://splunk.github.io/splunk-connect-for-syslog/main/sources/)
- [SC4S — WALLIX Bastion source](https://splunk.github.io/splunk-connect-for-syslog/main/sources/vendor/Wallix/bastion/)
- [Splunk Validated Architectures — Syslog data collection](https://help.splunk.com/en/splunk-enterprise/splunk-validated-architectures/getting-data-in-forwarding-and-preprocessing/syslog-data-collection)

<!-- Generated by tools/build_sc4s_docs.py - edit that file, then run `make docs`. -->
