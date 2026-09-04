================================================================================
 Microsoft Windows Firewall Observability - version 3.1.0
================================================================================

 Collect, parse, normalise and visualise Windows Defender Firewall activity:
 the connection log (pfirewall.log) and the firewall configuration, policy and
 service change events from the Windows Event Log.

 Splunkbase : https://splunkbase.splunk.com/app/7790

--------------------------------------------------------------------------------
 REQUIREMENTS
--------------------------------------------------------------------------------
 * Splunk Enterprise or Splunk Cloud 9.0 or later (Dashboard Studio views).
 * Splunk Add-on for Microsoft Windows 8.9.0 or later, on the same tier, for
   the Windows Event Log field extractions.
 * Windows Defender Firewall logging enabled on the monitored hosts.

--------------------------------------------------------------------------------
 INSTALLATION
--------------------------------------------------------------------------------
 1. Install the app on your search heads.

 2. Open "Configuration" in the app navigation bar and declare the index that
    receives the firewall data. This writes the `windows_firewall_index` macro
    and, optionally, your internal network ranges.

 3. Deploy the stanzas of default/inputs.conf to every Windows forwarder that
    must ship firewall data. Adapt the "index" value to your indexing policy,
    then reload or restart the forwarder.

 4. Enable firewall logging on the Windows hosts:

      Set-NetFirewallProfile -All `
        -LogAllowed True -LogBlocked True `
        -LogMaxSizeKilobytes 20480 `
        -LogFileName "%systemroot%\System32\LogFiles\Firewall\pfirewall.log"

    or, through the console: Windows + R -> wf.msc -> right-click "Windows
    Defender Firewall with Advanced Security on Local Computer" -> Properties
    -> for each profile tab, Logging -> Customize.

 5. Verify the collection with the saved report
    "Windows Firewall - Data Collection Health".

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
 OPTIONAL DATA SOURCES (3.1.0)
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

    Install the companion add-on TA-windows-firewall-posture on your Windows
    forwarders. Two read-only PowerShell inputs inventory the profile state,
    the logging settings and the enabled rules. This is what tells you that a
    silent host is silent because drop logging is off, not because nothing
    happened.

 3. DATA MODEL ACCELERATION - makes the Overview instant on large estates.

    Settings > Data models > Windows Firewall Observability > Edit >
    Edit acceleration. Then set "Data model accelerated" to yes on the
    Configuration page. Until you do, the Overview searches raw data and works
    exactly as before.

--------------------------------------------------------------------------------
 INVESTIGATION WORKFLOW
--------------------------------------------------------------------------------
   Overview        --click a host-->    Host 360    --click a peer-->  Peer Pivot
   Threat Hunting  --click a finding--> Host 360  or  Peer Pivot
   Host 360        --click a process--> Process Attribution

 The time range follows you through each hop.

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
