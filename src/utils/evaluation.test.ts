import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEnglishWordAnswer, checkRoomAnswer } from './evaluation';

test('accepts exact English word with or without leading article', () => {
  const sofa = { word: 'sofa', article: 'a', variants: ['couch'] };
  assert.equal(checkEnglishWordAnswer('sofa', sofa).kind, 'exact');
  assert.equal(checkEnglishWordAnswer('a sofa', sofa).kind, 'exact');
  assert.equal(checkEnglishWordAnswer('  A Sofa! ', sofa).accepted, true);
});

test('accepts British/American variants with helpful note', () => {
  const wardrobe = { word: 'wardrobe', article: 'a', variants: ['closet'] };
  const res = checkEnglishWordAnswer('closet', wardrobe);
  assert.equal(res.kind, 'variant');
  assert.equal(res.accepted, true);
});

test('flags minor article mismatch gently while accepting core word', () => {
  const armchair = { word: 'armchair', article: 'an', variants: [] };
  const res = checkEnglishWordAnswer('a armchair', armchair);
  assert.equal(res.kind, 'article');
  assert.equal(res.accepted, true);
});

test('detects single-character typo as close and accepts with spelling note', () => {
  const pillow = { word: 'pillow', article: 'a', variants: [] };
  const res = checkEnglishWordAnswer('pilow', pillow);
  assert.equal(res.kind, 'close');
  assert.equal(res.accepted, true);
});

test('identifies when student enters another vocabulary item', () => {
  const desk = { word: 'desk', article: 'a', variants: [] };
  const res = checkEnglishWordAnswer('chair', desk, ['chair', 'bed', 'desk']);
  assert.equal(res.kind, 'other_word');
  assert.equal(res.accepted, false);
  assert.equal(res.otherWord, 'chair');
});

test('checkRoomAnswer matches room name ignoring articles and case', () => {
  assert.equal(checkRoomAnswer('the living room', 'living room'), true);
  assert.equal(checkRoomAnswer('Kitchen', 'kitchen'), true);
  assert.equal(checkRoomAnswer('bedroom', 'kitchen'), false);
});
