================================================================================
 Microsoft Windows Firewall Observability - version 4.0.0
================================================================================

 Collect, parse, normalise and visualise Windows Defender Firewall activity:
 the connection log (pfirewall.log) and the firewall configuration, policy and
 service change events from the Windows Event Log.

 Splunkbase : https://splunkbase.splunk.com/app/7790

--------------------------------------------------------------------------------
 REQUIREMENTS
--------------------------------------------------------------------------------
 * Splunk Enterprise or Splunk Cloud 10.4 or later. The dashboards use
   tabs, network graphs, timelines, trellis layouts and conditional panel
   visibility, all introduced in the 10.x line.
   On Splunk 9.x, install version 3.1.0 instead: identical collection,
   knowledge objects and detections, with flat single-page dashboards.
 * Splunk Add-on for Microsoft Windows 8.9.0 or later, on the same tier, for
   the Windows Event Log field extractions.
 * Windows Defender Firewall logging enabled on the monitored hosts.

 Optional, each unlocking one dashboard - see OPTIONAL DATA SOURCES:
 * Windows Filtering Platform audit events (Security 5152/5157) for the
   Process Attribution view.
 * TA-windows-firewall-posture, the companion add-on, for the Firewall
   Posture view.
 * Data model acceleration, to make the Overview instant on large estates.

--------------------------------------------------------------------------------
 WHERE TO INSTALL IT
--------------------------------------------------------------------------------
 Install the app on every tier that PARSES or SEARCHES the data. Deploy the
 inputs.conf stanzas only where the data is collected.

   Component                      This app        Posture add-on   Inputs on?
   ---------------------------------------------------------------------------
   Universal forwarder (Windows)    inputs only     full add-on       YES
   Heavy forwarder (if any)         yes             yes               no
   Indexer                          yes *           yes *             no
   Search head                      yes             yes               no

   * Not needed on the indexers IF a heavy forwarder sits in front of them.

   "Posture add-on" is TA-windows-firewall-posture, optional - see OPTIONAL
   DATA SOURCES below. Leave that column out entirely if you do not use it.

 Why the indexer matters here, and not only the search head: the app's
 props.conf carries index-time settings - LINE_BREAKER, TIME_FORMAT and
 TRANSFORMS-wfo_drop_headers, which routes the four W3C header lines of
 pfirewall.log to nullQueue. Install the app on the search head alone and
 those header lines keep being indexed as events, polluting every count.

 A universal forwarder does not parse. It only needs the inputs.conf stanzas,
 not the whole app.

   Windows host                     Splunk instance
   +----------------------+         +---------------------------+
   | Universal Forwarder  |  :9997  | Indexer                   |
   |                      |-------->| (also the search head on  |
   | inputs.conf only     |         |  a standalone deployment) |
   | (from default/       |         | full app installed        |
   |  inputs.conf below)  |         |                           |
   +----------------------+         +---------------------------+

--------------------------------------------------------------------------------
 INSTALLATION
--------------------------------------------------------------------------------
 1. Install Splunk Add-on for Microsoft Windows 8.9.0 or later on your search
    heads and indexers - https://splunkbase.splunk.com/app/742

    FIRST, not last. It turns the Windows Event Log XML into fields. Without
    it the traffic dashboards work fine and the Firewall Changes view stays
    empty with no error anywhere, which is a long way to walk backwards.
    Its own inputs all ship disabled, so installing it collects nothing.

 2. Create the destination index on the indexers:

      splunk add index windows_firewall

 3. Install this app on your search heads and indexers (Splunk 10.4 or later).
    On Linux, if you installed as root, fix the ownership:

      chown -R splunk:splunk $SPLUNK_HOME/etc/apps/windows_firewall_app

 4. Open "Configuration" in the app navigation bar and declare the index that
    receives the firewall data. This writes the `windows_firewall_index` macro
    and, optionally, your internal network ranges and the Security index used
    by the Process Attribution view.

 5. Deploy the stanzas of default/inputs.conf to every Windows forwarder that
    must ship firewall data. Adapt the "index" value to your indexing policy,
    then reload or restart the forwarder.

 6. Enable firewall logging on the Windows hosts:

      Set-NetFirewallProfile -All -LogAllowed True -LogBlocked True -LogMaxSizeKilobytes 20480 -LogFileName "%systemroot%\System32\LogFiles\Firewall\pfirewall.log"

    Kept on one line on purpose: backtick continuations do not always survive
    a copy and paste into a console. Run it from an elevated PowerShell.

    or, through the console: Windows + R -> wf.msc -> right-click "Windows
    Defender Firewall with Advanced Security on Local Computer" -> Properties
    -> for each profile tab, Logging -> Customize.

 7. Verify the collection with the saved report
    "Windows Firewall - Data Collection Health".

 8. At this point eight of the nine dashboards are live. Two of them stay
    empty until you add an optional data source:

      Process Attribution   needs Windows Filtering Platform audit events
      Firewall Posture      needs the companion add-on
                            TA-windows-firewall-posture

    Neither is required for the rest of the app to work. See the OPTIONAL
    DATA SOURCES section below.

