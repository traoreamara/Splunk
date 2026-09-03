import * as Setup from "./setup_page.js";

define(["react", "splunkjs/splunk"], function (react, splunk_js_sdk) {
  const e = react.createElement;

  const DEFAULTS = {
    windows_firewall_index: "*",
    wfo_wfp_index: "*",
    wfo_internal_networks:
      "10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 127.0.0.0/8",
    wfo_summariesonly: "no",
  };

  const FIELDS = [
    {
      id: "windows_firewall_index",
      label: "Firewall index",
      placeholder: "windows_firewall",
      help:
        "Index (or comma separated list of indexes) receiving the Windows Defender Firewall data. " +
        "Wildcards are accepted. Leave empty to search every index (*) - not recommended on large deployments.",
    },
    {
      id: "wfo_wfp_index",
      label: "Security index",
      placeholder: "wineventlog",
      help:
        "Index holding your Windows Security events. Only needed for the Process Attribution view, which reads " +
        "Windows Filtering Platform audit events 5152/5156/5157. Usually a different index from the firewall traffic log. " +
        "Leave empty to search every index.",
    },
    {
      id: "wfo_internal_networks",
      label: "Internal networks",
      placeholder: DEFAULTS.wfo_internal_networks,
      help:
        "Comma separated CIDR ranges considered internal. Used by the threat hunting views to tell " +
        "internal traffic from Internet exposure.",
    },
    {
      id: "wfo_summariesonly",
      label: "Data model accelerated",
      placeholder: "no",
      help:
        "Type 'yes' only AFTER you have accelerated the Windows Firewall Observability data model " +
        "(Settings > Data models). The Overview then reads summaries only, which is dramatically faster on large " +
        "estates. Leave 'no' otherwise, or the Overview will show nothing.",
    },
  ];

  // ---------------------------------------------------------------- table
  class ConfigurationParametersTable extends react.Component {
    render() {
      const { values, onChange } = this.props;
      return e("div", { className: "wfo-setup-card" }, [
        e("h2", { key: "h" }, "Parameters"),
        e(
          "table",
          { key: "t", className: "wfo-setup-table" },
          e("tbody", null, [
            e("tr", { key: "head" }, [
              e("th", { key: "1", className: "table-header" }, "Setting"),
              e("th", { key: "2", className: "table-header" }, "Value"),
              e("th", { key: "3", className: "table-header" }, "Description"),
            ]),
            ...FIELDS.map((f) =>
              e("tr", { key: f.id, className: "input-row" }, [
                e(
                  "td",
                  { key: "l", className: "parameterCell" },
                  e("label", { htmlFor: f.id }, f.label)
                ),
                e(
                  "td",
                  { key: "i", className: "parameterCell" },
                  e("input", {
                    id: f.id,
                    type: "text",
                    value: values[f.id],
                    placeholder: f.placeholder,
                    onChange: (ev) => onChange(f.id, ev.target.value),
                  })
                ),
                e("td", { key: "d", className: "descriptionCell" }, f.help),
              ])
            ),
          ])
        ),
      ]);
    }
  }

  // ------------------------------------------------------------ setup page
  class SetupPage extends react.Component {
    constructor(props) {
      super(props);
      this.state = {
        windows_firewall_index: "",
        wfo_wfp_index: "",
        wfo_summariesonly: DEFAULTS.wfo_summariesonly,
        wfo_internal_networks: DEFAULTS.wfo_internal_networks,
        status: "idle", // idle | saving | done | error
        message: "",
      };
      this.handleSubmit = this.handleSubmit.bind(this);
      this.handleChange = this.handleChange.bind(this);
    }

    handleChange(id, value) {
      this.setState({ [id]: value, status: "idle", message: "" });
    }

    // "win*, wineventlog" -> "(win*, wineventlog)" ; "" -> "(*)"
    buildIndexMacro(id) {
      const raw = (this.state[id] || "").trim();
      if (raw === "") return "(*)";
      const cleaned = raw.replace(/^\(+|\)+$/g, "").trim();
      return "(" + cleaned + ")";
    }

    buildSummariesOnlyMacro() {
      const raw = (this.state.wfo_summariesonly || "").trim().toLowerCase();
      const on = raw === "yes" || raw === "true" || raw === "1" || raw === "oui";
      return on
        ? "summariesonly=true allow_old_summaries=true"
        : "summariesonly=false";
    }

    buildInternalIpMacro() {
      const raw = (
        this.state.wfo_internal_networks || DEFAULTS.wfo_internal_networks
      ).trim();
      const ranges = raw
        .split(",")
        .map((r) => r.trim())
        .filter((r) => r.length > 0);
      if (ranges.length === 0) return "(false())";
      return (
        "(" +
        ranges.map((r) => 'cidrmatch("' + r + '", $ip$)').join(" OR ") +
        ")"
      );
    }

    async handleSubmit(event) {
      event.preventDefault();
      this.setState({ status: "saving", message: "Saving configuration..." });

      // NOTE (v3.0.0): version 2.x wrote a macro named `windows_pfirewall_index`
      // while every search of the app used `windows_firewall_index`. The setup
      // page therefore had no effect at all. The correct macro name is used here.
      const macros = {
        windows_firewall_index: {
          definition: this.buildIndexMacro("windows_firewall_index"),
          args: "",
        },
        wfo_wfp_index: {
          definition: this.buildIndexMacro("wfo_wfp_index"),
          args: "",
        },
        wfo_summariesonly: {
          definition: this.buildSummariesOnlyMacro(),
          args: "",
        },
        "wfo_internal_ip(1)": {
          definition: this.buildInternalIpMacro(),
          args: "ip",
        },
      };

      try {
        await Setup.perform(splunk_js_sdk, macros);
        this.setState({
          status: "done",
          message: "Settings saved successfully, redirecting to the app...",
        });
      } catch (error) {
        this.setState({
          status: "error",
          message: String((error && error.message) || error),
        });
      }
    }

    render() {
      const { status, message } = this.state;
      return e("div", { className: "wfo-setup" }, [
        e("h1", { key: "title" }, "Microsoft Windows Firewall Observability"),
        e(
          "p",
          { key: "sub", className: "wfo-setup-sub" },
          "Tell the app where the firewall data is indexed. You can change these values later from Settings > Advanced search > Search macros."
        ),
        e(ConfigurationParametersTable, {
          key: "table",
          values: this.state,
          onChange: this.handleChange,
        }),
        e(
          "button",
          {
            key: "btn",
            className: "wfo-setup-button",
            disabled: status === "saving",
            onClick: this.handleSubmit,
          },
          status === "saving" ? "Saving..." : "Complete setup"
        ),
        status === "done"
          ? e("div", { key: "ok", className: "success visible" }, message)
          : null,
        status === "error"
          ? e("div", { key: "ko", className: "error visible" }, [
              e("div", { key: "t" }, "Issue encountered during setup:"),
              e("code", { key: "c", id: "error_details" }, message),
            ])
          : null,
      ]);
    }
  }

  return e(SetupPage);
});
