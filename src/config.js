var env = process.env.NODE_ENV || 'dev',
    config = require("../config." + env + ".json");

config.net.port = process.env.PORT || config.net.startPort;

module.exports = config;
