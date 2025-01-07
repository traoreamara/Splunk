"use strict";

import * as Splunk from './splunk_helpers.js'
import * as Config from './setup_configuration.js'

const MACROS_CONF = 'macros'

export async function perform(splunk_js_sdk, macros) {
    var app_name = "Splunk_app_for_windows_pfirewall";

    var application_name_space = {
        owner: "nobody",
        app: app_name,
        sharing: "app",
    };

    try {
        // Create the Splunk JS SDK Service object

        const splunk_js_sdk_service = Config.create_splunk_js_sdk_service(
            splunk_js_sdk,
            application_name_space,
        );
        
        // Iterate through each macro and update macros.conf for each
        for (const [stanza, value] of Object.entries(macros)) {
            const properties = { args: '', definition: value };
            // Get macros.conf and do stuff to it
            await Splunk.update_configuration_file(
                splunk_js_sdk_service,
                MACROS_CONF,
                stanza,
                properties
            )
        }

        // Completes the setup, by access the app.conf's [install]
        // stanza and then setting the `is_configured` to true
        await Config.complete_setup(splunk_js_sdk_service);

        // Reloads the splunk app so that splunk is aware of the
        // updates made to the file system
        await Config.reload_splunk_app(splunk_js_sdk_service, app_name);
        // Redirect to the Splunk App's home page. Wait 800 ms for the configurations to update
        Config.redirect_to_splunk_app_homepage(app_name, 800);
    } catch (error) {
        // This could be better error catching.
        // Usually, error output that is ONLY relevant to the user
        // should be displayed. This will return output that the
        // user does not understand, causing them to be confused.
        alert('Error:' + error);
    }
}
