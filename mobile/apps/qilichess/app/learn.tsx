import { AdultApp } from '@qili/mobile-ui';
import { navigateAdult } from '../navigation';

export default function LearnRoute() { return <AdultApp onNavigate={navigateAdult} screen="learn" />; }
