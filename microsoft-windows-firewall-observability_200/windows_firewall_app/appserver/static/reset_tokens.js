require(['jquery', 'splunkjs/mvc', 'splunkjs/mvc/simplexml/ready!'], function($, mvc) {
    var defaultTokens = mvc.Components.get("default");
    var submittedTokens = mvc.Components.get("submitted");

    // Function to reset all tokens
    function resetAllTokens() {
        // Clear default and submitted tokens
        defaultTokens.clear();
        submittedTokens.clear();

        // If you need to set specific defaults after clearing:
        // defaultTokens.set("tokenName", "defaultValue");
    }

    // Attach click event handler for the reset button
    $('#resetButton').on('click', function() {
        resetAllTokens();
    });
});