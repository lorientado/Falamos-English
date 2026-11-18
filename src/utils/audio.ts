import { getSpeechRateForPace, SpeechPace } from './conversationAdaptation';

export interface VoiceLike {
  lang: string;
  name: string;
  localService?: boolean;
  default?: boolean;
}

export interface EnglishVoiceSelection<T extends VoiceLike = SpeechSynthesisVoice> {
  voice: T | null;
  isEnUs: boolean;
  isNativeEnUs: boolean;
}

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesLoadedOnce = false;
let voicesListenerAttached = false;
const audioCache = new Map<string, string>(); // text -> dataUrl
let activeAudio: HTMLAudioElement | null = null;

export function normalizeVoiceLang(lang: string | undefined | null): string {
  return (lang ?? '').trim().replace(/_/g, '-').toLowerCase();
}

function isInterferingVoiceName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('galician') ||
    lower.includes('galego') ||
    lower.includes('spanish') ||
    lower.includes('español') ||
    lower.includes('castellano') ||
    lower.includes('portuguese') ||
    lower.includes('português')
  );
}

function isLowQualitySynthName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('espeak') ||
    lower.includes('festival') ||
    lower.includes('mbrola') ||
    lower.includes('eloquence')
  );
}

export function isEnglishVoiceTag(lang: string): boolean {
  const norm = normalizeVoiceLang(lang);
  return norm === 'en' || norm.startsWith('en-');
}

export function isEnUsVoiceTag(lang: string): boolean {
  const norm = normalizeVoiceLang(lang);
  return norm === 'en-us' || norm.startsWith('en-us-');
}

function scoreEnglishVoice(v: VoiceLike): number {
  const norm = normalizeVoiceLang(v.lang);
  const name = (v.name ?? '').toLowerCase();

  if (!isEnglishVoiceTag(norm) || isInterferingVoiceName(name)) {
    return -1000;
  }

  let score = 0;

  if (isEnUsVoiceTag(norm)) {
    score += 1000;
    if (v.localService === true) score += 250;
    if (
      name.includes('google us english') ||
      name.includes('natural') ||
      name.includes('samantha') ||
      name.includes('alex') ||
      name.includes('ava') ||
      name.includes('allison') ||
      name.includes('aria') ||
      name.includes('jenny') ||
      name.includes('guy') ||
      name.includes('zira') ||
      name.includes('david') ||
      name.includes('siri') ||
      name.includes('enhanced') ||
      name.includes('premium')
    ) {
      score += 180;
    }
    if (v.default) score += 20;
  } else if (norm === 'en-gb' || norm.startsWith('en-gb-')) {
    score += 500;
    if (v.localService === true) score += 100;
  } else {
    score += 200;
  }

  if (isLowQualitySynthName(name)) {
    score -= 400;
  }

  return score;
}

export function selectPreferredEnglishVoice<T extends VoiceLike>(
  voices: readonly T[]
): EnglishVoiceSelection<T> {
  const candidates = voices
    .map((voice) => ({ voice, score: scoreEnglishVoice(voice) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0]?.voice ?? null;
  if (!best) {
    return { voice: null, isEnUs: false, isNativeEnUs: false };
  }

  const isEnUs = isEnUsVoiceTag(best.lang);
  const isNativeEnUs =
    isEnUs &&
    !isLowQualitySynthName(best.name ?? '') &&
    !isInterferingVoiceName(best.name ?? '') &&
    (best.localService === true ||
      /google us english|natural|apple|microsoft|samantha|alex|ava|aria|jenny|siri/i.test(
        best.name ?? ''
      ));

  return { voice: best, isEnUs, isNativeEnUs };
}

export function hasNativeEnUsSupport(voices: readonly VoiceLike[]): boolean {
  return selectPreferredEnglishVoice(voices).isNativeEnUs;
}

function stopActivePlayback() {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

export function loadEnglishVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const pick = () => {
      cachedVoices = synth
        .getVoices()
        .filter((v) => isEnglishVoiceTag(v.lang) && !isInterferingVoiceName(v.name));
      return cachedVoices;
    };

    if (!voicesListenerAttached && typeof synth.addEventListener === 'function') {
      voicesListenerAttached = true;
      synth.addEventListener('voiceschanged', () => {
        pick();
      });
    }

    const found = pick();
    if (found.length > 0 || voicesLoadedOnce) {
      voicesLoadedOnce = true;
      resolve(found);
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      voicesLoadedOnce = true;
      synth.removeEventListener?.('voiceschanged', finish);
      resolve(pick());
    };
    synth.addEventListener?.('voiceschanged', finish);
    window.setTimeout(finish, 450);
  });
}

