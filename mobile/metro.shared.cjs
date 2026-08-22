const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

module.exports = function createMetroConfig(projectRoot) {
  const workspaceRoot = __dirname;
  const repositoryRoot = path.resolve(workspaceRoot, '..');
  const config = getDefaultConfig(projectRoot);

  // The authoritative rule and curriculum modules still live at repository root
  // and are re-exported by workspace packages during the gradual web migration.
  config.watchFolders = [workspaceRoot, repositoryRoot];
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ];
  config.resolver.disableHierarchicalLookup = false;
  return config;
};
