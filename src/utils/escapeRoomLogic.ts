import { ESCAPE_STAGES } from '../data/escapeRoom';
import { VOCAB_ITEMS } from '../data/situations';
import { EscapeRoomState, StudentState } from '../types';

export function createInitialEscapeRoomState(): EscapeRoomState {
  return {
    startedAt: null,
    finished: false,
    stageIndex: 0,
    stepIndex: 0,
    activeMs: 0,
    penaltyMs: 0,
    stageTimesMs: {},
    hintsUsed: {},
    errors: {},
    stageStatuses: {},
    collectedClues: [],
    wordResults: {},
  };
}

export function createInitialStudentState(): StudentState {
  return {
    version: 2,
    profile: null,
    activeSituation: 'home',
    xp: 0,
    streakDays: 1,
    lastStudyDay: null,
    badges: [],
    dialogueCompleted: {
      home: false,
      school: false,
      cafe: false,
      routine: false,
      town: false,
      doctor: false,
      travel: false,
    },
    leitner: {},
    initialTest: { done: false, score: 0, total: 0, answers: {} },
    finalTest: { unlocked: false, done: false, score: 0, total: 0, answers: {} },
    savedFlashcards: [],
    escapeRoom: createInitialEscapeRoomState(),
    teacherUnlockedAll: false,
    teacherLogs: [],
    reduceMotion: false,
  };
}

export function applyHintPenalty(
  state: EscapeRoomState,
  newHintLevel: number
): EscapeRoomState {
  const addMs = newHintLevel >= 3 ? 90_000 : 30_000;
  return {
    ...state,
    hintsUsed: {
      ...state.hintsUsed,
      [state.stageIndex]: (state.hintsUsed[state.stageIndex] ?? 0) + 1,
    },
    penaltyMs: state.penaltyMs + addMs,
    stageStatuses:
      newHintLevel >= 3
        ? { ...state.stageStatuses, [state.stageIndex]: 'with_solution' }
        : state.stageStatuses,
  };
}

export function advanceEscapeStep(
  state: EscapeRoomState,
  solvedWordIds: string[],
  hintLevelUsed: number
): EscapeRoomState {
  const stage = ESCAPE_STAGES[state.stageIndex];
  if (!stage) return state;

  const updatedWordResults = { ...state.wordResults };
  for (const id of solvedWordIds) {
    updatedWordResults[id] =
      hintLevelUsed >= 3
        ? 'solution'
        : hintLevelUsed > 0
          ? 'with_hints'
          : updatedWordResults[id] ?? 'no_hints';
  }

  if (state.stepIndex + 1 < stage.steps.length) {
    return {
      ...state,
      stepIndex: state.stepIndex + 1,
      wordResults: updatedWordResults,
    };
  }

  const stageStatus =
    state.stageStatuses[state.stageIndex] === 'with_solution'
      ? 'with_solution'
      : (state.hintsUsed[state.stageIndex] ?? 0) > 0
        ? 'with_hints'
        : 'cleared';

  const nextClues =
    stage.clueFragmentGl && !state.collectedClues.includes(stage.clueFragmentGl)
      ? [...state.collectedClues, stage.clueFragmentGl]
      : state.collectedClues;

  const isLastStage = state.stageIndex + 1 >= ESCAPE_STAGES.length;

  return {
    ...state,
    finished: isLastStage,
    stageIndex: isLastStage ? state.stageIndex : state.stageIndex + 1,
    stepIndex: 0,
    stageStatuses: { ...state.stageStatuses, [state.stageIndex]: stageStatus },
    collectedClues: nextClues,
    wordResults: updatedWordResults,
  };
}

export function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min} min ${sec} s`;
}

export function encodeProgressCode(state: StudentState): string {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function decodeProgressCode(code: string): StudentState | null {
  try {
    const clean = code.trim();
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Partial<StudentState>;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 2) return null;
    const base = createInitialStudentState();
    return {
      ...base,
      ...parsed,
      escapeRoom: { ...base.escapeRoom, ...(parsed.escapeRoom ?? {}) },
    };
  } catch {
    return null;
  }
}

export function generateTextReport(state: StudentState): string {
  const lines: string[] = [];
  const name = state.profile?.name ?? 'Sen nome';
  const grade = state.profile?.grade ?? '-';
  const trackLabel =
    state.profile?.track === '7-9' ? '7–9 anos · A1 Inicial' : '10–14 anos · 5º EP–2º ESO (A1–A2)';

  lines.push('INFORME DE PROGRESO · FALAMOS ENGLISH 3D (A1–A2)');
  lines.push('===================================================');
  lines.push(`Alumno/a: ${name} (${grade})`);
  lines.push(`Itinerario: ${trackLabel}`);
  lines.push(`Puntos XP: ${state.xp} · Racha: ${state.streakDays} día(s)`);
  lines.push('');

  const mastered = VOCAB_ITEMS.filter((v) => (state.leitner[v.id]?.box ?? 1) >= 3);
  lines.push(`Vocabulario dominado (caixa 3+): ${mastered.length} / ${VOCAB_ITEMS.length}`);
  if (state.initialTest.done) {
    lines.push(`Proba inicial: ${state.initialTest.score} / ${state.initialTest.total}`);
  }
  if (state.finalTest.done) {
    lines.push(`Proba final: ${state.finalTest.score} / ${state.finalTest.total}`);
  }

  const esc = state.escapeRoom;
  lines.push('');
  lines.push('SALA DE ESCAPE DA CASA:');
  lines.push(`- Estado: ${esc.finished ? 'Completada' : `Proba ${esc.stageIndex + 1} de ${ESCAPE_STAGES.length}`}`);
  lines.push(`- Tempo activo: ${formatDurationMs(esc.activeMs)}`);
  lines.push(`- Penalización por axudas: +${formatDurationMs(esc.penaltyMs)}`);
  lines.push(`- Tempo total: ${formatDurationMs(esc.activeMs + esc.penaltyMs)}`);
  lines.push('');
  lines.push(`Tarxetas de conversa gardadas: ${state.savedFlashcards.length}`);

  return lines.join('\n');
}
