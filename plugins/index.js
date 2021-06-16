const ThemeExtractPlugin = require("./themeExtractPlugin");

ThemeExtractPlugin.loader = require.resolve("./themeExtractLoader");

module.exports = ThemeExtractPlugin;
