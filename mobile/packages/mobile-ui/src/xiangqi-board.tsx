import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { applyMove, createInitialBoard, LABELS, legalMovesForPiece, type Board, type Move, type PieceColor, type PieceType } from '@qili/xiangqi-core';

type Selection = { row: number; col: number } | null;
type InitialPiece = readonly [row: number, col: number, type: PieceType, color: PieceColor];
type Props = {
  cute?: boolean;
  highlight?: readonly [row: number, col: number];
  initialPieces?: readonly InitialPiece[];
  interactive?: boolean;
  instruction?: string;
  onInteract?: () => void;
  onMove?: (move: Move) => void;
  onMoveIntent?: (move: Move) => void;
  onPointPress?: (row: number, col: number) => void;
  position?: Board;
  selectionOnly?: boolean;
  sideToMove?: PieceColor;
  tone?: 'adult' | 'kids';
};
const ROWS = Array.from({ length: 10 }, (_, index) => index);
const COLS = Array.from({ length: 9 }, (_, index) => index);

export function XiangqiBoard({ cute = false, highlight, initialPieces, interactive = true, instruction, onInteract, onMove, onMoveIntent, onPointPress, position, selectionOnly = false, sideToMove, tone = cute ? 'kids' : 'adult' }: Props) {
  const { width } = useWindowDimensions();
  const frameWidth = Math.min(width - 32, 430);
  const boardWidth = frameWidth - 18;
  const boardHeight = boardWidth * 9 / 8;
  const xStep = boardWidth / 8;
  const yStep = boardHeight / 9;
  const pieceSize = Math.min(xStep * 0.82, 39);
  const [localBoard, setLocalBoard] = useState<Board>(() => initialPieces ? createLessonBoard(initialPieces) : createInitialBoard());
  const [selected, setSelected] = useState<Selection>(null);
  const [localSideToMove, setLocalSideToMove] = useState<PieceColor>('red');
  const board = position ?? localBoard;
  const activeSide = sideToMove ?? localSideToMove;
  const moves = useMemo(() => selected ? legalMovesForPiece(board, selected.row, selected.col) : [], [board, selected]);
  const isKids = tone === 'kids';
  const moveAt = (row: number, col: number) => moves.find((move) => move.toRow === row && move.toCol === col);

  const handlePoint = (row: number, col: number) => {
    if (!interactive) return;
    onPointPress?.(row, col);
    onInteract?.();
    if (selectionOnly) return;
    const move = moveAt(row, col);
    if (move) {
      setSelected(null);
      if (position) {
        onMoveIntent?.(move);
        return;
      }
      setLocalBoard((current) => applyMove(current, move).board);
      setLocalSideToMove((current) => current === 'red' ? 'black' : 'red');
      onMove?.(move);
      return;
    }
    const candidate = board[row][col];
    if (!candidate || candidate.color !== activeSide) {
      setSelected(null);
      return;
    }
    setSelected({ row, col });
  };

  return (
    <View style={[styles.frame, isKids ? styles.kidsFrame : styles.adultFrame, { width: frameWidth }]}>
      {instruction ? <View style={styles.instructionRow}><View style={[styles.turnDot, { backgroundColor: activeSide === 'red' ? '#da4940' : '#252d37' }]} /><Text style={[styles.instruction, isKids ? styles.kidsInstruction : styles.adultInstruction]}>{instruction}</Text></View> : null}
      <View accessibilityLabel={`中国象棋棋盘，十横九路，轮到${activeSide === 'red' ? '红方' : '黑方'}`} style={[styles.board, isKids ? styles.kidsBoard : styles.adultBoard, { height: boardHeight, marginBottom: pieceSize / 2, marginTop: pieceSize + 6, width: boardWidth }]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {ROWS.map((row) => <View key={`h-${row}`} style={[styles.horizontalLine, isKids ? styles.kidsLine : styles.adultLine, { top: row * yStep }]} />)}
          {COLS.map((col) => <View key={`v-${col}`} style={StyleSheet.absoluteFill}>
            <View style={[styles.verticalLine, isKids ? styles.kidsLine : styles.adultLine, { height: yStep * 4, left: col * xStep, top: 0 }]} />
            <View style={[styles.verticalLine, isKids ? styles.kidsLine : styles.adultLine, { bottom: 0, height: yStep * 4, left: col * xStep }]} />
            {(col === 0 || col === 8) && <View style={[styles.verticalLine, isKids ? styles.kidsLine : styles.adultLine, { height: boardHeight, left: col * xStep, top: 0 }]} />}
          </View>)}
          <PalaceLines xStep={xStep} yStep={yStep} kids={isKids} />
        </View>
        <View pointerEvents="none" style={[styles.river, { height: yStep, top: yStep * 4 }]}><Text style={[styles.riverText, isKids ? styles.kidsRiverText : styles.adultRiverText]}>楚 河　　汉 界</Text></View>
        {board.map((rowItems, row) => rowItems.map((piece, col) => {
          const isSelected = selected?.row === row && selected.col === col;
          const canMove = Boolean(moveAt(row, col));
          const touchWidth = Math.max(44, xStep);
          const touchHeight = Math.max(44, yStep);
          const isHighlighted = highlight?.[0] === row && highlight?.[1] === col;
          return <Pressable accessibilityLabel={piece ? `${piece.color === 'red' ? '红方' : '黑方'}${piece.label}，第${row + 1}横第${col + 1}路` : `空交叉点，第${row + 1}横第${col + 1}路`} accessibilityRole="button" disabled={!interactive} hitSlop={3} key={`${row}-${col}`} onPress={() => handlePoint(row, col)} style={[styles.point, { height: touchHeight, left: col * xStep - touchWidth / 2, top: row * yStep - touchHeight / 2, width: touchWidth }]}>
            {isHighlighted && <View style={styles.highlightRing} />}
            {canMove && <View style={[styles.moveDot, isKids && styles.kidsMoveDot, piece && styles.captureRing]} />}
            {piece && <View style={[styles.piece, isKids ? styles.kidsPiece : styles.adultPiece, piece.color === 'red' ? styles.redPiece : styles.blackPiece, { height: pieceSize, width: pieceSize }, isSelected && (isKids ? styles.kidsSelected : styles.adultSelected)]}><Text allowFontScaling={false} style={[styles.pieceText, { fontSize: Math.max(15, pieceSize * 0.47) }, piece.color === 'red' ? styles.redText : styles.blackText]}>{piece.label}</Text></View>}
          </Pressable>;
        }))}
      </View>
    </View>
  );
}

function createLessonBoard(pieces: readonly InitialPiece[]): Board {
  const board: Board = Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null));
  for (const [row, col, type, color] of pieces) board[row][col] = { type, color, label: LABELS[color][type] };
  return board;
}

