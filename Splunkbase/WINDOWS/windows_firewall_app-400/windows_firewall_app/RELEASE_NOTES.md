# Release notes

## 4.0.0

### Byte volume: what the source can and cannot report

`pfirewall.log` fills in its `size` column only for packets Windows **drops**; allowed connections
are logged with `-`. Earlier drafts of this release surfaced "Sent" and "Received" tiles and an
outbound-volume ranking built on that column — they could only ever read zero, and the exfiltration
threshold (`mb_out >= 100`) could never fire.

- Traffic Explorer and Host 360 now show a **Dropped volume** tile, the one volume figure the log
  genuinely supplies, alongside an External peers tile in the place the byte tiles used to occupy.
- Threat Hunting ranks outbound activity by **session count and rate per minute** rather than
  megabytes, and the panel is named for what it measures: sustained outbound sessions.
- The README states the limitation plainly and points at NetFlow/IPFIX or Zeek for true byte
  accounting.


**Minimum platform is now Splunk Enterprise / Splunk Cloud 10.4.** Version 3.1.0 stays available on
Splunkbase for 9.x deployments and remains supported — 4.0.0 is the same app rebuilt around what
Dashboard Studio 10.4 makes possible, not a different product.

### The headline: a segmentation map

New **Segmentation Map** dashboard, built on the 10.4 network graph. The firewall log is the
cheapest east-west flow evidence most estates have; this turns it into something you can act on.

- **Host map** — every host and the peers it reached, edge thickness by flow count, force layout.
- **East-west** — Internet traffic removed, so what is left is exactly what a segmentation policy is
  supposed to constrain. Paired with a table of accepted RDP / SMB / WinRM / SSH / database paths.
- **Segments** — addresses grouped by /24, /16 or host, rendered both as a hierarchical graph and as
  a flow matrix punchcard. Every dot is a path that exists today; every empty cell is a boundary
  nothing crossed.
- **Services** — which protocols actually carry the cross-boundary traffic. Usually a much shorter
  list than people expect.
- **Lateral reach scoring** — how many internal hosts each machine reached, against the estate
  average in standard deviations, so an outlier surfaces without a hand-tuned threshold.

### Tabs everywhere they replace scrolling

Eight of the nine dashboards are now tabbed. Nothing was removed; the same panels stopped being a
two-thousand-pixel scroll.

| Dashboard | Tabs |
|---|---|
| Firewall Overview | Summary · Collection health · Geography & changes |
| Traffic Explorer | Flow map · Volume · Breakdown |
| Segmentation Map | Host map · East-west · Segments · Services |
| Host 360 | Activity · Peers & services · Processes · Changes |
| Process Attribution | Process map · Hunting · Outbound & listeners |
| Firewall Changes | Activity · Posture over time · Actors · Full history |
| Threat Hunting | Reconnaissance · Command & control · Exposure · Data movement |
| Firewall Posture | Compliance · Blind spots · Rule inventory |

Peer Pivot and Traffic Investigator stay single-page on purpose: they are drilldown targets, and a
drilldown lands on the first tab.

### More network graphs

Beyond the segmentation map, the graph is used wherever a relationship reads better than a table:

- **Beaconing map** (Threat Hunting) — hosts and the addresses they call back to. One external node
  with many host edges is either your management tooling or your incident.
- **Exposure map** — which public addresses reach which of your hosts.
- **Peer map** (Host 360) and **reach map** (Peer Pivot).
- **Process to service map** (Process Attribution and Host 360).
- **User to host change map** (Firewall Changes) — an account touching many hosts is either your
  automation or your problem.
- **Host to risk map** (Posture) — which machines carry which rule risks.

### Timelines

The 10.2 timeline visualisation, where a lane per category beats a stacked column:

- Firewall Changes: change timeline by outcome, and an enable/disable timeline per host — a red mark
  is a window during which a host was unprotected.
- Host 360: change timeline by category.
- Threat Hunting: scan activity by intensity band.
- Posture: posture drift over time.

### Trellis small multiples

- Overview: blocked ratio as one colour-ranged gauge per host — an outlier is visible without
  reading a table.
- Posture: compliance as a filler gauge per firewall profile. Public is usually the one that drifts.
- Firewall Changes: change count per severity.
- Traffic Explorer: one column chart per verdict.
- Process Attribution: blocked events per binary.

### Conditional sections

Sections that depend on optional data sources now disappear instead of sitting empty. Panels carry
`hideWhenNoData`, and an **Optional sections** input removes their headers too. Affects the process
attribution blocks in Host 360 and Threat Hunting, and the live posture panel in Host 360.

### Smaller 10.x touches

- Row numbers on every investigation table.
- Range-based cell colouring on the columns where a number carries a verdict: beaconing `jitter`,
  outbound `mb_out`, exposure `sources`, lateral `deviation`, segment `flows`.
- Markdown tables in the release-notes-style panels and the documentation view.
- Line chart acceleration applies automatically to the high-density time charts.

### Unchanged from 3.1.0

Every macro, field, eventtype, lookup, saved search, data model and view name is identical. The
collection layer, the CIM mappings, the detections and the companion **TA-windows-firewall-posture**
(still 1.0.0, still Splunk 9.0+, forwarder side) are untouched. Upgrading from 3.1.0 is a package
replacement with no reconfiguration.

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
