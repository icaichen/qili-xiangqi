import { KidsApp } from '@qili/mobile-ui';
import { navigateKids, openKidsLesson } from '../navigation';

export default function ProfileRoute() {
  return <KidsApp onNavigate={navigateKids} onOpenLesson={openKidsLesson} screen="profile" />;
}
