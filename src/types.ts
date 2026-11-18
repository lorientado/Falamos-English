export type AgeTrack = '7-9' | '10-14';
export type CefrLevel = 'A1' | 'A2';

export type SituationId =
  | 'home'
  | 'school'
  | 'cafe'
  | 'routine'
  | 'town'
  | 'doctor'
  | 'travel';

export type MainTab = 'inicio' | 'explorar' | 'estudar' | 'conversa' | 'sala' | 'informe';

export interface HouseRoom {
  id: string;
  nameEn: string;
  nameGl: string;
  bounds: [number, number, number, number]; // [x1, z1, x2, z2]
  floorColor: string;
  clueGl: string;
}

export interface VocabItem {
  id: string;
  situation: SituationId;
  word: string;
  article: string;
  gl: string;
  phoneticHint: string;
  clueEn: string;
  clueGl: string;
  exampleEn: string;
  exampleGl: string;
  gapSentenceEn: string; // sentence with ____ replacing target word
  level: CefrLevel;
  trackMin: AgeTrack;
  variants?: string[];
  roomId?: string; // primary room in 'home' or zone id
  plausibleRooms?: string[]; // accepted rooms in classification puzzle
  position: [number, number, number];
  rotationY?: number;
  modelType: string;
}

export interface GuidedDialogueStep {
  id: string;
  speakerPromptEn: string;
  speakerPromptGl: string;
  options: {
    textEn: string;
    isCorrect: boolean;
    feedbackGl: string;
  }[];
}

export interface SituationMeta {
  id: SituationId;
  titleEn: string;
  titleGl: string;
  level: CefrLevel;
  trackMin: AgeTrack;
  summaryGl: string;
  roleEn: string;
  roleTitleGl: string;
  missionsGl: string[];
  starterPhrases: { en: string; gl: string }[];
  guidedDialogue: GuidedDialogueStep[];
}

export interface LeitnerCardState {
  box: number; // 1..5
  dueAt: number; // epoch ms
  lastReviewedAt?: number;
  correctCount: number;
  wrongCount: number;
}

export interface SavedFlashcard {
  id: string;
  situation: SituationId;
  incorrect: string;
  correct: string;
  explanation: string;
  createdAt: string;
}

export interface AnswerCheckResult {
  kind: 'exact' | 'variant' | 'close' | 'article' | 'other_word' | 'wrong';
  accepted: boolean;
  expected: string;
  noteGl?: string;
  otherWord?: string;
}

export type EscapeStep =
  | {
      type: 'pick3d';
      promptGl: string;
      promptEn: string;
      targetId: string;
      hintsGl: [string, string];
    }
  | {
      type: 'writeEn';
      promptGl: string;
      targetIds: string[];
      hintsGl: [string, string];
    }
  | {
      type: 'definition';
      promptGl: string;
      items: { clueEn: string; clueGl: string; targetId: string }[];
      hintsGl: [string, string];
    }
  | {
      type: 'classify';
      promptGl: string;
      items: { itemId: string; targetRoomId: string }[];
      hintsGl: [string, string];
    }
  | {
      type: 'roomName';
      promptGl: string;
      targetRoomId: string;
      hintsGl: [string, string];
    }
  | {
      type: 'final';
      promptGl: string;
      targetItemId: string;
      targetRoomId: string;
      hintsGl: [string, string];
    };

export interface EscapeStage {
  id: string;
  titleGl: string;
  roomId: string;
  storyGl: string;
  clueFragmentGl: string;
  steps: EscapeStep[];
}

export interface EscapeRoomState {
  startedAt: string | null;
  finished: boolean;
  stageIndex: number;
  stepIndex: number;
  activeMs: number;
  penaltyMs: number;
  stageTimesMs: Record<number, number>;
  hintsUsed: Record<number, number>;
  errors: Record<number, number>;
  stageStatuses: Record<number, 'cleared' | 'with_hints' | 'with_solution' | 'skipped'>;
  collectedClues: string[];
  wordResults: Record<string, 'no_hints' | 'with_hints' | 'solution'>;
}

export interface StudentProfile {
  name: string;
  grade: string;
  track: AgeTrack;
}

export interface StudentState {
  version: number;
  profile: StudentProfile | null;
  activeSituation: SituationId;
  xp: number;
  streakDays: number;
  lastStudyDay: string | null;
  badges: string[];
  dialogueCompleted: Record<SituationId, boolean>;
  leitner: Record<string, LeitnerCardState>;
  initialTest: {
    done: boolean;
    score: number;
    total: number;
    answers: Record<string, boolean>;
  };
  finalTest: {
    unlocked: boolean;
    done: boolean;
    score: number;
    total: number;
    answers: Record<string, boolean>;
  };
  savedFlashcards: SavedFlashcard[];
  escapeRoom: EscapeRoomState;
  teacherUnlockedAll: boolean;
  teacherLogs: string[];
  reduceMotion: boolean;
}
