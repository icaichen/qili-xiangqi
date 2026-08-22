import { StyleSheet, Text, View } from 'react-native';
import { ADULT_LEARN_STAGES } from '@qili/curriculum';
import { ActionButton, adultTheme as theme, radius } from '@qili/design-system';
import { SharedProductApp, type FullScreen } from './shared-product-app';

export type AdultScreen = FullScreen;

export function AdultApp({ screen = 'home', onNavigate }: { screen?: AdultScreen; onNavigate?: (screen: AdultScreen) => void }) {
  return <SharedProductApp learn={<AdultLearn />} onNavigate={onNavigate} screen={screen} />;
}

function AdultLearn() {
  return (
    <>
      <View style={styles.heading}>
        <Text style={styles.kicker}>LEARNING PATH</Text>
        <Text style={styles.title}>每一课，都回到棋盘。</Text>
        <Text style={styles.body}>课程结构与网站共享；短课、棋盘练习和复盘建议连成同一条进阶路径。</Text>
      </View>
      <View style={styles.continueLesson}>
        <Text style={styles.continueIndex}>从这里开始</Text>
        <Text style={styles.continueTitle}>{ADULT_LEARN_STAGES[0]?.title}</Text>
        <Text style={styles.continueBody}>先认识棋盘与棋子，再逐步进入战术和实战思考。</Text>
        <ActionButton compact disabled theme={theme}>课程播放器正在接入</ActionButton>
      </View>
      <Text style={styles.listLabel}>完整学习路径</Text>
      <View>
        {ADULT_LEARN_STAGES.map((stage, index) => (
          <View key={stage.id} style={styles.stageRow}>
            <Text style={[styles.stageIndex, index > 0 && styles.stageIndexMuted]}>{String(stage.order).padStart(2, '0')}</Text>
            <View style={styles.stageCopy}><Text style={styles.stageTitle}>{stage.title}</Text><Text style={styles.stageMeta}>{stage.summary}</Text></View>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: 18, marginTop: 8 }, kicker: { color: theme.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, title: { color: theme.text, fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 37, marginTop: 8 }, body: { color: theme.muted, fontSize: 14, lineHeight: 22, marginTop: 7 },
  continueLesson: { backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: radius.lg, borderWidth: 1, padding: 20 }, continueIndex: { color: theme.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, continueTitle: { color: theme.text, fontSize: 21, fontWeight: '900', marginTop: 8 }, continueBody: { color: theme.muted, fontSize: 13, lineHeight: 20, marginBottom: 14, marginTop: 5 },
  listLabel: { color: theme.subtle, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 7, marginTop: 24 }, stageRow: { alignItems: 'center', borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', paddingVertical: 17 }, stageIndex: { color: theme.brand, fontSize: 16, fontWeight: '900', width: 40 }, stageIndexMuted: { color: theme.subtle }, stageCopy: { flex: 1 }, stageTitle: { color: theme.text, fontSize: 15, fontWeight: '800' }, stageMeta: { color: theme.subtle, fontSize: 11, lineHeight: 17, marginTop: 3 },
});
