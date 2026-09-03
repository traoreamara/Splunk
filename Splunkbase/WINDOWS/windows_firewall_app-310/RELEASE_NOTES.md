# Release notes

## 3.1.0

Three things this release is about: knowing **which binary** opened a connection, making the app
**survive real data volumes**, and answering **"what is the state right now"** rather than only
"what changed while we were watching".

### Added — process attribution

- **Process Attribution view**. Windows Filtering Platform audit events (Security 5152/5156/5157,
  plus 5154/5155/5158/5159 for listeners) carry the full application path that `pfirewall.log` does
  not have. The app normalises them entirely in SPL, through the new `wfo_wfp` macro, so it never
  claims props on the shared `XmlWinEventLog:Security` sourcetype and never conflicts with
  Splunk_TA_windows or your existing Security collection.
- New macros `wfo_wfp_index`, `wfo_wfp_base`, `wfo_wfp` and `wfo_network` (unified pfirewall + WFP).
- Four detections: LOLBin with network activity, rare binary making network connections, new
  listening process, process repeatedly blocked outbound.
- The setup page now takes a second index, because Security events almost never live in the same
  index as the firewall traffic log.

### Added — performance

- **`Windows_Firewall_Observability` data model**, two datasets (Traffic, Changes), 48 fields.
  Acceleration ships **off** — that cost is your decision, not the app's.
- The Overview now runs on `tstats` against that model. It works either way: with
  `summariesonly=false` (the shipped default) it searches raw data exactly as before; set the
  `wfo_summariesonly` macro — or answer "yes" on the setup page — once acceleration is on, and the
  same page reads summaries only.
- New `is_noise` field, computed in props from the fixed non-routable, multicast, broadcast and
  reserved ranges. Unlike the `ip_whitelist` lookup, it is a data model field, so tstats panels can
  filter structural noise. The lookup stays as the tuning layer for your own organisation-specific
  ranges on the raw-search views.

### Added — investigation workflow

- **Host 360**: one machine, everything — peers, services, processes, firewall state, configuration
  history, and its distinct-peer count against its own rolling 24-hour baseline expressed in
  standard deviations.
- **Peer Pivot**: one IP address, everything — how far it reached into the estate, which ports,
  the timing regularity of the exchanges per host, and which processes talked to it.
- Every table across the Overview, Traffic Explorer, Investigator, Threat Hunting and Posture views
  now drills into Host 360 or Peer Pivot instead of dumping you into a raw search, carrying the
  time range along.
- Navigation regrouped into Traffic / Investigate / Configuration collections.

### Added — posture

- **Firewall Posture view** plus the companion **TA-windows-firewall-posture** (separate package,
  forwarder side). Two read-only PowerShell inputs inventory the profile state, default actions,
  logging settings, log file health and the enabled rule set with a risk score.
- This closes the blind spot the event stream cannot: a host whose firewall was already off before
  Splunk arrived produces no change event, and a host with drop logging disabled produces no traffic
  log at all — until now it was indistinguishable from a quiet host.
- Four detections, including **Host Not Logging Dropped Packets**, which is the one that tells you
  an empty dashboard means nothing.

### Notes

- Minimum platform is still Splunk 9.0. Dashboard Studio features that would have helped here —
  network graph, tabs, conditional panel visibility — need 10.x and were deliberately left out.
- Nothing from 3.0.0 was removed. Existing macros, fields and view names are unchanged.

## 3.0.0

Major release. Collection, normalisation, dashboards and detections were all reworked.

### Fixed

- **The setup page had no effect.** It wrote a macro named `windows_pfirewall_index` while every
  search of the app used `windows_firewall_index`. Whatever index you configured was ignored and
  all searches silently ran against `index=*`. Re-run the setup page once after upgrading.
- **Field extraction shifted by one column on some Windows builds.** The positional `DELIMS`
  extraction assumed 18 columns; Windows Server 2016/2019 write 17 (no process id). Replaced by a
  regex extraction whose last group is optional, so both layouts are handled.
- **Data loss after log rotation.** The four header lines of `pfirewall.log` are identical after
  every rotation, so Splunk computed the same CRC and resumed at the previous offset.
  `initCrcLength = 2048` now makes the CRC include real traffic lines.
- **Header lines were indexed as events**, polluting every count. They are now routed to nullQueue.
- Wrong CIM mapping: `protocol` carried the transport value. It now carries the network-layer value
  (`ip` / `ipv6`); `transport` keeps `tcp` / `udp` / `icmp`.
- Profile bitmask decoding only handled Public, Private and None. Domain and the combined values
  (3, 5, 6, 7, 2147483647) are decoded too.
- Typos in the vendor product name ("Windows Defender Firewal").
- The `windows_firewall_event_id` lookup returned up to nine rows for a single EventID, turning
  `Description` into a multivalue field. It is now one row per EventID.

### Added

- **Five Dashboard Studio views**, responsive grid layout, dark theme:
  - *Firewall Overview* — collection health, allowed vs blocked volume, blocked ratio, noisiest
    services, top talkers, firewall state per host, world map of external destinations.
  - *Traffic Explorer* — two-level flow map (host → service → verdict), volume in connections and
    in bytes, services, remote peers, activity punchcard.
  - *Traffic Investigator* — filterable tables with geo enrichment and service resolution.
  - *Firewall Changes* — severity-ranked audit trail, change timeline, authors, firewall state.
  - *Threat Hunting* — port scans, network sweeps, beaconing, Internet exposure, data movement.
- **Sixteen saved searches**: 15 detections (all disabled by default) and 6 reports. Highlights:
  firewall disabled, default inbound action set to allow, service stopped, policy reset, inbound
  allow rule created, rule deleted, policy change burst, port scan, network sweep, excessive denied
  outbound, C2 beaconing, data exfiltration, exposed service, administrative protocol exposed,
  host stopped reporting.
- **Service resolution**: `dest_service` is derived from the destination port and transport through
  a new lookup of 81 common services.
- **Internal / external scoping**: `src_scope` and `dest_scope` let every search separate lateral
  traffic from Internet exposure. The ranges are configurable from the setup page.
- New macros `wfo_traffic`, `wfo_changes` and `wfo_internal_ip(ip)`.
- Severity ranking of configuration events (`severity`), plus `firewall_enabled`,
  `default_inbound_action`, `default_outbound_action` and `setting_name`.
- CIM **Change** data model compliance for the configuration events: `action` now uses the allowed
  set (created / modified / deleted), with `object`, `object_category`, `object_attrs`,
  `object_path` and `result`.
- Optional input stanzas for per-profile log files, the ConnectionSecurity channel and the Windows
  Filtering Platform audit events.
- A rewritten setup page: validation, live feedback, index list and internal ranges, no silent
  failure.
- A rewritten documentation view: installation, GPO and PowerShell activation, field reference,
  tuning and a troubleshooting table.

### Changed

- The generic eventtype `traffic`, which was exported globally, is replaced by
  `windows_firewall_traffic`. The CIM tags are unchanged, so the Network Traffic data model keeps
  populating.
- The 16th column of `pfirewall.log` is named `packet_info` instead of `field16`. `info` still
  holds SEND / RECEIVE.
- `whitelist_ip_ranges.csv` now covers the full multicast and reserved ranges (`224.0.0.0/4`,
  `240.0.0.0/4`) instead of a few /8 subsets.
- Minimum platform is Splunk 9.0.

## 2.0.0

Initial Splunkbase release: data inputs, field extractions, CIM Network Traffic knowledge objects,
sankey and table dashboards, firewall change history.
