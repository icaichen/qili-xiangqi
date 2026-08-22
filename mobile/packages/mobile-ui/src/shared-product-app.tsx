import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, BottomNavigation, ProductHeader, adultTheme, kidsTheme, radius, space, type ProductTheme } from '@qili/design-system';
import { timeControls } from '@qili/product-config';
import { applyMove, createInitialBoard, gameStatus, generateLegalMoves, type Board, type Move, type PieceColor } from '@qili/xiangqi-core';
import { XiangqiBoard } from './xiangqi-board';
import { analyzePosition, createGuest, createRoom, getRoom, joinRoom, loadGames, pollMatch, roomAction, saveComputerGame, startMatch, uciToMove, type HistoryGame, type MobileSession, type OnlineRoom, type RoomAccess } from './mobile-api';

export const FULL_NAV = [
  { id: 'home', label: '首页', icon: '⌂' },
  { id: 'play', label: '下棋', icon: '棋' },
  { id: 'learn', label: '学习', icon: '学' },
  { id: 'review', label: '复盘', icon: '复' },
  { id: 'profile', label: '我的', icon: '人' },
] as const;

export type FullScreen = (typeof FULL_NAV)[number]['id'];

type Props = {
  kids?: boolean;
  screen: FullScreen;
  onNavigate?: (screen: FullScreen) => void;
  learn: ReactNode;
};

export function SharedProductApp({ kids = false, screen, onNavigate, learn }: Props) {
  const theme = kids ? kidsTheme : adultTheme;
  const key = kids ? 'qili-mobile-kids-session' : 'qili-mobile-adult-session';
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<MobileSession | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(key).then((value) => value && setSession(JSON.parse(value) as MobileSession)).catch(() => {}).finally(() => setLoading(false));
  }, [key]);

  if (loading) return <View style={[styles.loading, { backgroundColor: theme.canvas }]}><ActivityIndicator color={theme.brand} size="large" /></View>;
  if (!session) return <Welcome kids={kids} theme={theme} onGuest={async () => { const next = await createGuest(kids ? '小棋手' : '移动棋友'); await AsyncStorage.setItem(key, JSON.stringify(next)); setSession(next); }} />;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.canvas} />
      <ProductHeader kids={kids} theme={theme} trailing={kids ? <View style={styles.starPill}><Text style={styles.starText}>★ 0</Text></View> : <Text style={[styles.guestLabel, { color: theme.muted }]}>游客</Text>} />
      <View style={styles.screen}>
        {screen === 'home' ? <Home kids={kids} onNavigate={onNavigate} session={session} theme={theme} /> : null}
        {screen === 'play' ? <Play session={session} kids={kids} theme={theme} /> : null}
        {screen === 'learn' ? <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>{learn}</ScrollView> : null}
        {screen === 'review' ? <Review session={session} theme={theme} onPlay={() => onNavigate?.('play')} /> : null}
        {screen === 'profile' ? <Profile kids={kids} session={session} theme={theme} onLogout={async () => { await AsyncStorage.removeItem(key); setSession(null); }} /> : null}
      </View>
      <BottomNavigation activeId={screen} items={FULL_NAV} onChange={(id) => onNavigate?.(id as FullScreen)} theme={theme} />
    </SafeAreaView>
  );
}

function Welcome({ kids, theme, onGuest }: { kids: boolean; theme: ProductTheme; onGuest: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); try { await onGuest(); } catch (error) { Alert.alert('暂时无法进入', error instanceof Error ? error.message : '请检查网络后重试。'); } finally { setBusy(false); } };
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.canvas }]}><StatusBar barStyle="dark-content" backgroundColor={theme.canvas} /><ScrollView contentContainerStyle={styles.welcome}><ProductHeader kids={kids} theme={theme} trailing={kids ? <View style={styles.starPill}><Text style={styles.starText}>★</Text></View> : undefined} />{kids ? <KidsWelcome theme={theme} /> : <AdultWelcome theme={theme} />}<View style={styles.featureRow}>{(kids ? ['完整下棋', '互动课程', '趣味挑战', '复盘成长'] : ['真人对弈', '电脑练习', '训练课程', '智能复盘']).map((label) => <View key={label} style={[styles.featureChip, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}><Text style={[styles.featureText, { color: theme.text }]}>{label}</Text></View>)}</View><View style={[styles.entryCard, kids && styles.kidsEntryCard, { backgroundColor: kids ? '#fff6c9' : theme.surfaceRaised, borderColor: kids ? '#e8c34d' : theme.border }]}><Text style={[styles.entryTitle, { color: theme.text }]}>{kids ? '准备好开始冒险了吗？' : '先进入棋理，再选择怎么下'}</Text><ActionButton disabled={busy} onPress={() => void run()} theme={theme}>{busy ? '正在进入…' : '游客开始'}</ActionButton><Pressable onPress={() => Alert.alert('账号登录', '原生账号登录仍在接入；这里不会用网页套壳冒充登录。')}><Text style={[styles.loginLink, { color: theme.muted }]}>已有账号？登录</Text></Pressable></View></ScrollView></SafeAreaView>;
}

