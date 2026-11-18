import test from 'node:test';
import assert from 'node:assert/strict';
import { SITUATION_MAP } from '../data/situations';
import {
  buildAdaptedWelcomeMessage,
  buildChatSystemInstruction,
  buildLiveSystemInstruction,
  getSpeechRateForPace,
  resolveAdaptationProfile,
} from './conversationAdaptation';

test('resolveAdaptationProfile maps 7-9 / 2º-4º Primaria to starter slow pace', () => {
  const profile = resolveAdaptationProfile('7-9', '3º Primaria');
  assert.equal(profile.tier, 'starter');
  assert.equal(profile.defaultPace, 'slow');
  assert.equal(profile.speechRateByPace.slow, 0.78);
  assert.equal(profile.maxWordsPerSentence, 7);
});

test('resolveAdaptationProfile maps 5º-6º Primaria to elementary moderate pace', () => {
  const profile = resolveAdaptationProfile('10-14', '5º Primaria');
  assert.equal(profile.tier, 'elementary');
  assert.equal(profile.defaultPace, 'moderate');
  assert.equal(profile.speechRateByPace.moderate, 0.86);
  assert.equal(profile.maxWordsPerSentence, 11);
});

test('resolveAdaptationProfile maps 1º-2º ESO to pre_intermediate standard pace', () => {
  const profile = resolveAdaptationProfile('10-14', '2º ESO');
  assert.equal(profile.tier, 'pre_intermediate');
  assert.equal(profile.defaultPace, 'standard');
  assert.equal(profile.speechRateByPace.standard, 0.94);
  assert.equal(profile.maxWordsPerSentence, 15);
});

test('getSpeechRateForPace slows speech progressively for younger learners', () => {
  assert.ok(getSpeechRateForPace('slow') < getSpeechRateForPace('moderate'));
  assert.ok(getSpeechRateForPace('moderate') < getSpeechRateForPace('standard'));
});

test('buildAdaptedWelcomeMessage simplifies greeting and hint for starter track', () => {
  const home = SITUATION_MAP.home;
  const starterProfile = resolveAdaptationProfile('7-9', '2º Primaria');
  const esoProfile = resolveAdaptationProfile('10-14', '2º ESO');

  const starterMsg = buildAdaptedWelcomeMessage(home, starterProfile, ['sofa', 'bed']);
  const esoMsg = buildAdaptedWelcomeMessage(home, esoProfile, ['sofa', 'bed', 'coffee table']);

  assert.match(starterMsg.text, /sofa/i);
  assert.match(starterMsg.hintGl, /2º Primaria/);
  assert.ok(starterMsg.text.split(' ').length < esoMsg.text.split(' ').length);
});

test('buildChatSystemInstruction enforces strict lexical limits for younger grades', () => {
  const prompt = buildChatSystemInstruction({
    scenarioTitleEn: 'The House',
    scenarioRole: 'Uxía',
    cefrLevel: 'A1',
    ageTrack: '7-9',
    grade: '3º Primaria',
    missions: ['Ask where a room is'],
    vocabularyList: ['sofa', 'bed', 'lamp'],
  });

  assert.match(prompt, /3º Primaria/);
  assert.match(prompt, /NEVER use phrasal verbs, idioms/);
  assert.match(prompt, /max 7 words per sentence/);
  assert.match(prompt, /sofa, bed, lamp/);
});

test('buildLiveSystemInstruction enforces slower speaking pace for younger grades', () => {
  const slowLive = buildLiveSystemInstruction({
    scenarioTitleEn: 'The House',
    scenarioRole: 'Uxía',
    cefrLevel: 'A1',
    ageTrack: '7-9',
    grade: '2º Primaria',
    vocabularyList: ['sofa', 'bed'],
  });
  const esoLive = buildLiveSystemInstruction({
    scenarioTitleEn: 'In Town',
    scenarioRole: 'Local neighbour',
    cefrLevel: 'A2',
    ageTrack: '10-14',
    grade: '2º ESO',
    vocabularyList: ['museum', 'library'],
  });

  assert.match(slowLive, /SPEAKING PACE & DELIVERY \(CRITICAL\): Speak noticeably SLOWLY/);
  assert.match(slowLive, /2º Primaria/);
  assert.match(esoLive, /2º ESO/);
  assert.doesNotMatch(esoLive, /noticeably SLOWLY/);
});
