const path = require("path");
const Module = require("module");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

// pnpm isolated mode fix: patch require.resolve so packages like
// expo-asset can be found from @expo/metro-config's .pnpm location
const extraPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  try {
    return origResolveFilename.call(this, request, parent, isMain, options);
  } catch (firstErr) {
    for (const dir of extraPaths) {
      try {
        return origResolveFilename.call(this, request, parent, isMain, {
          ...options,
          paths: [dir, ...(options?.paths || [])],
        });
      } catch {}
    }
    throw firstErr;
  }
};

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.unstable_enableSymlinks = true;

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
