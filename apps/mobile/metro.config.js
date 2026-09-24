const { getDefaultConfig } = require("expo/metro-config");
// SDK 52+ discovers the workspace and package-manager layout itself.
module.exports = getDefaultConfig(__dirname);