function AdultWelcome({ theme }: { theme: ProductTheme }) {
  return <View style={styles.adultWelcome}><Text style={[styles.kicker, { color: theme.accent }]}>中国象棋的新玩法</Text><Text style={[styles.welcomeTitle, { color: theme.text }]}>随时下一盘，{`\n`}<Text style={{ color: theme.brand }}>每盘都更懂一点。</Text></Text><Text style={[styles.welcomeBody, { color: theme.muted }]}>1 分钟、3+2 等全新节奏；和电脑或真人对弈，再把关键一步变成进步。</Text><View style={styles.timeConsole}><View style={styles.consoleTop}><Text style={styles.consoleLive}>● LIVE MODE</Text><Text style={styles.consolePool}>快棋</Text></View><View style={styles.consoleClockRow}><Text style={styles.consoleClock}>03:00</Text><Text style={styles.consolePlus}>+2</Text></View><Text style={styles.consoleTitle}>先选模式，再进入棋盘</Text><View style={styles.consoleChips}><Text style={[styles.consoleChip, { backgroundColor: theme.brand }]}>1+0</Text><Text style={[styles.consoleChip, { backgroundColor: theme.accent }]}>3+2</Text><Text style={[styles.consoleChip, { backgroundColor: '#353539' }]}>10+5</Text></View></View></View>;
}

function KidsWelcome({ theme }: { theme: ProductTheme }) {
  return <View style={styles.kidsWelcome}><View style={styles.questRow}><Text style={styles.questLabel}>TODAY'S QUEST · 今日冒险</Text><Text style={styles.questStars}>★ ★ ☆</Text></View><View style={styles.mascotRow}><View style={styles.mascotPiece}><Text style={styles.mascotGlyph}>马</Text></View><View style={styles.speech}><Text style={[styles.speechTitle, { color: theme.text }]}>嗨，小棋手！</Text><Text style={styles.speechBody}>会下棋，也会知道为什么。</Text></View></View><Text style={[styles.kidsWelcomeTitle, { color: theme.text }]}>完整的棋理，{`\n`}变成一场学习冒险。</Text><View style={styles.questPath}><QuestStep glyph="✓" label="认识棋子" done /><View style={styles.questLine} /><QuestStep glyph="2" label="下一盘" /><View style={styles.questLine} /><QuestStep glyph="★" label="复盘成长" /></View></View>;
}

function QuestStep({ glyph, label, done = false }: { glyph: string; label: string; done?: boolean }) { return <View style={styles.questStep}><View style={[styles.questNode, done && styles.questNodeDone]}><Text style={[styles.questGlyph, done && styles.questGlyphDone]}>{glyph}</Text></View><Text style={styles.questStepLabel}>{label}</Text></View>; }

function Home({ kids, session, theme, onNavigate }: { kids: boolean; session: MobileSession; theme: ProductTheme; onNavigate?: (screen: FullScreen) => void }) {
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><Text style={[styles.kicker, { color: kids ? '#2d87a9' : theme.accent }]}>你好，{session.user.displayName}</Text><Text style={[styles.pageTitle, { color: theme.text }]}>{kids ? '今天想下棋，还是学一招？' : '今天，下一盘什么棋？'}</Text><Text style={[styles.pageBody, { color: theme.muted }]}>{kids ? '下棋、学习、挑战和复盘，一个都不少。' : '先选择对手和节奏；只有准备好以后才打开棋盘。'}</Text><Pressable onPress={() => onNavigate?.('play')} style={[styles.heroAction, kids && styles.kidsHeroAction, { backgroundColor: kids ? '#3e9fd0' : theme.brand }]}><Text style={styles.heroTag}>{kids ? 'TODAY QUEST · +1 ★' : 'PLAY'}</Text><Text style={styles.heroTitle}>开始下一盘</Text><Text style={styles.heroBody}>电脑练习 · 真人对弈 · 1 分钟 · 3+2</Text><Text style={styles.heroArrow}>{kids ? '▶' : '→'}</Text></Pressable><View style={styles.cardGrid}><HomeCard kids={kids} color={kids ? '#fff3b5' : theme.accentSoft} glyph="学" title={kids ? '学习乐园' : '课程与训练'} body={kids ? '26 个互动关卡，从棋子朋友开始' : '规则、战术、计算与布局'} onPress={() => onNavigate?.('learn')} theme={theme} /><HomeCard kids={kids} color={kids ? '#dff5e9' : '#e8f5ef'} glyph="复" title="复盘一局" body="看懂关键一步，继续针对训练" onPress={() => onNavigate?.('review')} theme={theme} /></View></ScrollView>;
}

