import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  CheckCircle2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { SITUATION_MAP, SITUATION_SHORT_LABEL, SITUATIONS, VOCAB_ITEMS } from '../data/situations';
import { AgeTrack, SavedFlashcard, SituationId } from '../types';
import { speakEnglishWithFallback } from '../utils/audio';
import {
  buildAdaptedWelcomeMessage,
  buildLiveSystemInstruction,
  getSpeechRateForPace,
  resolveAdaptationProfile,
  SpeechPace,
} from '../utils/conversationAdaptation';
import { getCurriculumItemsForTrack } from '../utils/leitner';

interface ConversationViewProps {
  track: AgeTrack;
  grade?: string;
  activeSituation: SituationId;
  teacherUnlockedAll: boolean;
  onSelectSituation: (sit: SituationId) => void;
  onSaveFlashcards: (cards: Omit<SavedFlashcard, 'id' | 'createdAt'>[]) => void;
  onGoToGuidedMiniChallenge: () => void;
}

interface ChatEntry {
  id: string;
  speaker: 'user' | 'model';
  text: string;
  hintGl?: string;
  correctionGl?: string;
  streaming?: boolean;
}

interface ReviewItem {
  incorrect: string;
  correct: string;
  explanation: string;
}

function pcmBase64ToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const sampleCount = bytes.byteLength / 2;
  const outBuffer = new ArrayBuffer(sampleCount * 4);
  const samples = new Float32Array(outBuffer);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = view.getInt16(i * 2, true) / 32768;
  }
  return samples;
}

