// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // server/ is a separate Cloudflare Worker sub-project (ADR-006) — its
    // own runtime globals (Workers, not React Native/DOM), own tsconfig.
    ignores: ["dist/*", "server/**"],
  }
]);
