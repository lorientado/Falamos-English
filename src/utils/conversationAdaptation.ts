import { AgeTrack, CefrLevel, SituationMeta } from '../types';

export type AdaptationTier = 'starter' | 'elementary' | 'pre_intermediate';
export type SpeechPace = 'slow' | 'moderate' | 'standard';

export interface ConversationAdaptationProfile {
  tier: AdaptationTier;
  track: AgeTrack;
  grade: string;
  cefrBadgeGl: string;
  lexicalBadgeGl: string;
  defaultPace: SpeechPace;
  paceLabelGl: Record<SpeechPace, string>;
  speechRateByPace: Record<SpeechPace, number>;
  maxWordsPerSentence: number;
  maxSentences: number;
  inputPlaceholderGl: string;
}

const PACE_LABELS: Record<SpeechPace, string> = {
  slow: 'Moi pausado',
  moderate: 'Pausado',
  standard: 'Natural',
};

const SPEECH_RATES: Record<SpeechPace, number> = {
  slow: 0.78,
  moderate: 0.86,
  standard: 0.94,
};

export function resolveAdaptationProfile(
  track: AgeTrack,
  grade?: string | null
): ConversationAdaptationProfile {
  const cleanGrade = (grade ?? '').trim();
  const isYoungerGrade =
    cleanGrade === '2º Primaria' ||
    cleanGrade === '3º Primaria' ||
    cleanGrade === '4º Primaria';
  const isUpperEso = cleanGrade === '1º ESO' || cleanGrade === '2º ESO';

  if (track === '7-9' || isYoungerGrade) {
    return {
      tier: 'starter',
      track: '7-9',
      grade: cleanGrade || '3º Primaria',
      cefrBadgeGl: 'A1 Inicial',
      lexicalBadgeGl: 'Léxico moi básico e frases curtas',
      defaultPace: 'slow',
      paceLabelGl: PACE_LABELS,
      speechRateByPace: SPEECH_RATES,
      maxWordsPerSentence: 7,
      maxSentences: 2,
      inputPlaceholderGl:
        'Escribe palabras ou frases curtas en inglés (ex.: Red sofa! / Where is the bed?)...',
    };
  }

  if (isUpperEso) {
    return {
      tier: 'pre_intermediate',
      track: '10-14',
      grade: cleanGrade,
      cefrBadgeGl: 'A1–A2',
      lexicalBadgeGl: 'Léxico A1–A2 e expresións cotiás',
      defaultPace: 'standard',
      paceLabelGl: PACE_LABELS,
      speechRateByPace: SPEECH_RATES,
      maxWordsPerSentence: 15,
      maxSentences: 3,
      inputPlaceholderGl:
        'Escribe en inglés (A1–A2) (ex.: Could you tell me where the kitchen is?)...',
    };
  }

  return {
    tier: 'elementary',
    track: '10-14',
    grade: cleanGrade || '5º Primaria',
    cefrBadgeGl: 'A1–A2 Básico',
    lexicalBadgeGl: 'Léxico escollido A1 e frases sinxelas',
    defaultPace: 'moderate',
    paceLabelGl: PACE_LABELS,
    speechRateByPace: SPEECH_RATES,
    maxWordsPerSentence: 11,
    maxSentences: 2,
    inputPlaceholderGl:
      'Escribe en inglés con frases sinxelas (ex.: Where is the kitchen?)...',
  };
}

export function getSpeechRateForPace(pace: SpeechPace): number {
  return SPEECH_RATES[pace] ?? 0.86;
}

