# Shadow AI - Splunk detection

Shadow AI is a Search Head app for visibility and detection of unsanctioned
generative-AI usage: a maintained AI-services lookup, macros (`ai_web`,
`ai_dns`, `ai_indexes`, `ai_upload_threshold`, `ai_risk_base`), CIM eventtypes
+ tags, detections (saved searches), risk scoring (RBA), Enterprise Security
notables/findings + MITRE ATT&CK annotations, and dashboards (Overview, Actors,
Services, Risky Uploads, Risk). 100% search-time, source-agnostic via the CIM
Web / Network_Resolution data models.

## Optional add-on (Squid proxy only)
The app works with any CIM-compliant web-proxy / NGFW / DNS source. If your proxy log source is Squid, an optional companion add-on,
`TA-squid_ai`, supplies the input and CIM Web parsing: Squid can log upload
bytes via `%>st` (the official Splunk Squid add-on is archived and does not).
It is not needed for enterprise SWGs (Zscaler, Palo Alto, Fortinet, Check Point,
Netskope, Cisco...), which already provide upload bytes through their own add-on.
Get it here: https://github.com/traoreamara/Splunk/tree/1fd6412909256cab5116102ee10e2ed2e1a5991c/Splunkbase/Squid%20Proxy/TA-squid_ai .

## Prerequisites
- Proxy / NGFW / DNS logs onboarded and CIM Web compliant (user/src, dest, bytes_out, action).
- Enterprise Security (optional) for findings and RBA; an index named `risk` for detection 6.
- Macro `ai_indexes`: set to the proxy index(es) (default: proxy/web/main).

## Lookup maintenance
The AI-services lookup (domain, vendor, category, risk) is maintained by the app
author and refreshed regularly from one release to the next, like a threat-intelligence
feed. Keeping it current is the author's responsibility, not yours.

The `sanctioned` flag is the exception: it reflects your own AI-usage policy, not the
market, so it is yours to maintain. Set it against your approved-AI list and add any
internal AI endpoints. The shipped lookup is overwritten on every upgrade, so keep your
`sanctioned` values and internal entries in a separate local lookup (e.g.
`ai_services_local.csv`) chained after the shipped one, never by editing the shipped file.

## Detections
1. Unsanctioned AI service usage (notable)
2. Large upload to AI service / data leak (notable)
3. New AI service first seen (notable)
4. Usage spike per actor vs 7-day baseline (notable)
5. DNS lookups to AI services
6. Risk scoring per actor (RBA -> index=risk)
All grouped by `actor = coalesce(user, src)` (proxy with or without auth).

## bytes_out (upload) by proxy
- Zscaler / Palo Alto / Fortinet / Check Point / Netskope / Cisco: upload provided by the official add-on.
- Native Squid: no upload bytes -> use the optional TA-squid_ai (logformat including `%>st`): https://github.com/traoreamara/Splunk/tree/1fd6412909256cab5116102ee10e2ed2e1a5991c/Splunkbase/Squid%20Proxy/TA-squid_ai .
- Others: verify the bytes_out mapping.

## ES 7 / ES 8 compatibility
Findings = notables (notable index), action.notable is backward compatible. RBA via index=risk;
in ES 8 aggregation is handled by finding-based detections.

## Performance
An accelerated `tstats` variant of `ai_web` is provided (commented) in macros.conf (requires the Web data model accelerated).

## Deployment
- shadow_ai -> Search Head.
- (Optional, Squid only) TA-squid_ai -> proxy forwarder (+ props on the indexer if parsing at the source).
- After editing files as root under $SPLUNK_HOME: chown to the Splunk service account.
