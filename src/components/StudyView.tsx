import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  FlipHorizontal,
  Lock,
  RotateCw,
  Volume2,
  XCircle,
} from 'lucide-react';
import { SITUATION_SHORT_LABEL, SITUATIONS, VOCAB_ITEMS, VOCAB_MAP } from '../data/situations';
import { AgeTrack, SavedFlashcard, SituationId, StudentState, VocabItem } from '../types';
import { speakEnglishWithFallback } from '../utils/audio';
import { checkEnglishWordAnswer } from '../utils/evaluation';
import {
  getCurriculumItemsForTrack,
  getDueCardIds,
  getLeitnerDistribution,
  LEITNER_INTERVAL_DAYS,
} from '../utils/leitner';

interface StudyViewProps {
  studentState: StudentState;
  thumbnails: Record<string, string>;
  onRecordLeitner: (vocabId: string, outcome: 'correct' | 'partial' | 'wrong', xpGain: number) => void;
  onCompleteTest: (kind: 'initial' | 'final', score: number, total: number, answers: Record<string, boolean>) => void;
  onRemoveSavedFlashcard: (id: string) => void;
}

type StudyPanel = 'leitner' | 'initial_test' | 'final_test' | 'ai_cards';
type CardMode = 'flip' | 'image_write' | 'gl_to_en' | 'audio_write' | 'gap';

const CARD_MODE_LABELS: Record<CardMode, string> = {
  flip: 'Tarxeta 3D Flip',
  image_write: 'Imaxe 3D -> Escribir',
  gl_to_en: 'Galego -> Inglés',
  audio_write: 'Escoita -> Escribir',
  gap: 'Frase con oco',
};

