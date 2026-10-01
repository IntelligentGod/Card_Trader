// Metro config for the monorepo.
// Expo's defaults already watch the workspace root; we also watch the *real*
// location of workspace packages so bundling works when the repo is opened
// through a different path (e.g. a `subst` drive used for Android builds on Windows).
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);

const workspacePackages = ['@card-trader/shared'];
const extraFolders = workspacePackages
  .map((name) => {
    try {
      return fs.realpathSync(path.resolve(__dirname, '../../node_modules', name));
    } catch {
      return null;
    }
  })
  .filter(Boolean);

config.watchFolders = [...new Set([...(config.watchFolders ?? []), ...extraFolders])];

module.exports = config;
