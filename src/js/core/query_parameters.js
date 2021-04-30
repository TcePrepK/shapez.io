const queryString = require("query-string");
const options = queryString.parse(location.search);

export let queryParamOptions = {
    embedProvider: null,
    fullVersion: false,
    sandboxMode: false,
};

if (options.embed) {
    queryParamOptions.embedProvider = options.embed;
}

// Allow testing full version outside of standalone
if (!G_IS_RELEASE) {
    queryParamOptions.fullVersion = true;
    queryParamOptions.sandboxMode = true;
}