export const StudyView: React.FC<StudyViewProps> = ({
  studentState,
  thumbnails,
  onRecordLeitner,
  onCompleteTest,
  onRemoveSavedFlashcard,
}) => {
  const track: AgeTrack = studentState.profile?.track ?? '10-14';
  const effectiveTrack: AgeTrack = studentState.teacherUnlockedAll ? '10-14' : track;

  const [panel, setPanel] = useState<StudyPanel>('leitner');
  const [situationFilter, setSituationFilter] = useState<SituationId | 'all'>('all');
  const [cardMode, setCardMode] = useState<CardMode>('flip');

  // Flashcard session state
  const [isFlipped, setIsFlipped] = useState(false);
  const [answerInput, setAnswerInput] = useState('');
  const [cardFeedback, setCardFeedback] = useState<{
    ok: boolean;
    message: string;
    note?: string;
  } | null>(null);
  const [sessionIndex, setSessionIndex] = useState(0);

  // Initial / Final test state
  const [testItems, setTestItems] = useState<VocabItem[]>([]);
  const [testStep, setTestStep] = useState(0);
  const [testInput, setTestInput] = useState('');
  const [testAnswers, setTestAnswers] = useState<Record<string, boolean>>({});
  const [testNotice, setTestNotice] = useState<string | null>(null);

  // Saved AI Flashcard flip tracking
  const [flippedAiIds, setFlippedAiIds] = useState<Record<string, boolean>>({});

  const curriculumItems = useMemo(
    () => getCurriculumItemsForTrack(VOCAB_ITEMS, effectiveTrack, situationFilter),
    [effectiveTrack, situationFilter]
  );

  const allTrackItems = useMemo(
    () => getCurriculumItemsForTrack(VOCAB_ITEMS, effectiveTrack, 'all'),
    [effectiveTrack]
  );

  const boxDistribution = useMemo(
    () => getLeitnerDistribution(allTrackItems, studentState.leitner),
    [allTrackItems, studentState.leitner]
  );

  const dueIds = useMemo(
    () => getDueCardIds(curriculumItems, studentState.leitner),
    [curriculumItems, studentState.leitner]
  );

  const masteredCount = (boxDistribution[3] ?? 0) + (boxDistribution[4] ?? 0) + (boxDistribution[5] ?? 0);
  const finalUnlocked =
    studentState.finalTest.unlocked ||
    studentState.teacherUnlockedAll ||
    (allTrackItems.length > 0 && masteredCount >= Math.ceil(allTrackItems.length * 0.5));

  const activeQueue = dueIds.length > 0 ? dueIds : curriculumItems.map((i) => i.id);
  const currentCardId = activeQueue[sessionIndex % Math.max(activeQueue.length, 1)] ?? null;
  const currentCard: VocabItem | null = currentCardId ? VOCAB_MAP[currentCardId] ?? null : null;

  const advanceCard = () => {
    setIsFlipped(false);
    setAnswerInput('');
    setCardFeedback(null);
    setSessionIndex((i) => i + 1);
  };

  const handleCheckWritten = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard || cardFeedback) return;
    const otherWords = curriculumItems.map((i) => i.word);
    const res = checkEnglishWordAnswer(answerInput, currentCard, otherWords);

    if (res.accepted) {
      const outcome = res.kind === 'exact' || res.kind === 'variant' ? 'correct' : 'partial';
      onRecordLeitner(currentCard.id, outcome, outcome === 'correct' ? 12 : 8);
      setCardFeedback({
        ok: true,
        message: `Correcto! «${currentCard.word}» (${currentCard.gl}).`,
        note: res.noteGl,
      });
      void speakEnglishWithFallback(currentCard.word, false);
    } else {
      onRecordLeitner(currentCard.id, 'wrong', 2);
      setCardFeedback({
        ok: false,
        message:
          res.kind === 'other_word' && res.otherWord
            ? `Escribiches «${res.otherWord}», pero esta palabra é «${currentCard.word}» (${currentCard.gl}).`
            : `A resposta correcta é «${currentCard.word}» (${currentCard.gl}).`,
      });
    }
  };

  const startTest = (kind: 'initial' | 'final') => {
    const pool = [...allTrackItems];
    // Deterministic slice spread across situations (up to 10 items)
    const sample: VocabItem[] = [];
    const stride = Math.max(1, Math.floor(pool.length / 10));
    for (let i = 0; i < pool.length && sample.length < 10; i += stride) {
      sample.push(pool[i]);
    }
    setTestItems(sample);
    setTestStep(0);
    setTestInput('');
    setTestAnswers({});
    setTestNotice(null);
    setPanel(kind === 'initial' ? 'initial_test' : 'final_test');
  };

  const handleTestSubmit = (e: React.FormEvent, kind: 'initial' | 'final') => {
    e.preventDefault();
    const item = testItems[testStep];
    if (!item) return;

    const res = checkEnglishWordAnswer(testInput, item, allTrackItems.map((i) => i.word));
    const nextAnswers = { ...testAnswers, [item.id]: res.accepted };
    setTestAnswers(nextAnswers);
    setTestNotice(
      res.accepted
        ? `Ben! «${item.word}»`
        : `Resposta esperada: «${item.word}» (${item.gl})`
    );

    if (testStep + 1 < testItems.length) {
      window.setTimeout(() => {
        setTestStep((s) => s + 1);
        setTestInput('');
        setTestNotice(null);
      }, 650);
    } else {
      const score = Object.values(nextAnswers).filter(Boolean).length;
      onCompleteTest(kind, score, testItems.length, nextAnswers);
      setPanel('leitner');
    }
  };

  const toggleAiCard = (id: string) => {
    setFlippedAiIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
      <div className="max-w-[1160px] mx-auto space-y-6">
        {/* Top summary + panel switcher */}
        <section className="bg-[#ffffff] border border-[#d6cab4] rounded-2xl p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-[#182433]">
                Estudo e práctica espaciada (Leitner)
              </h1>
              <p className="text-sm text-[#4b5768] mt-1">
                Itinerario {track === '7-9' ? '7–9 anos · A1 Inicial' : '10–14 anos · 5º EP–2º ESO (A1–A2)'} ·{' '}
                <span className="tabular-nums font-semibold text-[#182433]">
                  {masteredCount} / {allTrackItems.length}
                </span>{' '}
                palabras dominadas (caixa 3+)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => startTest('initial')}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#efe8d8] hover:bg-[#e5dbc5] text-[#182433] whitespace-nowrap shrink-0 cursor-pointer"
              >
                {studentState.initialTest.done
                  ? `Proba inicial (${studentState.initialTest.score}/${studentState.initialTest.total})`
                  : 'Facer proba inicial'}
              </button>

              <button
                type="button"
                disabled={!finalUnlocked}
                onClick={() => startTest('final')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                  finalUnlocked
                    ? 'bg-[#1d4ed8] hover:bg-[#1e40af] text-[#ffffff] cursor-pointer'
                    : 'bg-[#f7f4ec] text-[#94a3b8] border border-[#d6cab4] cursor-not-allowed'
                }`}
                title={
                  finalUnlocked
                    ? 'Avaliación final de vocabulario'
                    : 'Desbloquéase ao dominar a metade do vocabulario ou desde Docente'
                }
              >
                {!finalUnlocked && <Lock className="w-3.5 h-3.5" />}
                {studentState.finalTest.done
                  ? `Proba final (${studentState.finalTest.score}/${studentState.finalTest.total})`
                  : 'Proba final'}
              </button>

              <button
                type="button"
                onClick={() => setPanel(panel === 'ai_cards' ? 'leitner' : 'ai_cards')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  panel === 'ai_cards'
                    ? 'bg-[#182433] text-[#ffffff]'
                    : 'bg-[#f7f4ec] text-[#182433] border border-[#d6cab4] hover:bg-[#efe8d8]'
                }`}
              >
                Tarxetas IA ({studentState.savedFlashcards.length})
              </button>
            </div>
          </div>

          {/* 5 Leitner Boxes bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[1, 2, 3, 4, 5].map((boxNum) => {
              const count = boxDistribution[boxNum] ?? 0;
              const days = LEITNER_INTERVAL_DAYS[boxNum - 1];
              return (
                <div
                  key={boxNum}
                  className="p-3 rounded-xl bg-[#f7f4ec] border border-[#d6cab4] flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-[#182433]">Caixa {boxNum}</div>
                    <div className="text-xs text-[#4b5768]">
                      {days === 0 ? 'Repaso hoxe' : `Cada ${days} d.`}
                    </div>
                  </div>
                  <div className="font-mono-num text-xl font-bold text-[#1d4ed8]">{count}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Panel: Leitner Flashcard Practice */}
        {panel === 'leitner' && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left controls: situation filter & card mode */}
            <div className="lg:col-span-4 bg-[#ffffff] border border-[#d6cab4] rounded-2xl p-5 space-y-5">
              <div>
                <h2 className="font-display text-base font-bold text-[#182433] mb-2">
                  Filtrar por situación
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSituationFilter('all');
                      setSessionIndex(0);
                      setCardFeedback(null);
                      setIsFlipped(false);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      situationFilter === 'all'
                        ? 'bg-[#1d4ed8] text-[#ffffff]'
                        : 'bg-[#f7f4ec] text-[#182433] border border-[#d6cab4]'
                    }`}
                  >
                    Todas
                  </button>
                  {SITUATIONS.filter((s) => effectiveTrack === '10-14' || s.trackMin === '7-9').map(
                    (s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSituationFilter(s.id);
                          setSessionIndex(0);
                          setCardFeedback(null);
                          setIsFlipped(false);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          situationFilter === s.id
                            ? 'bg-[#1d4ed8] text-[#ffffff]'
                            : 'bg-[#f7f4ec] text-[#182433] border border-[#d6cab4]'
                        }`}
                      >
                        {SITUATION_SHORT_LABEL[s.id]}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <h2 className="font-display text-base font-bold text-[#182433] mb-2">
                  Modalidade de flashcard
                </h2>
                <div className="space-y-1.5">
                  {(Object.keys(CARD_MODE_LABELS) as CardMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setCardMode(mode);
                        setIsFlipped(false);
                        setCardFeedback(null);
                        setAnswerInput('');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        cardMode === mode
                          ? 'bg-[#eff6ff] text-[#1d4ed8] border border-[#1d4ed8]'
                          : 'bg-[#f7f4ec] text-[#182433] border border-[#d6cab4] hover:bg-[#efe8d8]'
                      }`}
                    >
                      {CARD_MODE_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#efe8d8] text-xs text-[#4b5768] tabular-nums">
                Pendentes de repaso hoxe nesta selección:{' '}
                <strong className="text-[#182433]">{dueIds.length}</strong> de {curriculumItems.length}
              </div>
            </div>

            {/* Right stage: Active Flashcard */}
            <div className="lg:col-span-8 bg-[#ffffff] border border-[#d6cab4] rounded-2xl p-6 md:p-8">
              {!currentCard ? (
                <p className="text-sm text-[#4b5768]">
                  Non hai tarxetas dispoñibles neste filtro.
                </p>
              ) : cardMode === 'flip' ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between text-xs text-[#4b5768]">
                    <span>
                      Caixa {studentState.leitner[currentCard.id]?.box ?? 1} · {currentCard.level}
                    </span>
                    <button
                      type="button"
                      onClick={() => void speakEnglishWithFallback(currentCard.word, false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#efe8d8] text-[#182433] font-semibold cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Escoitar en inglés
                    </button>
                  </div>

                  <div className="flashcard-perspective">
                    <div
                      className={`flashcard-inner relative w-full min-h-[270px] ${
                        isFlipped ? 'is-flipped' : ''
                      }`}
                    >
                      {/* Front: 3D thumbnail + English */}
                      <div className="flashcard-face absolute inset-0 rounded-2xl border border-[#d6cab4] bg-[#f7f4ec] p-6 flex flex-col items-center justify-center text-center">
                        {thumbnails[currentCard.id] && (
                          <img
                            src={thumbnails[currentCard.id]}
                            alt={currentCard.word}
                            className="w-32 h-32 object-contain mb-3"
                          />
                        )}
                        <div className="font-display text-3xl font-bold text-[#182433]">
                          {currentCard.article !== '-' ? `${currentCard.article} ` : ''}
                          {currentCard.word}
                        </div>
                        <div className="text-xs text-[#4b5768] mt-1">
                          Pronuncia aproximada: {currentCard.phoneticHint}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsFlipped(true)}
                          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1d4ed8] text-[#ffffff] text-xs font-semibold cursor-pointer"
                        >
                          <FlipHorizontal className="w-4 h-4" />
                          Dar a volta á tarxeta
                        </button>
                      </div>

                      {/* Back: Galician + Example + Self-rating */}
                      <div className="flashcard-face flashcard-back absolute inset-0 rounded-2xl border border-[#1d4ed8] bg-[#eff6ff] p-6 flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-semibold text-[#1d4ed8]">
                            Significado en galego
                          </div>
                          <div className="font-display text-2xl font-bold text-[#182433] mt-1">
                            {currentCard.gl}
                          </div>
                          <p className="text-sm text-[#182433] mt-3">
                            <strong>EN:</strong> {currentCard.exampleEn}
                          </p>
                          <p className="text-sm text-[#4b5768] mt-1">
                            <strong>GL:</strong> {currentCard.exampleGl}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-[#bfdbfe]">
                          <button
                            type="button"
                            onClick={() => setIsFlipped(false)}
                            className="px-3 py-2 rounded-lg text-xs font-semibold text-[#4b5768] hover:text-[#182433] cursor-pointer"
                          >
                            Ver fronte
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onRecordLeitner(currentCard.id, 'wrong', 2);
                                advanceCard();
                              }}
                              className="px-4 py-2 rounded-lg bg-[#fee2e2] text-[#b91c1c] text-xs font-bold cursor-pointer"
                            >
                              Repasar logo (Caixa 1)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onRecordLeitner(currentCard.id, 'correct', 10);
                                advanceCard();
                              }}
                              className="px-4 py-2 rounded-lg bg-[#15803d] text-[#ffffff] text-xs font-bold cursor-pointer"
                            >
                              Sabíaa! (Subir caixa)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Written / Listening / Gap-fill Card Modes */
                <div className="space-y-5">
                  <div className="flex items-center justify-between text-xs text-[#4b5768]">
                    <span>
                      {CARD_MODE_LABELS[cardMode]} · Caixa {studentState.leitner[currentCard.id]?.box ?? 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => void speakEnglishWithFallback(currentCard.word, false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#efe8d8] text-[#182433] font-semibold cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Escoitar palabra
                    </button>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#f7f4ec] border border-[#d6cab4] flex flex-col items-center text-center">
                    {(cardMode === 'image_write' || cardMode === 'gap') && thumbnails[currentCard.id] && (
                      <img
                        src={thumbnails[currentCard.id]}
                        alt="Obxecto 3D para adiviñar"
                        className="w-32 h-32 object-contain mb-3"
                      />
                    )}

                    {cardMode === 'image_write' && (
                      <>
                        <p className="font-display text-lg font-bold text-[#182433]">
                          Como se escribe este obxecto en inglés?
                        </p>
                        <p className="text-xs text-[#4b5768] mt-1">{currentCard.clueGl}</p>
                      </>
                    )}

                    {cardMode === 'gl_to_en' && (
                      <>
                        <p className="text-xs text-[#4b5768] mb-1">Traduce ao inglés:</p>
                        <p className="font-display text-2xl font-bold text-[#182433]">
                          {currentCard.gl}
                        </p>
                      </>
                    )}

                    {cardMode === 'audio_write' && (
                      <>
                        <p className="font-display text-lg font-bold text-[#182433] mb-2">
                          Escoita e escribe a palabra en inglés
                        </p>
                        <button
                          type="button"
                          onClick={() => void speakEnglishWithFallback(currentCard.word, false)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1d4ed8] text-[#ffffff] text-sm font-semibold cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4" />
                          Reproducir audio
                        </button>
                        <p className="text-xs text-[#4b5768] mt-2">
                          Pista en galego: {currentCard.gl}
                        </p>
                      </>
                    )}

                    {cardMode === 'gap' && (
                      <>
                        <p className="text-xs text-[#4b5768] mb-1">Completa o oco en inglés:</p>
                        <p className="font-display text-xl font-bold text-[#182433] max-w-lg">
                          {currentCard.gapSentenceEn}
                        </p>
                        <p className="text-xs text-[#4b5768] mt-2">
                          Pista: {currentCard.gl}
                        </p>
                      </>
                    )}
                  </div>

                  <form onSubmit={handleCheckWritten} className="flex flex-col sm:flex-row gap-2.5">
                    <label htmlFor="flashcard-answer" className="sr-only">
                      Resposta en inglés
                    </label>
                    <input
                      id="flashcard-answer"
                      type="text"
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      disabled={Boolean(cardFeedback)}
                      placeholder="Escribe en inglés..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-[#d6cab4] bg-[#ffffff] text-[#182433]"
                    />
                    {!cardFeedback ? (
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-[#ffffff] text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Comprobar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={advanceCard}
                        className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#182433] text-[#ffffff] text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RotateCw className="w-4 h-4" />
                        Seguinte tarxeta
                      </button>
                    )}
                  </form>

                  {cardFeedback && (
                    <div
                      role="status"
                      className={`p-3.5 rounded-xl text-sm font-semibold flex items-start gap-2 ${
                        cardFeedback.ok
                          ? 'bg-[#dcfce7] text-[#15803d]'
                          : 'bg-[#fee2e2] text-[#b91c1c]'
                      }`}
                    >
                      {cardFeedback.ok ? (
                        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div>{cardFeedback.message}</div>
                        {cardFeedback.note && (
                          <div className="text-xs font-normal mt-0.5">{cardFeedback.note}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Panel: Initial or Final Test */}
        {(panel === 'initial_test' || panel === 'final_test') && testItems[testStep] && (
          <section className="bg-[#ffffff] border border-[#d6cab4] rounded-2xl p-6 md:p-8 max-w-2xl mx-auto space-y-5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#4b5768] tabular-nums">
              <span>
                {panel === 'initial_test' ? 'Proba inicial' : 'Proba final'} · Pregunta{' '}
                {testStep + 1} de {testItems.length}
              </span>
              <button
                type="button"
                onClick={() => setPanel('leitner')}
                className="text-[#1d4ed8] hover:underline cursor-pointer"
              >
                Saír ao repaso
              </button>
            </div>

            <div className="p-5 rounded-xl bg-[#f7f4ec] border border-[#d6cab4] flex items-center gap-4">
              {thumbnails[testItems[testStep].id] && (
                <img
                  src={thumbnails[testItems[testStep].id]}
                  alt={testItems[testStep].gl}
                  className="w-24 h-24 object-contain shrink-0"
                />
              )}
              <div>
                <div className="text-xs text-[#4b5768]">Como se di en inglés?</div>
                <div className="font-display text-2xl font-bold text-[#182433]">
                  {testItems[testStep].gl}
                </div>
                <div className="text-xs text-[#4b5768] mt-1">{testItems[testStep].clueGl}</div>
              </div>
            </div>

            <form
              onSubmit={(e) =>
                handleTestSubmit(e, panel === 'initial_test' ? 'initial' : 'final')
              }
              className="flex gap-2.5"
            >
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Escribe a palabra en inglés..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#d6cab4]"
                autoFocus
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#1d4ed8] text-[#ffffff] text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Enviar
              </button>
            </form>

            {testNotice && (
              <p className="text-sm font-semibold text-[#182433] bg-[#efe8d8] px-3.5 py-2 rounded-lg">
                {testNotice}
              </p>
            )}
          </section>
        )}

        {/* Panel: Saved AI Conversation Flashcards (adapted from Falamos Flashcard.tsx) */}
        {panel === 'ai_cards' && (
          <section className="bg-[#ffffff] border border-[#d6cab4] rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-[#182433]">
                  Caderno de tarxetas da conversa
                </h2>
                <p className="text-sm text-[#4b5768]">
                  Expresións gardadas durante as túas prácticas de conversa coa IA. Preme cada tarxeta para ver a corrección.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanel('leitner')}
                className="px-3.5 py-2 rounded-lg bg-[#efe8d8] text-xs font-semibold text-[#182433] cursor-pointer"
              >
                Volver a Leitner
              </button>
            </div>

            {studentState.savedFlashcards.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#f7f4ec] border border-[#d6cab4] text-center space-y-2">
                <BookOpen className="w-8 h-8 text-[#4b5768] mx-auto" />
                <p className="text-sm font-semibold text-[#182433]">
                  Aínda non gardaches ningunha tarxeta desde Conversa
                </p>
                <p className="text-xs text-[#4b5768]">
                  Practica na lapela Conversa e preme «Rematar e revisar» para crear tarxetas personalizadas coa IA.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {studentState.savedFlashcards.map((card: SavedFlashcard) => {
                  const flipped = Boolean(flippedAiIds[card.id]);
                  return (
                    <div
                      key={card.id}
                      className="p-4 rounded-xl border border-[#d6cab4] bg-[#f7f4ec] flex flex-col justify-between gap-3"
                    >
                      {!flipped ? (
                        <div>
                          <div className="text-xs font-semibold text-[#b45309] mb-1">
                            Frase inicial
                          </div>
                          <p className="text-base font-bold text-[#182433]">{card.incorrect}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div>
                            <div className="text-xs font-semibold text-[#15803d]">
                              Expresión natural en inglés
                            </div>
                            <p className="text-base font-bold text-[#182433]">{card.correct}</p>
                          </div>
                          <p className="text-xs text-[#4b5768]">{card.explanation}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#d6cab4]">
                        <button
                          type="button"
                          onClick={() => toggleAiCard(card.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1d4ed8] cursor-pointer"
                        >
                          <Award className="w-3.5 h-3.5" />
                          {flipped ? 'Ver frase inicial' : 'Ver corrección'}
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void speakEnglishWithFallback(card.correct, false)}
                            className="p-1.5 rounded-md bg-[#ffffff] border border-[#d6cab4] text-[#182433] cursor-pointer"
                            aria-label={`Escoitar ${card.correct}`}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveSavedFlashcard(card.id)}
                            className="text-xs text-[#b91c1c] hover:underline cursor-pointer"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
};