export function buildAdaptedWelcomeMessage(
  meta: SituationMeta,
  adaptation: ConversationAdaptationProfile,
  allowedWords: string[]
): { text: string; hintGl: string } {
  const sampleWord = allowedWords[0] ?? 'hello';
  const starter = meta.starterPhrases[0]?.en ?? `Hello!`;

  if (adaptation.tier === 'starter') {
    const shortEnBySituation: Record<string, string> = {
      home: `Hello! Look at the house. Can you see the ${sampleWord}?`,
      school: `Hi! Welcome to class. What is on the desk?`,
      cafe: `Hello! Welcome to the café. Are you hungry?`,
      routine: `Good morning! What do you do at eight o'clock?`,
    };
    return {
      text: shortEnBySituation[meta.id] ?? `Hello! Welcome to ${meta.titleEn}.`,
      hintGl: `Nivel ${adaptation.grade} (${adaptation.cefrBadgeGl}): responde moi curto, por exemplo "${sampleWord}" ou "${starter}"`,
    };
  }

  if (adaptation.tier === 'elementary') {
    const midPrompt =
      meta.guidedDialogue[0]?.speakerPromptEn ??
      `Hello! Welcome to ${meta.titleEn}. What would you like to say?`;
    return {
      text: midPrompt,
      hintGl: `Nivel ${adaptation.grade} (${adaptation.cefrBadgeGl}): proba cunha frase sinxela como "${starter}"`,
    };
  }

  const fullPrompt =
    meta.guidedDialogue[0]?.speakerPromptEn ??
    `Hello and welcome to ${meta.titleEn}! How can I help you today?`;
  return {
    text: fullPrompt,
    hintGl: `Nivel ${adaptation.grade} (${adaptation.cefrBadgeGl}): usa vocabulario da escena ou proba con "${starter}"`,
  };
}

export function buildChatSystemInstruction(params: {
  scenarioTitleEn: string;
  scenarioRole: string;
  cefrLevel: CefrLevel | string;
  ageTrack: AgeTrack | string;
  grade?: string;
  missions: string[];
  vocabularyList: string[];
}): string {
  const adaptation = resolveAdaptationProfile(
    params.ageTrack === '7-9' ? '7-9' : '10-14',
    params.grade
  );
  const vocabSlice = (params.vocabularyList || []).slice(0, 14).join(', ');

  let levelRules: string;
  if (adaptation.tier === 'starter') {
    levelRules = [
      `Student profile: ${adaptation.grade} (age 7–9, CEFR A1 Starter).`,
      'STRICT LEXICAL CARE: Use ONLY ultra-common, concrete A1 words and words from the allowed vocabulary list below. NEVER use phrasal verbs, idioms, slang, passive voice, or abstract B1+ words.',
      `SENTENCE LENGTH: Keep replyEn to 1–2 very short, warm sentences (max ${adaptation.maxWordsPerSentence} words per sentence).`,
      'GRAMMAR: Use only basic present simple (is, are, have, like, see, want) and simple "Where is...?" / "What is...?" questions.',
      'SCAFFOLDING: Ask only ONE easy question at a time and offer 2–3 easy word options inside your reply or hintGl when helpful.',
    ].join('\n');
  } else if (adaptation.tier === 'elementary') {
    levelRules = [
      `Student profile: ${adaptation.grade} (age 10–12, CEFR A1 moving into basic A2).`,
      'LEXICAL CARE: Prioritize everyday A1 vocabulary and the allowed vocabulary list below. Avoid phrasal verbs, idioms, figurative language, or B1+ words.',
      `SENTENCE LENGTH: Keep replyEn to 1–2 clear, unhurried sentences (max ${adaptation.maxWordsPerSentence} words per sentence).`,
      'GRAMMAR: Use clear present simple, "there is / there are", "can", and simple polite requests ("Would you like...?").',
      'SCAFFOLDING: Give warm encouragement and ask one clear follow-up question.',
    ].join('\n');
  } else {
    levelRules = [
      `Student profile: ${adaptation.grade} (age 12–14, CEFR A1–A2).`,
      'LEXICAL CARE: Use natural A1–A2 everyday vocabulary anchored in the allowed vocabulary list below. Avoid B2/C1 vocabulary or obscure idioms.',
      `SENTENCE LENGTH: Keep replyEn clear and natural (up to ${adaptation.maxSentences} sentences, max ${adaptation.maxWordsPerSentence} words per sentence).`,
      'GRAMMAR: You may use everyday A2 structures (present simple/continuous, simple past, "could you", "going to") naturally.',
      'SCAFFOLDING: Keep the dialogue engaging with a gentle follow-up question.',
    ].join('\n');
  }

  return [
    `You are playing the role of "${params.scenarioRole}" in the English communicative scenario "${params.scenarioTitleEn}" (scene CEFR ${params.cefrLevel}).`,
    levelRules,
    `Allowed key vocabulary to weave in naturally: ${vocabSlice || 'basic everyday words'}.`,
    `Communicative goals for the student: ${(params.missions || []).join('; ')}.`,
    'Respond in English for replyEn. Put any gentle correction or helpful tip in Galician (galego) in hintGl/correctionGl so the Galician learner understands clearly.',
    'Keep the tone playful, patient, and supportive.',
  ].join('\n');
}

