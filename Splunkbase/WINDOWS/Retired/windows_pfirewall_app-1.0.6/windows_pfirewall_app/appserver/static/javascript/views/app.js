import * as Setup from "./setup_page.js";

define(["react", "splunkjs/splunk"], function(react, splunk_js_sdk){
    const e = react.createElement;

    // IndexListConfigInput REACT class ---------------------------------------------------------
    class ConfigurationParametersTable extends react.Component {
      constructor(props) {
        super(props);
        this.state = props;
      }

      render () {
        const updateIndicesMacroValue = this.state['updateIndicesMacroValue'];
        return e("div", null, [
          e("h2", null, "Parameters"),
          e("table", null, [
            e("tr", null, [
              e("th", { "class" : "table-header" }, "Macro Settings"),
              e("th", null, "Value"),
              e("th", null, "Description")
            ]),
            e("tr", { "class" : "input-row" }, [
              e("td", { 'class' : 'parameterCell' }, [
                e("span", null, 'Index:')
              ]),
              e("td", { 'class' : 'parameterCell' }, [
                e("input", { 'id' : 'windows_pfirewall_index', 'onChange' : (e) => updateIndicesMacroValue(e) })
              ]),
              e("td", { 'class' : 'descriptionCell' }, "Index in your environment that manage the windows local firewall data. Leave blanc to match all index ")
            ]),
            e("tr", { "class" : "input-row" }, [
              e("td", { 'class' : 'parameterCell' }, [
                e("span", null, 'Country Location:')
              ]),
              e("td", { 'class' : 'parameterCell' }, [
                e("input", { 'id' : 'country_location', 'onChange' : (e) => updateIndicesMacroValue(e) })
              ]),
              e("td", { 'class' : 'descriptionCell' }, "Enter the country location of your windows assets. leave it blanc to use default one. but it is recommended to set yours. you an customize the dashboard query in case of multiple location infrastructure ")
            ]),
            e("tr", { "class" : "input-row" }, [
              e("td", { 'class' : 'parameterCell' }, [
                e("span", null, 'Location latitude')
              ]),
              e("td", { 'class' : 'parameterCell' }, [
                e("input", { 'id' : 'location_lat', 'onChange' : (e) => updateIndicesMacroValue(e) })
              ]),
              e("td", { 'class' : 'descriptionCell' }, "Enter a valid Latitude value. ex: 20.555555. The default value is: 0.00000")
            ]),
			e("tr", { "class" : "input-row" }, [
              e("td", { 'class' : 'parameterCell' }, [
                e("span", null, 'Location longitude')
              ]),
              e("td", { 'class' : 'parameterCell' }, [
                e("input", { 'id' : 'location_lon', 'onChange' : (e) => updateIndicesMacroValue(e) })
              ]),
              e("td", { 'class' : 'descriptionCell' }, "Enter a valid Longitude value ex: -7.64447. The default value is: 0.00000 ")
            ])
          ])
        ]);
      }
    }

  // SetupPage REACT class ---------------------------------------------------------
  class SetupPage extends react.Component {
    constructor(props) {
      super(props);

      this.state = {
        'windows_pfirewall_index': '*',
        'country_location': 'Default',
        'location_lat': '0.00000',
		'location_lon': '0.00000'
      };

      // Bind internal functions
      this.handleSubmit = this.handleSubmit.bind(this);
      this.updateIndicesMacroValue = this.updateIndicesMacroValue.bind(this);
    }

    // Helper to keep windows_pfirewall_index macro up to date in the state dictionary
    updateIndicesMacroValue(event) {
      var defaults = {
        'windows_pfirewall_index': '*',
        'country_location': 'Default',
        'location_lat': '0.00000',
		'location_lon': '0.00000'
      };
      // If the field has been changed to empty then reset it to the default
      if (event.target.value != '') { 
        this.state[event.target.id] = event.target.value;
      } else {
        this.state[event.target.id] = defaults[event.target.id];
      }
    }

    async handleSubmit(event) {
      event.preventDefault();
      //TODO verify all inputs are filled in correctly
      const macros = {
        'windows_pfirewall_index' : '(' + this.state['windows_pfirewall_index'] + ')',
        'country_location' : '"' + this.state['country_location'] + '"',
        'location_lat' : '"' + this.state['location_lat'] + '"',
		'location_lon' : '"' + this.state['location_lon'] + '"'
      }
      
      await Setup.perform(splunk_js_sdk, macros);
    }

    render() {
      return e("div", null, [
        e(ConfigurationParametersTable, { 'updateIndicesMacroValue' : this.updateIndicesMacroValue }),
          e("button", { "onClick" : this.handleSubmit }, "Complete Setup"),
          e("div", { "class" : "success" }, "Settings saved successfully, redirecting to app..."),
          e("div", { "class" : "error" }, "Issue encountered during setup, details below:"),
          e("code", { "id" : "error_details"})
        ])
    }
  }
  return e(SetupPage);
});
