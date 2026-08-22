import type { AdultScreen } from '@qili/mobile-ui';
import { router, type Href } from 'expo-router';

const routes = {
  home: '/',
  play: '/play',
  learn: '/learn',
  review: '/review',
  profile: '/profile',
} as const satisfies Record<AdultScreen, Href>;

export function navigateAdult(screen: AdultScreen) {
  router.replace(routes[screen]);
}
