import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceLeitnerCard, getCurriculumItemsForTrack, getDueCardIds } from './leitner';
import { VOCAB_ITEMS } from '../data/situations';

test('Leitner promotes on correct up to box 5 and resets to box 1 on wrong', () => {
  const now = 1_700_000_000_000;
  let card = advanceLeitnerCard(undefined, 'correct', now);
  assert.equal(card.box, 2);
  assert.equal(card.dueAt, now + 1 * 24 * 60 * 60 * 1000);

  card = advanceLeitnerCard(card, 'correct', now);
  assert.equal(card.box, 3);
  assert.equal(card.dueAt, now + 3 * 24 * 60 * 60 * 1000);

  card = advanceLeitnerCard(card, 'wrong', now);
  assert.equal(card.box, 1);
  assert.equal(card.dueAt, now);
  assert.equal(card.wrongCount, 1);
});

test('getDueCardIds prioritizes unseen and lower-box due cards', () => {
  const now = 1_700_000_000_000;
  const subset = VOCAB_ITEMS.slice(0, 3);
  const leitner = {
    [subset[0].id]: { box: 3, dueAt: now + 100000, correctCount: 2, wrongCount: 0 },
    [subset[1].id]: { box: 2, dueAt: now - 1000, correctCount: 1, wrongCount: 0 },
  };
  const due = getDueCardIds(subset, leitner, now);
  assert.deepEqual(due, [subset[2].id, subset[1].id]);
});

test('track filtering limits 7-9 to starter items while 10-14 unlocks all A1+A2 items', () => {
  const starter = getCurriculumItemsForTrack(VOCAB_ITEMS, '7-9');
  const full = getCurriculumItemsForTrack(VOCAB_ITEMS, '10-14');
  assert.ok(starter.length > 30);
  assert.ok(full.length > starter.length);
  assert.ok(starter.every((item) => item.trackMin === '7-9'));
});
