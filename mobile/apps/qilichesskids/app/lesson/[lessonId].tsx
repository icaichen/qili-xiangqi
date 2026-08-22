import { KidsApp } from '@qili/mobile-ui';
import { useLocalSearchParams } from 'expo-router';
import { closeKidsLesson, navigateKids, openKidsLesson } from '../../navigation';

export default function LessonRoute() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  return (
    <KidsApp
      lessonId={lessonId}
      onCloseLesson={closeKidsLesson}
      onNavigate={navigateKids}
      onOpenLesson={openKidsLesson}
      screen="learn"
    />
  );
}