export interface SpeakOptions {
  rate?: number;
  pace?: SpeechPace;
}

export function speakBrowserEnglish(
  text: string,
  voicesOverride?: readonly SpeechSynthesisVoice[],
  options?: SpeakOptions
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  try {
    const synth = window.speechSynthesis;
    const available =
      voicesOverride && voicesOverride.length > 0
        ? voicesOverride
        : cachedVoices.length > 0
          ? cachedVoices
          : synth.getVoices();

    const { voice: preferred, isEnUs } = selectPreferredEnglishVoice(available);
    if (!preferred) return false;

    stopActivePlayback();
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = preferred;
    utter.lang = isEnUs ? 'en-US' : normalizeVoiceLang(preferred.lang) || 'en-US';
    const resolvedRate =
      typeof options?.rate === 'number'
        ? options.rate
        : options?.pace
          ? getSpeechRateForPace(options.pace)
          : 0.95;
    utter.rate = Math.max(0.65, Math.min(1.15, resolvedRate));
    utter.pitch = 1;
    synth.speak(utter);
    return true;
  } catch {
    return false;
  }
}

export async function speakEnglishWithFallback(
  text: string,
  preferGemini = true,
  options?: SpeakOptions
): Promise<{ mode: 'gemini' | 'browser' | 'none'; lang?: string; error?: string }> {
  const pace: SpeechPace = options?.pace ?? 'standard';
  const cacheKey = `${pace}::${text}`;

  const playDataUrl = async (url: string): Promise<boolean> => {
    stopActivePlayback();
    const audio = new Audio(url);
    activeAudio = audio;
    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
    };
    await audio.play();
    return true;
  };

  const tryGeminiTts = async (): Promise<boolean> => {
    try {
      const cached = audioCache.get(cacheKey);
      if (cached) {
        return await playDataUrl(cached);
      }
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, pace }),
      });
      if (res.ok) {
        const data = (await res.json()) as { audio?: string; mimeType?: string };
        if (data.audio) {
          const url = `data:${data.mimeType || 'audio/wav'};base64,${data.audio}`;
          audioCache.set(cacheKey, url);
          return await playDataUrl(url);
        }
      }
    } catch {
      // fall through
    }
    return false;
  };

  if (preferGemini && (await tryGeminiTts())) {
    return { mode: 'gemini', lang: 'en-GB' };
  }

  const voices =
    cachedVoices.length > 0 ? cachedVoices : await loadEnglishVoices();
  const selection = selectPreferredEnglishVoice(voices);

  // If browser supports a native en-US voice, prioritize it in SpeechSynthesis
  if (selection.isNativeEnUs && speakBrowserEnglish(text, voices, options)) {
    return { mode: 'browser', lang: 'en-US' };
  }

  // Without a native en-US browser voice, prefer standard native Gemini TTS over non-native voices
  if (!preferGemini && (await tryGeminiTts())) {
    return { mode: 'gemini', lang: 'en-GB' };
  }

  // Last-resort offline fallback only when an explicit English voice exists
  if (selection.voice && speakBrowserEnglish(text, voices, options)) {
    return {
      mode: 'browser',
      lang: selection.isEnUs ? 'en-US' : selection.voice.lang,
    };
  }

  return { mode: 'none' };
}
