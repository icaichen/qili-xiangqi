import { KidsApp } from '@qili/mobile-ui';
import { navigateKids, openKidsLesson } from '../navigation';

export default function PracticeRoute() { return <KidsApp onNavigate={navigateKids} onOpenLesson={openKidsLesson} screen="learn" />; }
