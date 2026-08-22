import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton, kidsTheme as theme, radius } from '@qili/design-system';
import { KIDS_CHAPTERS, KIDS_PLAYABLE_LESSONS, type KidsPlayableLesson } from '@qili/curriculum';
import { applyMove, generateLegalMoves, isInCheck, LABELS, legalMovesForPiece, type Board, type Move } from '@qili/xiangqi-core';
import { XiangqiBoard } from './xiangqi-board';
import { SharedProductApp, type FullScreen } from './shared-product-app';

const LESSONS = KIDS_PLAYABLE_LESSONS;
type KidsLesson = KidsPlayableLesson;
export type KidsScreen = FullScreen;

export function KidsApp({ lessonId, onCloseLesson, onNavigate, onOpenLesson, screen = 'home' }: { lessonId?: string; onCloseLesson?: () => void; onNavigate?: (screen: KidsScreen) => void; onOpenLesson?: (lessonId: string) => void; screen?: KidsScreen }) {
  const [localLesson, setLocalLesson] = useState<KidsLesson | null>(null);
  const lesson = lessonId ? LESSONS.find((entry) => entry.id === lessonId) ?? null : localLesson;

  const openLesson = (nextLesson: KidsLesson = LESSONS[0]) => {
    if (onOpenLesson) onOpenLesson(nextLesson.id);
    else setLocalLesson(nextLesson);
  };

  const learn = lesson
    ? <KidsLessonPlayer key={lesson.id} lesson={lesson} onBack={() => onCloseLesson ? onCloseLesson() : setLocalLesson(null)} onNext={(nextLesson) => openLesson(nextLesson)} />
    : <><LearningMap onOpen={openLesson} /><PracticePage /></>;

  return <SharedProductApp kids learn={learn} onNavigate={(nextScreen) => { setLocalLesson(null); onNavigate?.(nextScreen); }} screen={screen} />;
}

