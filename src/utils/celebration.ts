import type { Options as ConfettiOptions } from 'canvas-confetti';
import { EscapeRoomState } from '../types';

export type CelebrationKind = 'flashcard' | 'escape_stage' | 'escape_finish';

export interface CelebrationEvent {
  id: number;
  kind: CelebrationKind;
}

export interface ConfettiBurstSpec {
  delayMs: number;
  options: ConfettiOptions;
}

const CELEBRATION_COLORS = ['#1d4ed8', '#15803d', '#f59e0b', '#38bdf8', '#fb7185'];

export function shouldCelebrateFlashcard(
  outcome: 'correct' | 'partial' | 'wrong'
): boolean {
  return outcome === 'correct' || outcome === 'partial';
}

export function detectEscapeCelebration(
  prev: Pick<EscapeRoomState, 'startedAt' | 'stageIndex' | 'finished'>,
  next: Pick<EscapeRoomState, 'startedAt' | 'stageIndex' | 'finished'>
): CelebrationKind | null {
  if (!next.startedAt) return null;
  if (!prev.finished && next.finished) {
    return 'escape_finish';
  }
  if (prev.startedAt && next.stageIndex > prev.stageIndex) {
    return 'escape_stage';
  }
  return null;
}

export function getConfettiBursts(kind: CelebrationKind): ConfettiBurstSpec[] {
  if (kind === 'flashcard') {
    return [
      {
        delayMs: 0,
        options: {
          particleCount: 55,
          spread: 68,
          startVelocity: 36,
          origin: { x: 0.55, y: 0.65 },
          colors: CELEBRATION_COLORS,
          disableForReducedMotion: true,
        },
      },
    ];
  }

  if (kind === 'escape_stage') {
    return [
      {
        delayMs: 0,
        options: {
          particleCount: 48,
          angle: 60,
          spread: 58,
          startVelocity: 40,
          origin: { x: 0.15, y: 0.7 },
          colors: CELEBRATION_COLORS,
          disableForReducedMotion: true,
        },
      },
      {
        delayMs: 120,
        options: {
          particleCount: 48,
          angle: 120,
          spread: 58,
          startVelocity: 40,
          origin: { x: 0.85, y: 0.7 },
          colors: CELEBRATION_COLORS,
          disableForReducedMotion: true,
        },
      },
    ];
  }

  // escape_finish
  return [
    {
      delayMs: 0,
      options: {
        particleCount: 70,
        angle: 60,
        spread: 70,
        startVelocity: 46,
        origin: { x: 0.15, y: 0.72 },
        colors: CELEBRATION_COLORS,
        disableForReducedMotion: true,
      },
    },
    {
      delayMs: 140,
      options: {
        particleCount: 70,
        angle: 120,
        spread: 70,
        startVelocity: 46,
        origin: { x: 0.85, y: 0.72 },
        colors: CELEBRATION_COLORS,
        disableForReducedMotion: true,
      },
    },
    {
      delayMs: 320,
      options: {
        particleCount: 85,
        spread: 95,
        startVelocity: 42,
        origin: { x: 0.5, y: 0.5 },
        colors: CELEBRATION_COLORS,
        disableForReducedMotion: true,
      },
    },
  ];
}
