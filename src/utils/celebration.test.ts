import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectEscapeCelebration,
  getConfettiBursts,
  shouldCelebrateFlashcard,
} from './celebration';

test('shouldCelebrateFlashcard triggers only on correct or partial outcomes', () => {
  assert.equal(shouldCelebrateFlashcard('correct'), true);
  assert.equal(shouldCelebrateFlashcard('partial'), true);
  assert.equal(shouldCelebrateFlashcard('wrong'), false);
});

test('detectEscapeCelebration detects stage advance and final completion without false positives', () => {
  // Starting game
  assert.equal(
    detectEscapeCelebration(
      { startedAt: null, stageIndex: 0, finished: false },
      { startedAt: '2026-11-18T10:00:00Z', stageIndex: 0, finished: false }
    ),
    null
  );

  // Advancing within the same stage (step 0 -> step 1)
  assert.equal(
    detectEscapeCelebration(
      { startedAt: '2026-11-18T10:00:00Z', stageIndex: 0, finished: false },
      { startedAt: '2026-11-18T10:00:00Z', stageIndex: 0, finished: false }
    ),
    null
  );

  // Completing stage 0 and moving to stage 1
  assert.equal(
    detectEscapeCelebration(
      { startedAt: '2026-11-18T10:00:00Z', stageIndex: 0, finished: false },
      { startedAt: '2026-11-18T10:00:00Z', stageIndex: 1, finished: false }
    ),
    'escape_stage'
  );

  // Completing the final stage
  assert.equal(
    detectEscapeCelebration(
      { startedAt: '2026-11-18T10:00:00Z', stageIndex: 7, finished: false },
      { startedAt: '2026-11-18T10:00:00Z', stageIndex: 7, finished: true }
    ),
    'escape_finish'
  );

  // Resetting after finishing
  assert.equal(
    detectEscapeCelebration(
      { startedAt: '2026-11-18T10:00:00Z', stageIndex: 7, finished: true },
      { startedAt: null, stageIndex: 0, finished: false }
    ),
    null
  );
});

test('getConfettiBursts scales intensity from flashcard to escape_stage to escape_finish', () => {
  const flash = getConfettiBursts('flashcard');
  const stage = getConfettiBursts('escape_stage');
  const finish = getConfettiBursts('escape_finish');

  assert.equal(flash.length, 1);
  assert.equal(stage.length, 2);
  assert.equal(finish.length, 3);
  assert.equal(flash[0].options.disableForReducedMotion, true);
});