function LearningMap({ onOpen }: { onOpen: (lesson: KidsLesson) => void }) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const chapter = KIDS_CHAPTERS[chapterIndex];
  const lessons = useMemo(() => LESSONS.filter((item) => item.chapterId === chapter.id), [chapter.id]);
  return (
    <>
      <View style={styles.mapHeading}><Text style={styles.mapEyebrow}>学习乐园 · 26 课</Text><Text style={styles.mapTitle}>{chapter.title}</Text><Text style={styles.mapBody}>沿着棋盘小路，一次只练一个本领。</Text></View>
      <View style={styles.chapterSwitch}>
        {KIDS_CHAPTERS.map((item, index) => <Pressable accessibilityLabel={`第 ${index + 1} 章`} key={item.id} onPress={() => setChapterIndex(index)} style={[styles.chapterDot, chapterIndex === index && styles.chapterDotActive]}><Text style={[styles.chapterDotText, chapterIndex === index && styles.chapterDotTextActive]}>{index + 1}</Text></Pressable>)}
      </View>
      <View style={styles.lessonTrail}>
        <View style={styles.trailLine} />
        {lessons.map((item, index) => (
          <Pressable key={item.id} onPress={() => onOpen(item)} style={[styles.trailStop, index % 2 === 1 && styles.trailStopRight]}>
              <View style={[styles.lessonNode, index === 0 && styles.lessonNodeCurrent]}><Text style={[styles.lessonNodeText, index === 0 && styles.lessonNodeTextCurrent]}>{item.lessonIndex + 1}</Text></View>
            <View style={[styles.trailCopy, index % 2 === 1 && styles.trailCopyRight]}><Text numberOfLines={2} style={styles.trailTitle}>{item.title}</Text><Text style={styles.trailMeta}>{index === 0 ? '从这里开始 · 约 4 分钟' : '棋盘任务 · 约 4 分钟'}</Text></View>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function KidsLessonPlayer({ lesson, onBack, onNext }: { lesson: KidsLesson; onBack: () => void; onNext: (lesson: KidsLesson) => void }) {
  const [position, setPosition] = useState<Board>(() => boardForLesson(lesson));
  const [hint, setHint] = useState(false);
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const selectionOnly = lesson.mode === 'piece-tour' || lesson.mode === 'identify-sequence' || lesson.mode === 'identify' || lesson.mode === 'zone';
  const target = lesson.mode === 'piece-tour' ? lesson.piecesToMeet?.[step]?.at
    : lesson.mode === 'identify-sequence' ? lesson.sequence?.[step]?.at
      : lesson.mode === 'identify' ? lesson.identify
        : undefined;
  const expectedMove = lesson.mode === 'mini-game' ? lesson.expectedMoves?.[step] : lesson.expected;
  const moveTarget = expectedMove ? [expectedMove[2], expectedMove[3]] as const : undefined;
  const nextLesson = LESSONS[lesson.lessonIndex + 1];
  const coachText = complete ? lesson.success
    : feedback ?? (hint ? (lesson.mode === 'piece-tour' ? lesson.piecesToMeet?.[step]?.hint : lesson.mode === 'identify-sequence' ? lesson.sequence?.[step]?.hint : lesson.tip)
      : lesson.mode === 'piece-tour' ? lesson.piecesToMeet?.[step]?.prompt ?? lesson.prompt
        : lesson.mode === 'identify-sequence' ? lesson.sequence?.[step]?.prompt ?? lesson.prompt
          : lesson.prompt);

  const handlePoint = (row: number, col: number) => {
    let correct = false;
    if (target) correct = row === target[0] && col === target[1];
    if (lesson.mode === 'zone' && lesson.zone) correct = row >= lesson.zone.minRow && row <= lesson.zone.maxRow && col >= lesson.zone.minCol && col <= lesson.zone.maxCol;
    if (!correct) {
      setFeedback(lesson.failure ?? (lesson.mode === 'piece-tour' ? lesson.piecesToMeet?.[step]?.hint : lesson.mode === 'identify-sequence' ? lesson.sequence?.[step]?.hint : lesson.tip) ?? '再看看棋盘上的目标。');
      return;
    }
    const lastStep = lesson.mode === 'piece-tour' ? (lesson.piecesToMeet?.length ?? 1) - 1 : lesson.mode === 'identify-sequence' ? (lesson.sequence?.length ?? 1) - 1 : 0;
    if (step >= lastStep) setComplete(true);
    else { setStep((current) => current + 1); setHint(false); setFeedback(null); }
  };

  const handleMoveIntent = (move: Move) => {
    if (!expectedMove || !matchesMove(move, expectedMove)) {
      setFeedback(lesson.failure ?? '这步按规则能走，但不是本课的目标。题面没有改变，请再看星星和提示。');
      return;
    }

    let nextPosition = applyMove(position, move).board;
    if (lesson.autoReply) {
      const reply = findExactLegalMove(nextPosition, lesson.autoReply);
      if (!reply) {
        setFeedback('本课的自动回应未通过规则验证，题面已保持不变。');
        return;
      }
      nextPosition = applyMove(nextPosition, reply).board;
    }

    if (lesson.verifyCheck && !isInCheck(nextPosition, 'black')) {
      setFeedback('这一步没有形成真正的将军，题面已保持不变。');
      return;
    }

    if (lesson.mode === 'mini-game' && step === 0) {
      const secondMove = lesson.expectedMoves?.[1];
      const reply = secondMove ? findMiniGameReply(nextPosition, secondMove) : undefined;
      if (!reply) {
        setFeedback('系统没有找到经过规则验证的应将，题面已保持不变。');
        return;
      }
      setPosition(applyMove(nextPosition, reply).board);
      setStep(1);
      setHint(false);
      setFeedback('对手用一手合法棋挡住了将军。现在再找最后一击。');
      return;
    }

    if (lesson.verifyMate || lesson.mode === 'mini-game') {
      const checkmate = isInCheck(nextPosition, 'black') && generateLegalMoves(nextPosition, 'black').length === 0;
      if (!checkmate) {
        setFeedback('黑方仍有合法回应，题面已保持不变。');
        return;
      }
    }

    setPosition(nextPosition);
    setFeedback(null);
    setComplete(true);
  };
  return (
    <>
      <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹ 返回学习小路</Text></Pressable>
      <View style={styles.lessonHeader}>
        <Text style={styles.lessonStep}>第 {lesson.lessonIndex + 1} 课 · {KIDS_CHAPTERS[lesson.chapterOrder - 1]?.title}</Text>
        <Text style={styles.lessonTitle}>{lesson.title}</Text>
        <Text style={styles.lessonObjective}>{lesson.prompt}</Text>
      </View>
      <View style={styles.coachMini}><View style={styles.coachPiece}><Text style={styles.coachPieceText}>{lesson.icon}</Text></View><Text style={styles.coachMiniText}>{coachText}</Text></View>
      <XiangqiBoard
        cute
        highlight={selectionOnly ? ((hint || lesson.mode === 'piece-tour') ? target : undefined) : moveTarget}
        instruction={complete ? '完成！这一步做对了' : lesson.subtitle}
        onMoveIntent={handleMoveIntent}
        onPointPress={selectionOnly ? handlePoint : undefined}
        position={position}
        selectionOnly={selectionOnly}
        sideToMove="red"
        tone="kids"
      />
      <View style={styles.lessonActions}><ActionButton disabled={complete} onPress={() => { setHint(true); setFeedback(null); }} tone="quiet" theme={theme}>给我提示</ActionButton><ActionButton disabled={!complete || !nextLesson} onPress={() => nextLesson && onNext(nextLesson)} tone={complete ? 'gold' : 'quiet'} theme={theme}>{complete ? (nextLesson ? '下一课' : '全部课程已试玩') : '完成后继续'}</ActionButton></View>
      <Text style={styles.masteryText}>本课提示：{lesson.tip}</Text>
    </>
  );
}

function boardForLesson(lesson: KidsLesson): Board {
  const board: Board = Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null));
  for (const [row, col, type, color] of lesson.pieces) board[row][col] = { type, color, label: LABELS[color][type] };
  return board;
}

function matchesMove(move: Move, expected: readonly [number, number, number, number]) {
  return move.fromRow === expected[0] && move.fromCol === expected[1] && move.toRow === expected[2] && move.toCol === expected[3];
}

function findExactLegalMove(board: Board, expected: readonly [number, number, number, number]) {
  return legalMovesForPiece(board, expected[0], expected[1]).find((move) => matchesMove(move, expected));
}

function findMiniGameReply(board: Board, expectedNextMove: readonly [number, number, number, number]) {
  for (const reply of generateLegalMoves(board, 'black')) {
    const afterReply = applyMove(board, reply).board;
    const finishingMove = findExactLegalMove(afterReply, expectedNextMove);
    if (!finishingMove) continue;
    const finalPosition = applyMove(afterReply, finishingMove).board;
    if (isInCheck(finalPosition, 'black') && generateLegalMoves(finalPosition, 'black').length === 0) return reply;
  }
  return undefined;
}

function PracticePage() {
  const [moved, setMoved] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  return (
    <>
      <View style={styles.mapHeading}><Text style={styles.mapEyebrow}>规则练习预览 · 不保存进度</Text><Text style={styles.mapTitle}>再和“车”玩一次</Text><Text style={styles.mapBody}>没有倒计时，也不扣星。当前练习只验证本地走子规则。</Text></View>
      <View style={styles.practicePrompt}><Text style={styles.practicePromptIcon}>车</Text><View><Text style={styles.practicePromptTitle}>{moved ? '车动起来啦！' : '让红车沿直线走一步'}</Text><Text style={styles.practicePromptBody}>先点左下角的车，再选择同一直线上的亮点。</Text></View></View>
      <XiangqiBoard cute key={resetKey} tone="kids" instruction="点棋子，再点亮起来的位置" onMove={() => setMoved(true)} />
      <View style={styles.lessonActions}><ActionButton onPress={() => { setMoved(false); setResetKey((value) => value + 1); }} tone="quiet" theme={theme}>重新摆好</ActionButton><ActionButton disabled tone="gold" theme={theme}>更多练习尚未接入</ActionButton></View>
    </>
  );
}

const styles = StyleSheet.create({
  mapHeading: { marginBottom: 15, marginTop: 6 }, mapEyebrow: { color: '#2d87a9', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, mapTitle: { color: theme.text, fontSize: 29, fontWeight: '900', letterSpacing: -0.8, lineHeight: 36, marginTop: 7 }, mapBody: { color: theme.muted, fontSize: 14, lineHeight: 21, marginTop: 5 },
  chapterSwitch: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 22 }, chapterDot: { alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: 99, borderWidth: 2, height: 38, justifyContent: 'center', width: 38 }, chapterDotActive: { backgroundColor: theme.accent, borderColor: '#d4a82e' }, chapterDotText: { color: theme.muted, fontSize: 13, fontWeight: '900' }, chapterDotTextActive: { color: '#5a4005' },
  lessonTrail: { minHeight: 400, paddingBottom: 12, position: 'relative' }, trailLine: { backgroundColor: '#d8dedc', bottom: 35, left: '50%', position: 'absolute', top: 26, width: 3 }, trailStop: { alignItems: 'center', flexDirection: 'row', marginBottom: 17, minHeight: 66, width: '78%' }, trailStopRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' }, lessonNode: { alignItems: 'center', backgroundColor: theme.surfaceRaised, borderColor: '#bfcacb', borderRadius: 99, borderWidth: 3, height: 54, justifyContent: 'center', width: 54 }, lessonNodeCurrent: { backgroundColor: theme.brand, borderColor: '#fff0df', shadowColor: theme.brandStrong, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0 }, lessonNodeText: { color: theme.muted, fontSize: 15, fontWeight: '900' }, lessonNodeTextCurrent: { color: '#fff' }, trailCopy: { flex: 1, marginLeft: 10 }, trailCopyRight: { alignItems: 'flex-end', marginLeft: 0, marginRight: 10 }, trailTitle: { color: theme.text, fontSize: 14, fontWeight: '900', lineHeight: 18 }, trailMeta: { color: theme.muted, fontSize: 9, marginTop: 3 },
  backButton: { alignSelf: 'flex-start', paddingBottom: 9, paddingTop: 3 }, backText: { color: '#287e9f', fontSize: 13, fontWeight: '900' }, lessonHeader: { marginBottom: 12 }, lessonStep: { color: '#2d87a9', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 }, lessonTitle: { color: theme.text, fontSize: 27, fontWeight: '900', letterSpacing: -0.7, lineHeight: 34, marginTop: 5 }, lessonObjective: { color: theme.muted, fontSize: 13, lineHeight: 20, marginTop: 5 },
  coachMini: { alignItems: 'center', flexDirection: 'row', gap: 9, marginBottom: 9 }, coachPiece: { alignItems: 'center', backgroundColor: theme.brand, borderRadius: 14, height: 43, justifyContent: 'center', width: 43 }, coachPieceText: { color: '#fff', fontSize: 20, fontWeight: '900' }, coachMiniText: { backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, color: theme.text, flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 17, overflow: 'hidden', padding: 10 }, lessonActions: { flexDirection: 'row', gap: 8, marginTop: 13 }, masteryText: { color: theme.muted, fontSize: 10, lineHeight: 16, marginTop: 12, textAlign: 'center' },
  practicePrompt: { alignItems: 'center', backgroundColor: theme.accentSoft, borderColor: '#edd679', borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: 12, marginBottom: 11, padding: 12 }, practicePromptIcon: { backgroundColor: theme.surfaceRaised, borderColor: theme.brand, borderRadius: 99, borderWidth: 2, color: theme.brand, fontSize: 20, fontWeight: '900', height: 43, lineHeight: 39, overflow: 'hidden', textAlign: 'center', width: 43 }, practicePromptTitle: { color: theme.text, fontSize: 14, fontWeight: '900' }, practicePromptBody: { color: theme.muted, fontSize: 10, marginTop: 3 },
});