function HomeCard({ kids, color, glyph, title, body, onPress, theme }: { kids: boolean; color: string; glyph: string; title: string; body: string; onPress: () => void; theme: ProductTheme }) { return <Pressable onPress={onPress} style={[styles.homeCard, kids && styles.kidsRaised, { backgroundColor: color, borderColor: kids ? '#d8bd58' : theme.border }]}><Text style={[styles.homeGlyph, { color: theme.text }]}>{glyph}</Text><Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.cardBody, { color: theme.muted }]}>{body}</Text></Pressable>; }

function Play({ kids, session, theme }: { kids: boolean; session: MobileSession; theme: ProductTheme }) {
  const [mode, setMode] = useState<'computer' | 'online' | null>(null);
  if (mode === 'computer') return <ComputerGame kids={kids} session={session} theme={theme} onBack={() => setMode(null)} />;
  if (mode === 'online') return <OnlinePlay kids={kids} session={session} theme={theme} onBack={() => setMode(null)} />;
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><Text style={[styles.pageTitle, { color: theme.text }]}>选择你想怎么下</Text><Text style={[styles.pageBody, { color: theme.muted }]}>选择对手以后，棋盘才会出现。</Text><ModeCard kids={kids} glyph="机" title="和电脑练习" body={kids ? '不怕走错，走完再看看为什么。' : '随时开始，适合热身和练习。'} theme={theme} onPress={() => setMode('computer')} /><ModeCard kids={kids} glyph="友" title="找真人对弈" body="快速匹配，或创建房间邀请棋友。" theme={theme} onPress={() => setMode('online')} /><View style={[styles.infoCard, { backgroundColor: kids ? '#fff6cf' : theme.surface, borderColor: theme.border }]}><Text style={[styles.cardTitle, { color: theme.text }]}>棋理时间模式</Text><Text style={[styles.cardBody, { color: theme.muted }]}>1 分钟、3+2、5 分钟、10 分钟和 15+10。</Text><View style={styles.pillRow}>{timeControls.map((control) => <Text key={control.id} style={[styles.timePill, { borderColor: theme.border, color: theme.text }]}>{control.label}</Text>)}</View></View></ScrollView>;
}

function ModeCard({ kids, glyph, title, body, theme, onPress }: { kids: boolean; glyph: string; title: string; body: string; theme: ProductTheme; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.modeCard, kids && styles.kidsRaised, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}><View style={[styles.modeGlyph, { backgroundColor: kids ? '#e6f6fb' : theme.accentSoft }]}><Text style={[styles.modeGlyphText, { color: kids ? '#287ca9' : theme.accent }]}>{glyph}</Text></View><View style={styles.flex}><Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.cardBody, { color: theme.muted }]}>{body}</Text></View><Text style={[styles.chevron, { color: theme.subtle }]}>›</Text></Pressable>; }

