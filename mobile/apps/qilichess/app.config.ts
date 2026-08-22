import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'QiliChess',
  slug: 'qilichess',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'qilichess',
  userInterfaceStyle: 'automatic',
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.qilichess.app',
    supportsTablet: true,
  },
  android: {
    ...config.android,
    package: 'com.qilichess.app',
  },
  plugins: ['expo-router', ...(config.plugins ?? [])],
  experiments: {
    ...config.experiments,
    typedRoutes: true,
  },
  extra: {
    ...config.extra,
    product: 'qilichess',
  },
});
