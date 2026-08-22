import { KidsApp } from '@qili/mobile-ui';
import { navigateKids, openKidsLesson } from '../navigation';

export default function PlayRoute() {
  return <KidsApp onNavigate={navigateKids} onOpenLesson={openKidsLesson} screen="play" />;
}