function ComputerGame({ kids, session, theme, onBack }: { kids: boolean; session: MobileSession; theme: ProductTheme; onBack: () => void }) {
  const [board, setBoard] = useState<Board>(() => createInitialBoard());
  const [side, setSide] = useState<PieceColor>('red');
  const [moves, setMoves] = useState<Move[]>([]);
  const [message, setMessage] = useState(kids ? '你执红先走。先看看对方在攻击哪里。' : '红方先行');
  const [thinking, setThinking] = useState(false);
  const gameId = useMemo(() => `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, []);

  const move = async (nextMove: Move) => {
    if (side !== 'red' || thinking) return;
    const afterPlayer = applyMove(board, nextMove).board;
    const nextMoves = [...moves, nextMove];
    setBoard(afterPlayer); setMoves(nextMoves); setSide('black'); setThinking(true); setMessage('电脑正在思考…');
    const afterPlayerStatus = gameStatus(afterPlayer, 'black');
    if (afterPlayerStatus.over) { setThinking(false); setMessage('你赢了！'); void saveComputerGame(session.accountToken, { id: gameId, moves: nextMoves, winner: afterPlayerStatus.winner ?? null }); return; }
    let reply: Move | null = null;
    try { const result = await analyzePosition(session.accountToken, afterPlayer, 'black'); reply = result.lines?.[0]?.move ? uciToMove(result.lines[0].move, afterPlayer) : null; } catch { reply = generateLegalMoves(afterPlayer, 'black')[0] ?? null; }
    if (!reply) { setThinking(false); setMessage('你赢了！'); return; }
    const finalBoard = applyMove(afterPlayer, reply).board;
    const finalMoves = [...nextMoves, reply];
    setBoard(finalBoard); setMoves(finalMoves); setSide('red'); setThinking(false);
    const status = gameStatus(finalBoard, 'red');
    setMessage(status.over ? '对局结束。' : (kids ? '轮到你了。慢慢看，再走一步。' : '轮到红方'));
    if (status.over) void saveComputerGame(session.accountToken, { id: gameId, moves: finalMoves, winner: status.winner ?? null });
  };

  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><Back onPress={onBack} theme={theme} /><View style={styles.gameHeading}><View><Text style={[styles.cardTitle, { color: theme.text }]}>电脑 · 入门</Text><Text style={[styles.cardBody, { color: theme.muted }]}>{message}</Text></View><Text style={[styles.turnPill, { backgroundColor: kids ? '#fff3b5' : theme.accentSoft, color: theme.text }]}>{thinking ? '思考中' : side === 'red' ? '轮到你' : '电脑回合'}</Text></View><XiangqiBoard cute={kids} interactive={!thinking && side === 'red'} onMoveIntent={(intent) => void move(intent)} position={board} sideToMove="red" tone={kids ? 'kids' : 'adult'} /><ActionButton onPress={() => { setBoard(createInitialBoard()); setMoves([]); setSide('red'); setMessage('红方先行'); }} theme={theme} tone="quiet">重新开始</ActionButton></ScrollView>;
}

function OnlinePlay({ kids, session, theme, onBack }: { kids: boolean; session: MobileSession; theme: ProductTheme; onBack: () => void }) {
  const [selected, setSelected] = useState<(typeof timeControls)[number]>(timeControls[1]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('快速匹配，或创建私人房间。');
  const [ticket, setTicket] = useState<string | null>(null);
  const [access, setAccess] = useState<RoomAccess | null>(null);

  useEffect(() => {
    if (!ticket || access) return undefined;
    const timer = setInterval(() => pollMatch(session.accountToken, ticket).then(async (result) => {
      if (result.status !== 'matched' || !result.roomId || !result.playerToken || !result.color) return;
      const state = await getRoom(session.accountToken, result.roomId, result.playerToken);
      setAccess({ room: state.room, playerToken: result.playerToken, color: result.color }); setTicket(null);
    }).catch((error) => setMessage(error instanceof Error ? error.message : '匹配失败')), 1500);
    return () => clearInterval(timer);
  }, [ticket, access, session.accountToken]);

  if (access) return <RoomGame access={access} kids={kids} session={session} theme={theme} onBack={() => setAccess(null)} />;
  const timeControl = { baseSeconds: selected.initialSeconds, incrementSeconds: selected.incrementSeconds };
  const match = async () => { setBusy(true); setMessage('正在寻找棋友…'); try { const result = await startMatch(session.accountToken, session.user.displayName, timeControl); if (result.status === 'matched' && result.roomId && result.playerToken && result.color) { const state = await getRoom(session.accountToken, result.roomId, result.playerToken); setAccess({ room: state.room, playerToken: result.playerToken, color: result.color }); } else setTicket(result.ticketId); } catch (error) { setMessage(error instanceof Error ? error.message : '匹配失败'); } finally { setBusy(false); } };
  const makeRoom = async () => { setBusy(true); try { setAccess(await createRoom(session.accountToken, session.user.displayName, timeControl)); } catch (error) { setMessage(error instanceof Error ? error.message : '创建失败'); } finally { setBusy(false); } };
  const join = async () => { setBusy(true); try { setAccess(await joinRoom(session.accountToken, code.trim().toUpperCase(), session.user.displayName)); } catch (error) { setMessage(error instanceof Error ? error.message : '加入失败'); } finally { setBusy(false); } };
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><Back onPress={onBack} theme={theme} /><Text style={[styles.pageTitle, { color: theme.text }]}>真人对弈</Text><Text style={[styles.pageBody, { color: theme.muted }]}>{ticket ? '匹配中，请稍候…' : message}</Text><View style={styles.timeGrid}>{timeControls.map((control) => <Pressable key={control.id} onPress={() => setSelected(control)} style={[styles.timeChoice, { backgroundColor: selected.id === control.id ? theme.accentSoft : theme.surface, borderColor: selected.id === control.id ? theme.accent : theme.border }]}><Text style={[styles.timeChoiceText, { color: theme.text }]}>{control.label}</Text></Pressable>)}</View><ActionButton disabled={busy || Boolean(ticket)} onPress={() => void match()} theme={theme}>{ticket ? '匹配中…' : `快速匹配 · ${selected.label}`}</ActionButton><ActionButton disabled={busy} onPress={() => void makeRoom()} theme={theme} tone="quiet">创建私人房间</ActionButton><View style={[styles.joinRow, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}><TextInput autoCapitalize="characters" onChangeText={setCode} placeholder="输入房间码" placeholderTextColor={theme.subtle} style={[styles.joinInput, { color: theme.text }]} value={code} /><Pressable disabled={!code.trim() || busy} onPress={() => void join()}><Text style={[styles.joinButton, { color: theme.brand }]}>加入</Text></Pressable></View></ScrollView>;
}

function RoomGame({ access, kids, session, theme, onBack }: { access: RoomAccess; kids: boolean; session: MobileSession; theme: ProductTheme; onBack: () => void }) {
  const [room, setRoom] = useState<OnlineRoom>(access.room);
  const [message, setMessage] = useState(room.status === 'waiting' ? '等待棋友加入…' : '对局开始');
  useEffect(() => { const timer = setInterval(() => getRoom(session.accountToken, room.id, access.playerToken).then((result) => setRoom(result.room)).catch(() => {}), 1200); return () => clearInterval(timer); }, [room.id, access.playerToken, session.accountToken]);
  const myTurn = room.status === 'active' && room.currentTurn === access.color;
  const move = async (intent: Move) => { try { const result = await roomAction(session.accountToken, room.id, access.playerToken, { type: 'move', move: intent }); setRoom(result.room); } catch (error) { setMessage(error instanceof Error ? error.message : '走棋失败'); } };
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><Back onPress={onBack} theme={theme} /><View style={styles.gameHeading}><View><Text style={[styles.cardTitle, { color: theme.text }]}>{room.players.red?.name || '红方'} 对 {room.players.black?.name || '等待加入'}</Text><Text style={[styles.cardBody, { color: theme.muted }]}>{room.result ? '对局已结束' : message}</Text></View><Text style={[styles.turnPill, { backgroundColor: theme.accentSoft, color: theme.text }]}>{room.status === 'waiting' ? '等待' : myTurn ? '轮到你' : '对方回合'}</Text></View><View style={styles.clockRow}><Clock label={room.players.black?.name || '黑方'} ms={room.clocks.blackMs} theme={theme} /><Clock label={room.players.red?.name || '红方'} ms={room.clocks.redMs} theme={theme} /></View><XiangqiBoard cute={kids} interactive={myTurn} onMoveIntent={(intent) => void move(intent)} position={room.board} sideToMove={access.color} tone={kids ? 'kids' : 'adult'} />{room.status === 'waiting' ? <View style={[styles.roomCodeCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}><Text style={[styles.cardTitle, { color: theme.text }]}>把房间码发给棋友</Text><Text selectable style={[styles.roomCode, { color: theme.brand }]}>{room.id}</Text></View> : <ActionButton onPress={() => Alert.alert('确认认输？', '本局会立即结束。', [{ text: '继续下', style: 'cancel' }, { text: '认输', style: 'destructive', onPress: () => void roomAction(session.accountToken, room.id, access.playerToken, { type: 'resign' }).then((result) => setRoom(result.room)) }])} theme={theme} tone="quiet">认输</ActionButton>}</ScrollView>;
}

function Clock({ label, ms, theme }: { label: string; ms: number; theme: ProductTheme }) { const seconds = Math.max(0, Math.ceil(ms / 1000)); return <View style={[styles.clockCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}><Text style={[styles.clockLabel, { color: theme.muted }]}>{label}</Text><Text style={[styles.clockValue, { color: theme.text }]}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</Text></View>; }

function Review({ session, theme, onPlay }: { session: MobileSession; theme: ProductTheme; onPlay: () => void }) {
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HistoryGame | null>(null);
  useEffect(() => { loadGames(session.accountToken).then((result) => setGames(result.games)).catch((reason) => setError(reason instanceof Error ? reason.message : '暂时无法读取棋谱。')).finally(() => setLoading(false)); }, [session.accountToken]);
  if (selected) return <GameReplay game={selected} onBack={() => setSelected(null)} theme={theme} />;
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><Text style={[styles.pageTitle, { color: theme.text }]}>复盘与分析</Text><Text style={[styles.pageBody, { color: theme.muted }]}>逐手回放棋谱，再把关键问题带回训练。</Text>{loading ? <ActivityIndicator color={theme.brand} /> : games.length ? games.map((game) => <Pressable key={game.id} onPress={() => setSelected(game)} style={[styles.gameRow, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}><View style={styles.flex}><Text style={[styles.cardTitle, { color: theme.text }]}>对 {game.opponent}</Text><Text style={[styles.cardBody, { color: theme.muted }]}>{game.source === 'online' ? '真人对局' : '电脑对局'} · {game.moves.length} 手</Text></View><Text style={[styles.chevron, { color: theme.subtle }]}>›</Text></Pressable>) : <View style={[styles.emptyCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}><Text style={[styles.emptyGlyph, { color: theme.accent }]}>复</Text><Text style={[styles.cardTitle, { color: theme.text }]}>{error ? '棋谱暂时没有连上' : '还没有可复盘的棋'}</Text><Text style={[styles.cardBody, { color: theme.muted }]}>{error ?? '完成一盘电脑或真人对局后，棋谱会出现在这里。'}</Text><ActionButton onPress={onPlay} theme={theme}>去下一盘</ActionButton></View>}</ScrollView>;
}

function GameReplay({ game, theme, onBack }: { game: HistoryGame; theme: ProductTheme; onBack: () => void }) {
  const [ply, setPly] = useState(0);
  const board = useMemo(() => { let next = createInitialBoard(); for (let index = 0; index < ply; index += 1) { const raw = game.moves[index]; const move = 'move' in raw ? raw.move : raw; try { next = applyMove(next, move).board; } catch { break; } } return next; }, [game, ply]);
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><Back onPress={onBack} theme={theme} /><Text style={[styles.pageTitle, { color: theme.text }]}>对 {game.opponent}</Text><Text style={[styles.pageBody, { color: theme.muted }]}>第 {ply} / {game.moves.length} 手</Text><XiangqiBoard interactive={false} position={board} tone={theme.kind} /><View style={styles.replayControls}><ActionButton compact disabled={ply === 0} onPress={() => setPly((value) => Math.max(0, value - 1))} theme={theme} tone="quiet">上一步</ActionButton><ActionButton compact disabled={ply === game.moves.length} onPress={() => setPly((value) => Math.min(game.moves.length, value + 1))} theme={theme}>下一步</ActionButton></View></ScrollView>;
}

function Profile({ kids, session, theme, onLogout }: { kids: boolean; session: MobileSession; theme: ProductTheme; onLogout: () => void }) { return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={[styles.profileHero, { backgroundColor: kids ? '#3e9fd0' : '#1d1d20' }]}><View style={[styles.avatar, { backgroundColor: theme.brand }]}><Text style={styles.avatarText}>{session.user.displayName.slice(0, 1)}</Text></View><Text style={styles.profileName}>{session.user.displayName}</Text><Text style={styles.profileMeta}>{kids ? '正在成长的小棋手' : '游客棋手'}</Text></View><View style={styles.cardGrid}><Stat theme={theme} value="0" label={kids ? '学习星星' : '对局'} /><Stat theme={theme} value="—" label={kids ? '连续学习' : '等级分'} /></View><View style={[styles.infoCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}><Text style={[styles.cardTitle, { color: theme.text }]}>账号与进度</Text><Text style={[styles.cardBody, { color: theme.muted }]}>当前为服务器游客身份；正式账号登录和跨设备同步仍需发布前接入。</Text></View><ActionButton onPress={onLogout} theme={theme} tone="quiet">退出游客身份</ActionButton></ScrollView>; }

function Stat({ value, label, theme }: { value: string; label: string; theme: ProductTheme }) { return <View style={[styles.stat, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}><Text style={[styles.statValue, { color: theme.text }]}>{value}</Text><Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text></View>; }
function Back({ onPress, theme }: { onPress: () => void; theme: ProductTheme }) { return <Pressable hitSlop={10} onPress={onPress} style={styles.back}><Text style={[styles.backText, { color: theme.text }]}>‹ 返回选择</Text></Pressable>; }

const styles = StyleSheet.create({
  safe: { flex: 1 }, screen: { flex: 1 }, loading: { alignItems: 'center', flex: 1, justifyContent: 'center' }, flex: { flex: 1 }, content: { gap: 14, paddingBottom: space.xxl, paddingHorizontal: space.md, paddingTop: space.xs }, welcome: { gap: 20, paddingBottom: 44, paddingHorizontal: 6 }, guestLabel: { fontSize: 11, fontWeight: '800' }, starPill: { backgroundColor: '#f4c84f', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 }, starText: { color: '#634b08', fontSize: 11, fontWeight: '900' },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, welcomeTitle: { fontSize: 40, fontWeight: '900', letterSpacing: -2.2, lineHeight: 48 }, welcomeBody: { fontSize: 15, lineHeight: 24 }, adultWelcome: { gap: 14, paddingHorizontal: 16 }, timeConsole: { backgroundColor: '#1d1d20', borderRadius: 23, minHeight: 250, padding: 20 }, consoleTop: { flexDirection: 'row', justifyContent: 'space-between' }, consoleLive: { color: '#a99bff', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, consolePool: { color: '#8e8e94', fontSize: 9, fontWeight: '800' }, consoleClockRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, marginTop: 30 }, consoleClock: { color: '#fff', fontSize: 46, fontWeight: '900', letterSpacing: -2 }, consolePlus: { backgroundColor: '#7357ff', borderRadius: 999, color: '#fff', fontSize: 12, fontWeight: '900', marginTop: 7, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5 }, consoleTitle: { color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 8 }, consoleChips: { bottom: 18, flexDirection: 'row', gap: 7, position: 'absolute', right: 18 }, consoleChip: { borderRadius: 8, color: '#fff', fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 7 },
  kidsWelcome: { backgroundColor: '#67c3e5', borderColor: '#2f91bd', borderRadius: 28, borderWidth: 2, gap: 16, marginHorizontal: 16, minHeight: 385, padding: 20, shadowColor: '#2581aa', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 1, shadowRadius: 0 }, questRow: { flexDirection: 'row', justifyContent: 'space-between' }, questLabel: { color: '#175b7a', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, questStars: { color: '#ffe05d', fontSize: 14, fontWeight: '900' }, mascotRow: { alignItems: 'center', flexDirection: 'row', gap: 12 }, mascotPiece: { alignItems: 'center', backgroundColor: '#fff3d1', borderColor: '#e95249', borderRadius: 36, borderWidth: 5, height: 72, justifyContent: 'center', shadowColor: '#bc3934', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0, width: 72 }, mascotGlyph: { color: '#d13d36', fontSize: 30, fontWeight: '900' }, speech: { backgroundColor: '#ffffffe8', borderRadius: 17, flex: 1, padding: 13 }, speechTitle: { fontSize: 15, fontWeight: '900' }, speechBody: { color: '#4b6e80', fontSize: 11, fontWeight: '700', marginTop: 4 }, kidsWelcomeTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -1.1, lineHeight: 36 }, questPath: { alignItems: 'flex-start', backgroundColor: '#ffffff38', borderRadius: 17, flexDirection: 'row', justifyContent: 'center', paddingVertical: 13 }, questStep: { alignItems: 'center', width: 75 }, questNode: { alignItems: 'center', backgroundColor: '#fff8e6', borderColor: '#fff', borderRadius: 20, borderWidth: 3, height: 40, justifyContent: 'center', width: 40 }, questNodeDone: { backgroundColor: '#38aa74', borderColor: '#c9f5dd' }, questGlyph: { color: '#745e1d', fontSize: 13, fontWeight: '900' }, questGlyphDone: { color: '#fff' }, questStepLabel: { color: '#174e68', fontSize: 8, fontWeight: '900', marginTop: 6 }, questLine: { backgroundColor: '#ffffffa0', height: 4, marginHorizontal: -10, marginTop: 18, width: 23 },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 16 }, featureChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }, featureText: { fontSize: 11, fontWeight: '800' }, entryCard: { borderRadius: radius.lg, borderWidth: 1, gap: 13, marginHorizontal: 16, padding: 18 }, kidsEntryCard: { borderWidth: 2, shadowColor: '#c99b18', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 0 }, entryTitle: { fontSize: 17, fontWeight: '900' }, loginLink: { fontSize: 12, fontWeight: '700', padding: 4, textAlign: 'center' },
  pageTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 37 }, pageBody: { fontSize: 14, lineHeight: 22, marginTop: -7 }, heroAction: { borderRadius: 24, minHeight: 185, overflow: 'hidden', padding: 21, position: 'relative' }, kidsHeroAction: { borderColor: '#267fa7', borderWidth: 2, shadowColor: '#267fa7', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 1, shadowRadius: 0 }, heroTag: { color: '#ffffffb9', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, heroTitle: { color: '#fff', fontSize: 27, fontWeight: '900', marginTop: 24 }, heroBody: { color: '#ffffffd2', fontSize: 12, fontWeight: '700', marginTop: 7 }, heroArrow: { bottom: 15, color: '#ffe05d', fontSize: 36, position: 'absolute', right: 21 }, cardGrid: { flexDirection: 'row', gap: 11 }, homeCard: { borderRadius: 20, borderWidth: 1, flex: 1, minHeight: 165, padding: 15 }, kidsRaised: { borderWidth: 2, shadowColor: '#b99028', shadowOffset: { width: 0, height: 5 }, shadowOpacity: .6, shadowRadius: 0 }, homeGlyph: { fontSize: 27, fontWeight: '900', marginBottom: 18 }, cardTitle: { fontSize: 16, fontWeight: '900', lineHeight: 22 }, cardBody: { fontSize: 12, lineHeight: 19, marginTop: 4 },
  modeCard: { alignItems: 'center', borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 13, minHeight: 112, padding: 15 }, modeGlyph: { alignItems: 'center', borderRadius: 17, height: 64, justifyContent: 'center', width: 64 }, modeGlyphText: { fontSize: 27, fontWeight: '900' }, chevron: { fontSize: 29 }, infoCard: { borderRadius: 19, borderWidth: 1, padding: 17 }, pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }, timePill: { borderRadius: 999, borderWidth: 1, fontSize: 10, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6 }, back: { alignSelf: 'flex-start', paddingBottom: 5, paddingTop: 2 }, backText: { fontSize: 13, fontWeight: '900' }, gameHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, turnPill: { borderRadius: 999, fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 7 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, timeChoice: { borderRadius: 13, borderWidth: 1.5, padding: 12, width: '31%' }, timeChoiceText: { fontSize: 14, fontWeight: '900' }, joinRow: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', minHeight: 52, paddingHorizontal: 13 }, joinInput: { flex: 1, fontSize: 14 }, joinButton: { fontSize: 13, fontWeight: '900', padding: 8 }, clockRow: { flexDirection: 'row', gap: 8 }, clockCard: { borderRadius: 13, borderWidth: 1, flex: 1, padding: 11 }, clockLabel: { fontSize: 9, fontWeight: '700' }, clockValue: { fontSize: 20, fontWeight: '900', marginTop: 2 }, roomCodeCard: { alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 18 }, roomCode: { fontSize: 27, fontWeight: '900', letterSpacing: 3, marginTop: 9 },
  gameRow: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', padding: 14 }, emptyCard: { alignItems: 'center', borderRadius: 20, borderWidth: 1, gap: 8, padding: 25 }, emptyGlyph: { fontSize: 36, fontWeight: '900' }, replayControls: { flexDirection: 'row', gap: 9 }, profileHero: { alignItems: 'center', borderRadius: 24, padding: 26 }, avatar: { alignItems: 'center', borderRadius: 20, height: 70, justifyContent: 'center', width: 70 }, avatarText: { color: '#fff', fontSize: 29, fontWeight: '900' }, profileName: { color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 11 }, profileMeta: { color: '#ffffffa7', fontSize: 11, marginTop: 4 }, stat: { alignItems: 'center', borderRadius: 17, borderWidth: 1, flex: 1, padding: 17 }, statValue: { fontSize: 23, fontWeight: '900' }, statLabel: { fontSize: 10, marginTop: 3 },
});
