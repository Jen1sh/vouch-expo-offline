// Metro config for expo-sqlite + drizzle: lets Metro resolve and inline `.sql`
// migration files, and treat wa-sqlite's `.wasm` as a bundled asset (the web
// build of expo-sqlite loads it from a worker).
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("sql");
config.resolver.assetExts.push("wasm");

module.exports = config;