--------------------------------------------------------------------------------
 UPGRADING FROM 2.x - PLEASE READ
--------------------------------------------------------------------------------
 The setup page of version 2.x wrote a macro named `windows_pfirewall_index`
 while every search of the app used `windows_firewall_index`. The index you
 configured was therefore ignored and all searches ran against index=*.
 This is fixed in 3.0.0: run the setup page once after upgrading.

 Other changes that may affect existing custom searches:
  * The generic eventtype "traffic" is replaced by "windows_firewall_traffic".
  * "protocol" now carries the CIM network-layer value (ip / ipv6). The
    transport protocol stays in "transport" (tcp / udp / icmp).
  * The 16th column of pfirewall.log is now named "packet_info" instead of
    "field16". "info" keeps holding SEND / RECEIVE.
  * The dashboards "Windows Host Traffic (view 2)" and "Windows host traffic"
    are replaced by "Traffic Investigator" and "Traffic Explorer" at the same
    view names.


--------------------------------------------------------------------------------
 OPTIONAL DATA SOURCES
--------------------------------------------------------------------------------
 The app works with the two sources above alone. Three optional additions each
 unlock one view. None of them changes anything if left off.

 1. PROCESS ATTRIBUTION - unlocks the "Process Attribution" view and the
    Processes panels of Host 360 and Peer Pivot.

    On the monitored hosts:
      auditpol /set /subcategory:"Filtering Platform Connection" /failure:enable
      auditpol /set /subcategory:"Filtering Platform Packet Drop" /failure:enable
      # /success:enable adds event 5156 - VERY verbose, enable deliberately

    On the search head, point the `wfo_wfp_index` macro at the index holding
    your Security events (Configuration page, second field). The app reads the
    sourcetype you already use and normalises at search time - nothing to
    re-ingest, no conflict with Splunk Add-on for Microsoft Windows.

 2. FIREWALL POSTURE - unlocks the "Firewall Posture" view.

    Install the companion add-on TA-windows-firewall-posture on BOTH the
    Windows forwarders AND this Splunk instance - it carries its own parsing
    and field extractions. Then ENABLE ITS TWO INPUTS on the forwarders only;
    they ship disabled on purpose.

    The Windows PowerShell execution policy must allow local scripts. A
    "Restricted" policy - the default on client editions - blocks the add-on
    and Splunk's own PowerShell harness. RemoteSigned is the usual minimum.
    See the add-on README.
    Create local/inputs.conf there with:

      [powershell://wfo_firewall_profiles]
      disabled = 0
      index = windows_firewall

      [powershell://wfo_firewall_rules]
      disabled = 0
      index = windows_firewall

    Two read-only PowerShell inputs then inventory the profile state, the
    logging settings and the enabled rules. This is what tells you that a
    silent host is silent because drop logging is off, not because nothing
    happened.

 3. DATA MODEL ACCELERATION - makes the Overview instant on large estates.

    Settings > Data models > Windows Firewall Observability > Edit >
    Edit acceleration. Then set "Data model accelerated" to yes on the
    Configuration page. Until you do, the Overview searches raw data and works
    exactly as before.


--------------------------------------------------------------------------------
 WHAT THE FIREWALL LOG CANNOT TELL YOU
--------------------------------------------------------------------------------
 One limitation is worth knowing before you look for it.

 pfirewall.log carries a "size" column, but Windows fills it in only for packets
 it DROPS. Allowed connections are logged with size "-". There is therefore no
 byte volume for permitted traffic anywhere in this data source, on any host,
 no matter how the firewall is configured.

 The app reflects that honestly rather than showing zeros:

   - "Dropped volume" tiles report the bytes of denied packets. That is the only
     volume the log can supply, and it is genuinely useful - a spike means
     something is being denied repeatedly and loudly.
   - Threat Hunting ranks outbound activity by SESSION COUNT and rate per
     minute, not by megabytes. A steady, high-rate path to a single external
     address is the shape worth explaining; the log simply cannot weigh it in
     bytes.

 If you need true byte accounting, the sources that carry it are NetFlow / IPFIX
 or Zeek. This app deliberately does not pretend to substitute for them.

--------------------------------------------------------------------------------
 THE NINE DASHBOARDS
--------------------------------------------------------------------------------
 Firewall Overview     Summary | Collection health | Geography & changes
 Traffic Explorer      Flow map | Volume | Breakdown
 Traffic Investigator  single page, table centric
 Segmentation Map      Host map | East-west | Segments | Services
 Host 360              Activity | Peers & services | Processes | Changes
 Peer Pivot            single page
 Process Attribution   Process map | Hunting | Outbound & listeners
 Firewall Changes      Activity | Posture over time | Actors | Full history
 Firewall Posture      Compliance | Blind spots | Rule inventory

 Start with the Segmentation Map east-west tab: Internet traffic removed, what
 remains is exactly what a segmentation policy is meant to constrain.

--------------------------------------------------------------------------------
 INVESTIGATION WORKFLOW
--------------------------------------------------------------------------------
   Overview          --click a host-->     Host 360  --click a peer--> Peer Pivot
   Threat Hunting    --click a finding-->  Host 360   or  Peer Pivot
   Segmentation Map  --click a host-->     Host 360
   Firewall Posture  --click a host-->     Host 360
   Host 360          --click a process-->  Process Attribution

 The time range follows you through each hop.

--------------------------------------------------------------------------------
 TROUBLESHOOTING
--------------------------------------------------------------------------------
 Traffic views work, Firewall Changes is empty
   The two views read completely different sources, so this is normal until
   all three of these are true. Check them in order:

   a) Splunk Add-on for Microsoft Windows is installed on the search head and
      the indexer. Without it the events are indexed as raw XML and no field
      is extracted:
        | rest /services/apps/local | search title=Splunk_TA_windows

   b) The WinEventLog stanza is deployed on the forwarder. default/inputs.conf
      holds TWO stanzas - the file monitor AND the event log channel - and it
      is easy to copy only the first:
        splunk btool inputs list "WinEventLog://Microsoft-Windows-Windows Firewall With Advanced Security/Firewall" --debug
      Unlike monitor:// inputs, a WinEventLog:// input only starts on a full
      service restart, not on a configuration reload.

   c) The channel actually has something to say. A firewall channel produces
      events only when the configuration CHANGES - a quiet machine is
      legitimately silent. Force two events to prove the pipeline:
        New-NetFirewallRule -DisplayName "SPLUNK-TEST" -Direction Inbound -Action Block -Enabled False
        Remove-NetFirewallRule -DisplayName "SPLUNK-TEST"
      You should get an EventID 2004/2097 then 2006/2052 within a minute.

 Searching by sourcetype returns nothing for the change events
   With renderXml = 1 the sourcetype is the generic "XmlWinEventLog"; it is
   the SOURCE that carries the channel name:
     source="XmlWinEventLog:Microsoft-Windows-Windows Firewall With Advanced Security/Firewall"
   The `wfo_changes` macro filters on source for exactly this reason.

 ModifyingUser shows a SID instead of an account name
   The forwarder is not resolving directory objects. default/inputs.conf sets
   evt_resolve_ad_obj = 1 on the firewall channels - make sure the forwarder
   picked up that version, and restart it.

 Description is empty in an ad-hoc search
   props.conf writes the decoded event text to "event_description", not
   "Description", to avoid clobbering the add-on's own field. The dashboards
   run their own lookup into "Description". In your own searches use:
     `wfo_changes` | table _time Computer EventID event_description result

 Dashboards are empty and no host is listed anywhere
   Run the "Windows Firewall - Data Collection Health" report. If it returns
   nothing, the index declared on the Configuration page does not match the
   one your forwarders write to.

--------------------------------------------------------------------------------
 SEARCHING
--------------------------------------------------------------------------------
   `wfo_traffic`              connection log of the configured indexes
   `wfo_changes`              firewall configuration events
   `ip_whitelist`             noise filter, driven by whitelist_ip_ranges.csv
   `wfo_internal_ip(ip)`      boolean helper for internal address ranges
   `wfo_wfp`                  WFP events, normalised - carries process_name
   `wfo_posture_profiles`     firewall posture inventory (companion add-on)
   `wfo_posture_rules`        firewall rule inventory (companion add-on)

   Example:

     `wfo_traffic` action=blocked direction=outbound dest_scope=external
     | stats count by host, dest_ip, dest_port, dest_service
     | sort - count

--------------------------------------------------------------------------------
 TUNING
--------------------------------------------------------------------------------
 Enrich lookups/whitelist_ip_ranges.csv with your own trusted CIDR ranges to
 remove noise from every dashboard and detection at once. All alerts ship
 disabled: review their thresholds, then enable the relevant ones from
 Settings > Searches, reports and alerts.

--------------------------------------------------------------------------------
 LICENSE
--------------------------------------------------------------------------------
 Refer to https://www.splunk.com/en_us/legal/splunk-general-terms.html for
 licensing terms.
