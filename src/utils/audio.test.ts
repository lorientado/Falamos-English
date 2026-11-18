import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasNativeEnUsSupport,
  normalizeVoiceLang,
  selectPreferredEnglishVoice,
  VoiceLike,
} from './audio';

test('prioritizes native en-US voice over en-GB and non-English voices', () => {
  const voices: VoiceLike[] = [
    { name: 'Galego (Galicia)', lang: 'gl-ES', localService: true },
    { name: 'Microsoft Helena - Spanish (Spain)', lang: 'es-ES', localService: true },
    { name: 'Daniel', lang: 'en-GB', localService: true },
    { name: 'Samantha', lang: 'en-US', localService: true },
  ];

  const selected = selectPreferredEnglishVoice(voices);
  assert.equal(selected.voice?.name, 'Samantha');
  assert.equal(selected.isEnUs, true);
  assert.equal(selected.isNativeEnUs, true);
  assert.equal(hasNativeEnUsSupport(voices), true);
});

test('normalizes underscore locale tags such as en_US', () => {
  assert.equal(normalizeVoiceLang('en_US'), 'en-us');
  const voices: VoiceLike[] = [
    { name: 'Android Speech Recognition and Synthesis from Google', lang: 'en_US', localService: true },
  ];
  const selected = selectPreferredEnglishVoice(voices);
  assert.equal(selected.isEnUs, true);
  assert.equal(selected.isNativeEnUs, true);
});

test('prefers standard Google/Apple/Microsoft en-US voice over espeak synthetic voice', () => {
  const voices: VoiceLike[] = [
    { name: 'English (America) espeak', lang: 'en-US', localService: true },
    { name: 'Google US English', lang: 'en-US', localService: false },
  ];
  const selected = selectPreferredEnglishVoice(voices);
  assert.equal(selected.voice?.name, 'Google US English');
  assert.equal(selected.isNativeEnUs, true);
});

test('rejects Galician/Spanish voices and reports no native en-US support when absent', () => {
  const voices: VoiceLike[] = [
    { name: 'Galician (eSpeak)', lang: 'gl', localService: true },
    { name: 'Spanish (Spain)', lang: 'es-ES', localService: true },
    { name: 'English (eSpeak)', lang: 'en-US', localService: true },
  ];
  const selected = selectPreferredEnglishVoice(voices);
  assert.equal(selected.isNativeEnUs, false);
  assert.equal(hasNativeEnUsSupport(voices), false);

  const onlyLocalSpanish: VoiceLike[] = [
    { name: 'Mónica', lang: 'es-ES', localService: true },
  ];
  assert.equal(selectPreferredEnglishVoice(onlyLocalSpanish).voice, null);
});
