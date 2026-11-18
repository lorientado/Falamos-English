import { AgeTrack, LeitnerCardState, SituationId, StudentState, VocabItem } from '../types';

export const LEITNER_INTERVAL_DAYS = [0, 1, 3, 7, 14] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getCurriculumItemsForTrack(
  allItems: VocabItem[],
  track: AgeTrack,
  situationFilter?: SituationId | 'all'
): VocabItem[] {
  return allItems.filter((item) => {
    const fitsTrack = track === '10-14' || item.trackMin === '7-9';
    const fitsSituation = !situationFilter || situationFilter === 'all' || item.situation === situationFilter;
    return fitsTrack && fitsSituation;
  });
}

export function advanceLeitnerCard(
  current: LeitnerCardState | undefined,
  outcome: 'correct' | 'partial' | 'wrong',
  nowMs: number = Date.now()
): LeitnerCardState {
  const prevBox = current?.box ?? 1;
  const prevCorrect = current?.correctCount ?? 0;
  const prevWrong = current?.wrongCount ?? 0;

  if (outcome === 'correct') {
    const nextBox = Math.min(5, prevBox + 1);
    const days = LEITNER_INTERVAL_DAYS[nextBox - 1] ?? 14;
    return {
      box: nextBox,
      dueAt: nowMs + days * DAY_MS,
      lastReviewedAt: nowMs,
      correctCount: prevCorrect + 1,
      wrongCount: prevWrong,
    };
  }

  if (outcome === 'partial') {
    // Minor typo or article hint: keep same box, review later today
    return {
      box: prevBox,
      dueAt: nowMs + 6 * 60 * 60 * 1000,
      lastReviewedAt: nowMs,
      correctCount: prevCorrect + 1,
      wrongCount: prevWrong,
    };
  }

  // Wrong answer resets to Box 1 immediately
  return {
    box: 1,
    dueAt: nowMs,
    lastReviewedAt: nowMs,
    correctCount: prevCorrect,
    wrongCount: prevWrong + 1,
  };
}

export function getDueCardIds(
  items: VocabItem[],
  leitner: Record<string, LeitnerCardState>,
  nowMs: number = Date.now()
): string[] {
  const due: { id: string; box: number; dueAt: number }[] = [];
  for (const item of items) {
    const card = leitner[item.id];
    if (!card) {
      due.push({ id: item.id, box: 1, dueAt: 0 });
    } else if (card.dueAt <= nowMs) {
      due.push({ id: item.id, box: card.box, dueAt: card.dueAt });
    }
  }
  // Prioritize lower boxes and older due dates
  due.sort((a, b) => a.box - b.box || a.dueAt - b.dueAt);
  return due.map((d) => d.id);
}

export function getLeitnerDistribution(
  items: VocabItem[],
  leitner: Record<string, LeitnerCardState>
): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of items) {
    const box = leitner[item.id]?.box ?? 1;
    dist[box] = (dist[box] ?? 0) + 1;
  }
  return dist;
}

export function computeEarnedBadges(state: StudentState): string[] {
  const badges: string[] = [];
  const masteredCount = Object.values(state.leitner).filter((c) => c.box >= 3).length;
  const dialoguesDone = Object.values(state.dialogueCompleted).filter(Boolean).length;

  if (state.initialTest.done) badges.push('Primeiro Paso (Proba inicial)');
  if (masteredCount >= 10) badges.push('Coleccionista de 10 palabras');
  if (masteredCount >= 25) badges.push('Mestre do Léxico (25+)');
  if (dialoguesDone >= 1) badges.push('Comunicador/a A1');
  if (dialoguesDone >= 4) badges.push('Viaxeiro/a Bilingüe (4+ situacións)');
  if (state.escapeRoom.finished) badges.push('Detective da Casa de Uxía');
  if (state.savedFlashcards.length >= 3) badges.push('Caderno Activo (3+ tarxetas IA)');
  if (state.xp >= 200) badges.push('Estrela Galega-Inglesa (200+ XP)');

  return badges;
}
