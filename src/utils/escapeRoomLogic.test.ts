import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceEscapeStep,
  applyHintPenalty,
  createInitialEscapeRoomState,
  createInitialStudentState,
  decodeProgressCode,
  encodeProgressCode,
  generateTextReport,
} from './escapeRoomLogic';
import { ESCAPE_STAGES } from '../data/escapeRoom';

test('Escape Room hint penalty adds +30s for hints 1-2 and +90s for solution', () => {
  let s = createInitialEscapeRoomState();
  s = applyHintPenalty(s, 1);
  assert.equal(s.penaltyMs, 30_000);
  s = applyHintPenalty(s, 3);
  assert.equal(s.penaltyMs, 120_000);
  assert.equal(s.stageStatuses[0], 'with_solution');
});

test('advanceEscapeStep advances through steps, collects clue, and marks finished at last stage', () => {
  let s = createInitialEscapeRoomState();
  s = advanceEscapeStep(s, ['sofa'], 0);
  assert.equal(s.stageIndex, 0);
  assert.equal(s.stepIndex, 1);

  s = advanceEscapeStep(s, ['lamp'], 0);
  assert.equal(s.stageIndex, 1);
  assert.equal(s.stepIndex, 0);
  assert.equal(s.collectedClues.length, 1);
  assert.equal(s.stageStatuses[0], 'cleared');

  // Jump to final stage
  s = { ...s, stageIndex: ESCAPE_STAGES.length - 1, stepIndex: 0 };
  s = advanceEscapeStep(s, ['bookcase'], 1);
  assert.equal(s.finished, true);
  assert.equal(s.wordResults['bookcase'], 'with_hints');
});

test('progress code roundtrip preserves Galician characters and state', () => {
  const state = createInitialStudentState();
  state.profile = { name: 'Uxía Fernández', grade: '6º EP', track: '10-14' };
  state.xp = 140;
  const code = encodeProgressCode(state);
  const decoded = decodeProgressCode(code);
  assert.ok(decoded);
  assert.equal(decoded.profile?.name, 'Uxía Fernández');
  assert.equal(decoded.xp, 140);

  const report = generateTextReport(decoded);
  assert.match(report, /Uxía Fernández/);
});
