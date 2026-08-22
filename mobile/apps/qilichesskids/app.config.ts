import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'QiliChess Kids',
  slug: 'qilichesskids',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'qilichesskids',
  userInterfaceStyle: 'automatic',
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.qilichess.kids',
    supportsTablet: true,
  },
  android: {
    ...config.android,
    package: 'com.qilichess.kids',
  },
  plugins: ['expo-router', ...(config.plugins ?? [])],
  experiments: {
    ...config.experiments,
    typedRoutes: true,
  },
  extra: {
    ...config.extra,
    product: 'qilichesskids',
  },
});