function PalaceLines({ xStep, yStep, kids }: { xStep: number; yStep: number; kids: boolean }) {
  const width = Math.sqrt((xStep * 2) ** 2 + (yStep * 2) ** 2);
  const angle = Math.atan2(yStep * 2, xStep * 2) * 180 / Math.PI;
  const positions = [{ top: 0, rotate: angle }, { top: yStep * 2, rotate: -angle }, { top: yStep * 7, rotate: angle }, { top: yStep * 9, rotate: -angle }];
  return <>{positions.map((item, index) => <View key={index} style={[styles.palaceLine, kids ? styles.kidsLine : styles.adultLine, { left: xStep * 3, top: item.top, transform: [{ rotate: `${item.rotate}deg` }], width }]} />)}</>;
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', borderRadius: 16, padding: 9 }, adultFrame: { backgroundColor: '#151c25', borderColor: '#2a333e', borderWidth: 1 }, kidsFrame: { backgroundColor: '#e8a75d', borderColor: '#a86637', borderWidth: 2, shadowColor: '#8a5b35', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.34, shadowRadius: 0 },
  instructionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', minHeight: 34, paddingHorizontal: 7 }, turnDot: { borderColor: '#ffffff80', borderRadius: 99, borderWidth: 1, height: 9, marginRight: 7, width: 9 }, instruction: { fontSize: 12, fontWeight: '800' }, adultInstruction: { color: '#c0c5cc' }, kidsInstruction: { color: '#643c20', fontSize: 13 },
  board: { alignSelf: 'center', position: 'relative' }, adultBoard: { backgroundColor: '#c99c5b' }, kidsBoard: { backgroundColor: '#f3cf8b' }, horizontalLine: { height: 1, left: 0, position: 'absolute', right: 0 }, verticalLine: { position: 'absolute', width: 1 }, adultLine: { backgroundColor: '#503a24' }, kidsLine: { backgroundColor: '#85542e' }, palaceLine: { height: 1, position: 'absolute', transformOrigin: 'left center' },
  river: { alignItems: 'center', justifyContent: 'center', left: 1, position: 'absolute', right: 1 }, riverText: { fontSize: 12, fontWeight: '900', letterSpacing: 2, paddingHorizontal: 12 }, adultRiverText: { backgroundColor: '#c99c5b', color: '#4c3721' }, kidsRiverText: { backgroundColor: '#f3cf8b', color: '#76502d' },
  point: { alignItems: 'center', justifyContent: 'center', position: 'absolute' }, piece: { alignItems: 'center', borderRadius: 99, borderWidth: 2, justifyContent: 'center' }, adultPiece: { backgroundColor: '#ede2c8', shadowColor: '#312418', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.28, shadowRadius: 1 }, kidsPiece: { backgroundColor: '#fff7df', borderWidth: 2.5, shadowColor: '#684326', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.28, shadowRadius: 0 }, redPiece: { borderColor: '#c93e35' }, blackPiece: { borderColor: '#29333d' }, pieceText: { fontWeight: '900' }, redText: { color: '#bd332c' }, blackText: { color: '#202a32' }, adultSelected: { backgroundColor: '#f7d877', borderColor: '#fff0ae', transform: [{ scale: 1.1 }] }, kidsSelected: { backgroundColor: '#fff176', borderColor: '#e64e45', transform: [{ scale: 1.1 }] },
  moveDot: { backgroundColor: '#3a9b72', borderColor: '#d7f5e8', borderRadius: 99, borderWidth: 1, height: 11, width: 11 }, kidsMoveDot: { backgroundColor: '#e95249', borderColor: '#fff7df', height: 13, width: 13 }, captureRing: { backgroundColor: 'transparent', borderColor: '#e95249', borderWidth: 3, height: 35, position: 'absolute', width: 35 }, highlightRing: { backgroundColor: '#fff17870', borderColor: '#f15a4f', borderRadius: 99, borderWidth: 3, height: 46, position: 'absolute', width: 46 },
});