function float32ToPcm16Base64(input: Float32Array, sourceRate: number): string {
  const targetRate = 16000;
  const ratio = sourceRate / targetRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const buffer = new ArrayBuffer(outLength * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < outLength; i++) {
    const srcIdx = Math.min(input.length - 1, Math.floor(i * ratio));
    const s = Math.max(-1, Math.min(1, input[srcIdx]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  track,
  grade,
  activeSituation,
  teacherUnlockedAll,
  onSelectSituation,
  onSaveFlashcards,
  onGoToGuidedMiniChallenge,
}) => {
  const meta = SITUATION_MAP[activeSituation];
  const adaptation = useMemo(
    () => resolveAdaptationProfile(track, grade),
    [track, grade]
  );

  const situationWords = useMemo(() => {
    const effectiveTrack = teacherUnlockedAll ? '10-14' : track;
    const filtered = getCurriculumItemsForTrack(VOCAB_ITEMS, effectiveTrack, activeSituation);
    const list =
      filtered.length > 0
        ? filtered
        : VOCAB_ITEMS.filter((v) => v.situation === activeSituation);
    return list.map((v) => v.word);
  }, [activeSituation, track, teacherUnlockedAll]);

  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [speechPace, setSpeechPace] = useState<SpeechPace>(adaptation.defaultPace);
  const [messages, setMessages] = useState<ChatEntry[]>(() => {
    const welcome = buildAdaptedWelcomeMessage(meta, adaptation, situationWords);
    return [
      {
        id: 'welcome-turn',
        speaker: 'model',
        text: welcome.text,
        hintGl: welcome.hintGl,
      },
    ];
  });
  const [completedMissions, setCompletedMissions] = useState<Record<number, boolean>>({});
  const [inputText, setInputText] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Feedback / Review modal state
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<string | null>(null);
  const [reviewCards, setReviewCards] = useState<ReviewItem[]>([]);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Voice Live API state
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState(
    `Listo para conversar por voz (${adaptation.grade} · ${adaptation.paceLabelGl[adaptation.defaultPace]})`
  );
  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef(0);

  // Keep voice pace synchronized whenever the student's profile level/grade changes
  useEffect(() => {
    setSpeechPace(adaptation.defaultPace);
  }, [adaptation.defaultPace]);

  useEffect(() => {
    if (!voiceActive) {
      setVoiceStatus(
        `Listo para conversar por voz (${adaptation.grade} · ${adaptation.paceLabelGl[speechPace]})`
      );
    }
  }, [voiceActive, adaptation.grade, adaptation.paceLabelGl, speechPace]);

  // Reset conversation starter when switching situation or adaptation level/grade
  useEffect(() => {
    if (voiceActive) {
      stopVoiceSession();
    }
    const welcome = buildAdaptedWelcomeMessage(meta, adaptation, situationWords);
    setMessages([
      {
        id: `init-${activeSituation}-${adaptation.tier}`,
        speaker: 'model',
        text: welcome.text,
        hintGl: welcome.hintGl,
      },
    ]);
    setCompletedMissions({});
    setApiError(null);
    setReviewCards([]);
    setReviewSummary(null);
    setSavedNotice(null);
  }, [activeSituation, meta, adaptation, situationWords]);

  // Clean up Live audio on unmount
  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, []);

  const appendTranscriptChunk = (speaker: 'user' | 'model', chunk: string) => {
    const text = chunk;
    if (!text.trim()) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && last.streaming) {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          text: `${last.text}${last.text.endsWith(' ') || text.startsWith(' ') ? '' : ' '}${text}`.trim(),
        };
        return updated;
      }
      return [
        ...prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
        {
          id: `${speaker}-${Date.now()}-${Math.random()}`,
          speaker,
          text: text.trim(),
          streaming: true,
        },
      ];
    });
  };

  const stopVoiceSession = (statusLabel = 'Sesión de voz rematada') => {
    try {
      processorRef.current?.disconnect();
      processorRef.current = null;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    } catch {
      // ignore
    }
    setVoiceActive(false);
    setVoiceStatus(statusLabel);
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
  };

  const startVoiceSession = async () => {
    if (voiceActive) {
      stopVoiceSession();
      return;
    }
    setApiError(null);
    setVoiceStatus('Conectando co micrófono e con Gemini Live…');

    if (!navigator.mediaDevices?.getUserMedia) {
      setApiError(
        'Este navegador non permite usar o micrófono aquí. Usa o chat escrito xusto ao lado!'
      );
      setVoiceStatus('Micrófono non dispoñible');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const ctx = new AudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioCtxRef.current = ctx;
      nextPlayTimeRef.current = ctx.currentTime;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        const liveInstruction = buildLiveSystemInstruction({
          scenarioTitleEn: meta.titleEn,
          scenarioRole: meta.roleEn,
          cefrLevel: meta.level,
          ageTrack: track,
          grade: adaptation.grade,
          speechPace,
          missions: meta.missionsGl,
          vocabularyList: situationWords,
        });
        ws.send(
          JSON.stringify({
            action: 'start',
            ageTrack: track,
            grade: adaptation.grade,
            cefrLevel: meta.level,
            scenarioTitleEn: meta.titleEn,
            scenarioRole: meta.roleEn,
            speechPace,
            vocabularyList: situationWords.slice(0, 12),
            missions: meta.missionsGl,
            systemInstruction: liveInstruction,
          })
        );
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'open') {
          setVoiceActive(true);
          setVoiceStatus('En directo! Fala en inglés polo micrófono');
          const source = ctx.createMediaStreamSource(stream);
          const proc = ctx.createScriptProcessor(4096, 1, 1);
          const muteGain = ctx.createGain();
          muteGain.gain.value = 0;
          processorRef.current = proc;
          proc.onaudioprocess = (ev) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const channel = ev.inputBuffer.getChannelData(0);
            const b64 = float32ToPcm16Base64(channel, ctx.sampleRate);
            ws.send(JSON.stringify({ action: 'input', audio: b64 }));
          };
          source.connect(proc);
          proc.connect(muteGain);
          muteGain.connect(ctx.destination);
        } else if (msg.type === 'audio' && msg.data) {
          const samples = pcmBase64ToFloat32(msg.data);
          const audioBuf = ctx.createBuffer(1, samples.length, 24000);
          audioBuf.copyToChannel(samples, 0);
          const src = ctx.createBufferSource();
          src.buffer = audioBuf;
          src.connect(ctx.destination);
          const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
          src.start(startAt);
          nextPlayTimeRef.current = startAt + audioBuf.duration;
        } else if (msg.type === 'inputTranscript' && msg.text) {
          appendTranscriptChunk('user', msg.text);
        } else if (msg.type === 'outputTranscript' && msg.text) {
          appendTranscriptChunk('model', msg.text);
        } else if (msg.type === 'turnComplete') {
          setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
        } else if (msg.type === 'interrupted') {
          nextPlayTimeRef.current = ctx.currentTime;
        } else if (msg.type === 'error') {
          setApiError(msg.error || 'Non se puido iniciar a voz en vivo.');
          stopVoiceSession('Erro na sesión de voz');
        } else if (msg.type === 'close') {
          stopVoiceSession('Sesión de voz rematada');
        }
      };

      ws.onerror = () => {
        setApiError('Non se puido abrir a conexión de voz en vivo.');
        stopVoiceSession('Erro de conexión');
      };
    } catch {
      setApiError(
        'Non foi posible acceder ao micrófono. Podes usar o modo de chat escrito xusto ao lado.'
      );
      stopVoiceSession('Permiso de micrófono non dispoñible');
    }
  };

  const sendChatMessage = async (textToSend?: string) => {
    const content = (textToSend ?? inputText).trim();
    if (!content || loadingChat) return;

    const userMsg: ChatEntry = {
      id: `user-${Date.now()}`,
      speaker: 'user',
      text: content,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textToSend) setInputText('');
    setLoadingChat(true);
    setApiError(null);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          scenarioTitleEn: meta.titleEn,
          scenarioRole: meta.roleEn,
          cefrLevel: meta.level,
          ageTrack: track,
          grade: adaptation.grade,
          missions: meta.missionsGl,
          vocabularyList: situationWords,
          history: nextHistory.map((m) => ({ speaker: m.speaker, text: m.text })),
          userMessage: content,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || 'Non se puido conectar co titor IA.');
        return;
      }

      const reply: ChatEntry = {
        id: `model-${Date.now()}`,
        speaker: 'model',
        text: data.replyEn || 'Great job!',
        hintGl: data.hintGl || '',
        correctionGl: data.correctionGl || '',
      };
      setMessages((prev) => [...prev, reply]);
      if (typeof data.completedMissionIndex === 'number' && data.completedMissionIndex >= 0) {
        setCompletedMissions((prev) => ({ ...prev, [data.completedMissionIndex]: true }));
      }
      void speakEnglishWithFallback(reply.text, false, {
        pace: speechPace,
        rate: getSpeechRateForPace(speechPace),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setApiError('O titor IA tardou demasiado en responder. Téntao de novo nuns segundos.');
      } else {
        setApiError('Erro de rede ao contactar co servidor de conversa.');
      }
    } finally {
      window.clearTimeout(timer);
      setLoadingChat(false);
    }
  };

  const handleFinishAndReview = async () => {
    setReviewLoading(true);
    setApiError(null);
    setSavedNotice(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          transcript: messages.map((m) => ({ speaker: m.speaker, text: m.text })),
          ageTrack: track,
          grade: adaptation.grade,
          scenarioTitleGl: meta.titleGl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || 'Non se puido xerar o resumo coa IA.');
        return;
      }
      setReviewSummary(data.summaryGl || '');
      setReviewCards(Array.isArray(data.feedback) ? data.feedback : []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setApiError('A revisión tardou demasiado en xerarse. Téntao de novo.');
      } else {
        setApiError('Erro de rede ao solicitar a revisión final.');
      }
    } finally {
      window.clearTimeout(timer);
      setReviewLoading(false);
    }
  };

  const handleSaveAllCards = () => {
    if (reviewCards.length === 0) return;
    onSaveFlashcards(
      reviewCards.map((c) => ({
        situation: activeSituation,
        incorrect: c.incorrect,
        correct: c.correct,
        explanation: c.explanation,
      }))
    );
    setSavedNotice(`Gardadas ${reviewCards.length} tarxetas no teu caderno de Estudar!`);
  };

  return (
    <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
      <div className="max-w-[1160px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Scenario, Missions & Starter phrases */}
        <section className="lg:col-span-4 bg-[#ffffff] border border-[#d6cab4] rounded-2xl p-5 space-y-5">
          <div>
            <h1 className="font-display text-xl font-bold text-[#182433] mb-2">
              Conversa comunicativa
            </h1>
            <div className="flex flex-wrap gap-1.5">
              {SITUATIONS.map((s) => {
                const locked = !teacherUnlockedAll && track === '7-9' && s.trackMin === '10-14';
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={locked}
                    onClick={() => onSelectSituation(s.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      s.id === activeSituation
                        ? 'bg-[#1d4ed8] text-[#ffffff]'
                        : locked
                          ? 'bg-[#f7f4ec] text-[#94a3b8] border border-[#e2e8f0] cursor-not-allowed'
                          : 'bg-[#f7f4ec] text-[#182433] border border-[#d6cab4]'
                    }`}
                  >
                    {SITUATION_SHORT_LABEL[s.id]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#f7f4ec] border border-[#d6cab4] space-y-2">
            <div className="text-xs font-semibold text-[#1d4ed8]">
              {meta.titleEn} · Nivel {meta.level}
            </div>
            <div className="font-display text-base font-bold text-[#182433]">
              {meta.roleTitleGl}
            </div>
            <p className="text-xs text-[#4b5768]">{meta.summaryGl}</p>
          </div>

          <div>
            <h2 className="text-xs font-bold text-[#182433] mb-2">
              Obxectivos comunicativos desta escena
            </h2>
            <ul className="space-y-2">
              {meta.missionsGl.map((m, idx) => (
                <li
                  key={idx}
                  className={`flex items-start gap-2 text-xs p-2 rounded-lg ${
                    completedMissions[idx]
                      ? 'bg-[#dcfce7] text-[#15803d]'
                      : 'bg-[#f7f4ec] text-[#182433]'
                  }`}
                >
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      completedMissions[idx] ? 'text-[#15803d]' : 'text-[#94a3b8]'
                    }`}
                  />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold text-[#182433] mb-2">
              Frases útiles (preme para escoitar ou usar)
            </h2>
            <div className="space-y-2">
              {meta.starterPhrases.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-[#d6cab4] bg-[#ffffff] flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (mode === 'voice') {
                        if (voiceActive && wsRef.current?.readyState === WebSocket.OPEN) {
                          wsRef.current.send(JSON.stringify({ action: 'text', text: p.en }));
                          setMessages((prev) => [
                            ...prev,
                            { id: `u-${Date.now()}`, speaker: 'user', text: p.en },
                          ]);
                          return;
                        }
                        setMode('text');
                      }
                      setInputText(p.en);
                    }}
                    className="text-left flex-1 cursor-pointer"
                  >
                    <div className="text-xs font-bold text-[#182433]">{p.en}</div>
                    <div className="text-[11px] text-[#4b5768]">{p.gl}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void speakEnglishWithFallback(p.en, false, {
                        pace: speechPace,
                        rate: getSpeechRateForPace(speechPace),
                      })
                    }
                    className="p-1.5 rounded-md bg-[#efe8d8] text-[#182433] shrink-0 cursor-pointer"
                    aria-label={`Escoitar ${p.en}`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right column: Active Chat / Live Voice + Review */}
        <section className="lg:col-span-8 bg-[#ffffff] border border-[#d6cab4] rounded-2xl flex flex-col overflow-hidden min-h-[540px]">
          <div className="p-4 border-b border-[#efe8d8] bg-[#f7f4ec] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (voiceActive) stopVoiceSession();
                    setMode('text');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    mode === 'text'
                      ? 'bg-[#1d4ed8] text-[#ffffff]'
                      : 'bg-[#ffffff] text-[#182433] border border-[#d6cab4]'
                  }`}
                >
                  Chat guiado con IA
                </button>
                <button
                  type="button"
                  onClick={() => setMode('voice')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    mode === 'voice'
                      ? 'bg-[#1d4ed8] text-[#ffffff]'
                      : 'bg-[#ffffff] text-[#182433] border border-[#d6cab4]'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  Voz en vivo
                </button>
              </div>

              <button
                type="button"
                onClick={handleFinishAndReview}
                disabled={reviewLoading || messages.length < 2}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#182433] hover:bg-[#1d4ed8] text-[#ffffff] text-xs font-semibold disabled:opacity-45 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {reviewLoading ? 'Analizando…' : 'Rematar e revisar'}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e7dfd0] text-xs">
              <div className="text-[#4b5768]" data-testid="conversation-adaptation-summary">
                <span className="font-semibold text-[#182433]">
                  {adaptation.grade} · {adaptation.cefrBadgeGl}
                </span>
                {' · '}
                <span>{adaptation.lexicalBadgeGl}</span>
              </div>

              <div className="flex items-center gap-1.5" role="group" aria-label="Ritmo da voz">
                <span className="text-[11px] font-semibold text-[#4b5768]">Ritmo da voz:</span>
                {(['slow', 'moderate', 'standard'] as SpeechPace[]).map((paceOption) => (
                  <button
                    key={paceOption}
                    type="button"
                    aria-pressed={speechPace === paceOption}
                    onClick={() => setSpeechPace(paceOption)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                      speechPace === paceOption
                        ? 'bg-[#182433] text-[#ffffff]'
                        : 'bg-[#ffffff] text-[#4b5768] border border-[#d6cab4] hover:text-[#182433]'
                    }`}
                  >
                    {adaptation.paceLabelGl[paceOption]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Messages feed */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 max-h-[420px]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.speaker === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    m.speaker === 'user'
                      ? 'bg-[#1d4ed8] text-[#ffffff]'
                      : 'bg-[#f7f4ec] border border-[#d6cab4] text-[#182433]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{m.text}</p>
                    {m.speaker === 'model' && (
                      <button
                        type="button"
                        onClick={() =>
                          void speakEnglishWithFallback(m.text, false, {
                            pace: speechPace,
                            rate: getSpeechRateForPace(speechPace),
                          })
                        }
                        className="p-1 rounded bg-[#ffffff] text-[#1d4ed8] shrink-0 cursor-pointer"
                        aria-label="Escoitar resposta"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {m.correctionGl && (
                    <p className="text-xs mt-2 px-2.5 py-1.5 rounded-lg bg-[#fef3c7] text-[#92400e]">
                      <strong>Corrección:</strong> {m.correctionGl}
                    </p>
                  )}
                  {m.hintGl && (
                    <p className="text-xs mt-1.5 text-[#4b5768]">
                      <strong>Consello:</strong> {m.hintGl}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {apiError && (
            <div
              role="alert"
              className="mx-5 mb-3 p-3.5 rounded-xl bg-[#fee2e2] border border-[#fca5a5] text-[#b91c1c] text-xs space-y-2"
            >
              <p className="font-semibold">{apiError}</p>
              <div className="flex flex-wrap items-center gap-3">
                {mode === 'voice' && (
                  <button
                    type="button"
                    onClick={() => {
                      setApiError(null);
                      setMode('text');
                    }}
                    className="px-2.5 py-1 rounded-md bg-[#ffffff] border border-[#fca5a5] text-[#182433] font-semibold cursor-pointer"
                  >
                    Usar chat escrito
                  </button>
                )}
                <button
                  type="button"
                  onClick={onGoToGuidedMiniChallenge}
                  className="inline-block underline font-bold cursor-pointer"
                >
                  Ir ao Mini-Reto comunicativo sen conexión en Explorar 3D →
                </button>
              </div>
            </div>
          )}

          {/* Review flashcards result */}
          {(reviewSummary || reviewCards.length > 0) && (
            <div className="mx-5 mb-4 p-4 rounded-xl bg-[#eff6ff] border border-[#bfdbfe] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-[#182433]">
                  Resumo e tarxetas personalizadas
                </h3>
                {reviewCards.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveAllCards}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1d4ed8] text-[#ffffff] text-xs font-semibold cursor-pointer"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    Gardar tarxetas en Estudar
                  </button>
                )}
              </div>
              {reviewSummary && <p className="text-xs text-[#182433]">{reviewSummary}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {reviewCards.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-[#ffffff] border border-[#d6cab4] text-xs space-y-1"
                  >
                    <div className="text-[#b91c1c] line-through">{c.incorrect}</div>
                    <div className="font-bold text-[#15803d]">{c.correct}</div>
                    <div className="text-[#4b5768]">{c.explanation}</div>
                  </div>
                ))}
              </div>
              {savedNotice && (
                <p className="text-xs font-bold text-[#15803d]">{savedNotice}</p>
              )}
            </div>
          )}

          {/* Input footer */}
          {mode === 'text' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendChatMessage();
              }}
              className="p-4 border-t border-[#efe8d8] flex gap-2.5 bg-[#ffffff]"
            >
              <label htmlFor="chat-input" className="sr-only">
                Mensaxe en inglés
              </label>
              <input
                id="chat-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={adaptation.inputPlaceholderGl}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#d6cab4] bg-[#f7f4ec] text-sm"
              />
              <button
                type="submit"
                disabled={loadingChat || !inputText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-[#ffffff] text-sm font-semibold disabled:opacity-45 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {loadingChat ? 'Enviando…' : 'Enviar'}
              </button>
            </form>
          ) : (
            <div className="p-4 border-t border-[#efe8d8] bg-[#ffffff] flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-[#182433]">{voiceStatus}</div>
                <div className="text-[11px] text-[#4b5768]">
                  Voz adaptada a {adaptation.grade} ({adaptation.cefrBadgeGl}) ·{' '}
                  {adaptation.paceLabelGl[speechPace]}
                </div>
              </div>
              <button
                type="button"
                onClick={startVoiceSession}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#ffffff] cursor-pointer ${
                  voiceActive ? 'bg-[#b91c1c] hover:bg-[#991b1b]' : 'bg-[#1d4ed8] hover:bg-[#1e40af]'
                }`}
              >
                {voiceActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {voiceActive ? 'Deter micrófono' : 'Iniciar micrófono'}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
