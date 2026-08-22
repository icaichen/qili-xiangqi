export type KidsPieceColor = 'red' | 'black';
export type KidsPieceType = 'rook' | 'horse' | 'elephant' | 'advisor' | 'general' | 'cannon' | 'pawn';
export type KidsPosition = readonly [row: number, col: number];
export type KidsMove = readonly [fromRow: number, fromCol: number, toRow: number, toCol: number];
export type KidsBoardPiece = readonly [row: number, col: number, type: KidsPieceType, color: KidsPieceColor];
export type KidsLessonMode = 'piece-tour' | 'identify-sequence' | 'zone' | 'identify' | 'move' | 'mini-game';

export type KidsChapter = {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly adultStageIds: readonly string[];
  readonly lessonStart: number;
  readonly lessonCount: number;
  readonly conceptIds: readonly string[];
};

export type AdultLearnStage = {
  readonly id: string;
  readonly order: number;
  readonly legacyLevel: number;
  readonly title: string;
  readonly summary: string;
  readonly previewLessons: readonly string[];
  readonly goals: readonly string[];
};

export type KidsPlayableLesson = {
  readonly id: string;
  readonly lessonIndex: number;
  readonly chapterId: string;
  readonly chapterOrder: number;
  readonly chapterLessonIndex: number;
  readonly conceptId: string;
  readonly icon: string;
  readonly title: string;
  readonly subtitle: string;
  readonly prompt: string;
  readonly tip: string;
  readonly success: string;
  readonly failure?: string;
  readonly mode: KidsLessonMode;
  readonly pieces: readonly KidsBoardPiece[];
  readonly legal?: boolean;
  readonly finale?: boolean;
  readonly verifyCheck?: boolean;
  readonly verifyMate?: boolean;
  readonly expected?: KidsMove;
  readonly expectedMoves?: readonly KidsMove[];
  readonly identify?: KidsPosition;
  readonly autoReply?: KidsMove;
  readonly zone?: Readonly<{ minRow: number; maxRow: number; minCol: number; maxCol: number }>;
  readonly piecesToMeet?: readonly Readonly<{
    type: KidsPieceType;
    at: KidsPosition;
    twinAt: KidsPosition;
    label: string;
    blackLabel: string;
    name: string;
    job: string;
    prompt: string;
    hint: string;
  }>[];
  readonly sequence?: readonly Readonly<{
    at: KidsPosition;
    name: string;
    prompt: string;
    hint: string;
  }>[];
};

export const KIDS_PIECE_COLORS: Readonly<{ RED: 'red'; BLACK: 'black' }>;
export const KIDS_CHAPTERS: readonly KidsChapter[];
export const KIDS_PLAYABLE_LESSONS: readonly KidsPlayableLesson[];
export const QILI_CURRICULUM_STAGES: readonly unknown[];
export const ADULT_LEARN_STAGES: readonly AdultLearnStage[];
export const XIANGQI_BEGINNER_CURRICULUM: Readonly<Record<string, unknown>>;
