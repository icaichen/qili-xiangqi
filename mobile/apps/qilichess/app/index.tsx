import { AdultApp } from '@qili/mobile-ui';
import { navigateAdult } from '../navigation';

export default function QiliChessApp() {
  return <AdultApp onNavigate={navigateAdult} screen="home" />;
}
