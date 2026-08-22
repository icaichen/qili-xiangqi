import { AdultApp } from '@qili/mobile-ui';
import { navigateAdult } from '../navigation';

export default function ProfileRoute() { return <AdultApp onNavigate={navigateAdult} screen="profile" />; }
