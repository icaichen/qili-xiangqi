import { AdultApp } from '@qili/mobile-ui';
import { navigateAdult } from '../navigation';

export default function ReviewRoute() { return <AdultApp onNavigate={navigateAdult} screen="review" />; }
