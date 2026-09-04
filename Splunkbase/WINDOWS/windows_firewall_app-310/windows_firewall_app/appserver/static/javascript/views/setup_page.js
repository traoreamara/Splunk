"use strict";

import * as Splunk from './splunk_helpers.js'
import * as Config from './setup_configuration.js'

const MACROS_CONF = 'macros'
const APP_NAME = 'windows_firewall_app'

/**
 * @param {object} splunk_js_sdk
 * @param {object} macros  { '<stanza>': { definition: '<value>', args: '<args>' } }
 */
export async function perform(splunk_js_sdk, macros) {
    var application_name_space = {
        owner: "nobody",
        app: APP_NAME,
        sharing: "app",
    };

    const splunk_js_sdk_service = Config.create_splunk_js_sdk_service(
        splunk_js_sdk,
        application_name_space,
    );

    for (const [stanza, value] of Object.entries(macros)) {
        // Accept both the legacy string form and the { definition, args } form.
        const properties =
            typeof value === 'string'
                ? { args: '', definition: value }
                : { args: value.args || '', definition: value.definition };

        await Splunk.update_configuration_file(
            splunk_js_sdk_service,
            MACROS_CONF,
            stanza,
            properties
        )
    }

    // Flag the app as configured, then reload it so Splunk picks up the macros.
    await Config.complete_setup(splunk_js_sdk_service);
    await Config.reload_splunk_app(splunk_js_sdk_service, APP_NAME);
    Config.redirect_to_splunk_app_homepage(APP_NAME, 1200);
}
