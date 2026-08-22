import { AdultApp } from '@qili/mobile-ui';
import { navigateAdult } from '../navigation';

export default function PlayRoute() { return <AdultApp onNavigate={navigateAdult} screen="play" />; }
