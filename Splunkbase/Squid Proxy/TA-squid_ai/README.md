# TA-squid_ai

Input and CIM Web parsing for a Squid forward proxy that logs upload bytes
(`%>st`). Optional add-on, for Squid environments only (the official Splunk
Squid add-on is archived). Use together with the `shadow_ai` app.

For enterprise SWGs (Zscaler, Palo Alto, Fortinet, Check Point, Netskope,
Cisco...), use their official add-on instead — this TA is not needed.

## Why Squid for Shadow AI
Detecting a data leak toward an AI service is not about *whether* a user
reached chatgpt.com — it is about *how much data they sent to it*. The
signal that separates "someone opened ChatGPT" from "someone pasted the
customer database into ChatGPT" is the **upload volume** (bytes sent from
the client to the service).

Most proxies and firewalls log the response size but not the request
(upload) size, so that signal is lost. Squid can emit it with the `%>st`
field, and this TA maps it to CIM `bytes_out` — which the `shadow_ai`
detections use for the "large upload to AI service" rule and for per-user
risk scoring. HTTPS is not an obstacle: even on a `CONNECT` tunnel Squid
records the destination host and the byte counts without decrypting the
traffic.

In short: Squid is the cheapest way to get the one field (upload bytes)
that turns AI-service visibility into AI data-leak detection, when no
enterprise SWG is in place to provide it.

## What it does
- Monitors the Squid access log and assigns sourcetype `squid:ai`.
- Parses the custom logformat and normalizes to CIM Web (`src`, `user`,
  `dest`, `dest_port`, `http_method`, `status`, `action`, `bytes_in`,
  `bytes_out`, `bytes`, `url`...).
- Assigns `tag=web` (eventtype `squid_ai_web`) so events enter the Web data model.

## Squid configuration
Add to squid.conf a logformat that includes upload bytes and the request target:

    logformat ai %ts.%03tu %>a %un %Ss/%03>Hs %>st %<st %rm %ru
    access_log /opt/Squid/logs/access.log ai

## Installation
1. Install on the data-collection tier (heavy forwarder or indexer) AND on the
   search head — field extractions and CIM EVALs are search-time and must be
   present where searches run. On an all-in-one, a single install covers both.
2. Adjust the monitor input path and index in `default/inputs.conf`:

       [monitor:///opt/Squid/logs/access.log]
       sourcetype = squid:ai
       index = proxy
       disabled = 0

   Containerized Splunk: mount the log volume read-only, e.g.
   `-v /opt/Squid/logs:/opt/Squid/logs:ro`.
3. Verify:

       index=proxy sourcetype=squid:ai | datamodel Web Web flat
       | search sourcetype=squid:ai | stats count

## Note
The `shadow_ai` app already carries the `squid:ai` parsing and the `tag=web`
assignment, so detections work even if this TA is installed only on a separate
forwarder. This TA is required only to collect and parse the Squid log at the
indexing tier.

## Dependency
Requires `shadow_ai` 1.0.0.