export function buildLiveSystemInstruction(params: {
  scenarioTitleEn: string;
  scenarioRole: string;
  cefrLevel: CefrLevel | string;
  ageTrack: AgeTrack | string;
  grade?: string;
  speechPace?: SpeechPace;
  missions?: string[];
  vocabularyList: string[];
}): string {
  const adaptation = resolveAdaptationProfile(
    params.ageTrack === '7-9' ? '7-9' : '10-14',
    params.grade
  );
  const pace = params.speechPace ?? adaptation.defaultPace;
  const vocabSlice = (params.vocabularyList || []).slice(0, 12).join(', ');

  const paceRule =
    pace === 'slow'
      ? 'SPEAKING PACE & DELIVERY (CRITICAL): Speak noticeably SLOWLY, warmly, and clearly, with clear articulation and short pauses between phrases so a young beginner learner (7–9 years old) can catch every single word. Do NOT rush.'
      : pace === 'moderate'
        ? 'SPEAKING PACE & DELIVERY: Speak at a calm, unhurried, clear pace with natural pauses between sentences so a 5º–6º Primaria learner understands effortlessly.'
        : 'SPEAKING PACE & DELIVERY: Speak clearly at a friendly, slightly unhurried A1–A2 pace with natural articulation.';

  const lexicalRule =
    adaptation.tier === 'starter'
      ? 'STRICT VOCABULARY & TURN LENGTH: Use ONLY very simple A1 words and the target words below. Keep every turn to 1–2 very short sentences (around 5–8 words each). Avoid idioms, phrasal verbs, or fast contractions. If the child pauses or speaks softly, encourage them warmly and give a 2-word hint.'
      : adaptation.tier === 'elementary'
        ? 'VOCABULARY & TURN LENGTH: Use simple, everyday A1–A2 words anchored in the target words below. Keep every turn to 1–2 short, clear sentences (8–11 words each). Avoid slang or complex B1+ vocabulary.'
        : 'VOCABULARY & TURN LENGTH: Use natural A1–A2 vocabulary anchored in the target words below. Keep turns concise (2–3 clear sentences) and ask one follow-up question at a time.';

  return [
    `You are ${params.scenarioRole} in "${params.scenarioTitleEn}" (${params.cefrLevel}) talking live with a Galician student in ${adaptation.grade} (${adaptation.cefrBadgeGl}).`,
    paceRule,
    lexicalRule,
    `Target vocabulary to practice naturally: ${vocabSlice || 'basic everyday words'}.`,
    params.missions && params.missions.length > 0
      ? `Communicative missions: ${params.missions.join('; ')}.`
      : '',
    'Always speak in clear, encouraging English. If the student struggles completely, you may say a quick supportive word in Galician and return immediately to simple English.',
  ]
    .filter(Boolean)
    .join('\n');
}
