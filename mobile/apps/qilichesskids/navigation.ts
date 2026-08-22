import type { KidsScreen } from '@qili/mobile-ui';
import { router, type Href } from 'expo-router';

const routes = {
  home: '/',
  play: '/play',
  learn: '/learn',
  review: '/review',
  profile: '/profile',
} as const satisfies Record<KidsScreen, Href>;

export function navigateKids(screen: KidsScreen) {
  router.replace(routes[screen]);
}

export function openKidsLesson(lessonId: string) {
  router.push(`/lesson/${encodeURIComponent(lessonId)}` as Href);
}

export function closeKidsLesson() {
  router.replace('/learn');
}
