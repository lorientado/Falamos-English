import React, { useMemo, useState } from 'react';
import { CheckCircle2, Headphones, MessageSquare, Sparkles, Volume2 } from 'lucide-react';
import { SITUATION_MAP, SITUATION_SHORT_LABEL, SITUATIONS, VOCAB_ITEMS } from '../data/situations';
import { AgeTrack, SituationId, VocabItem } from '../types';
import { speakEnglishWithFallback } from '../utils/audio';
import { getCurriculumItemsForTrack } from '../utils/leitner';

interface ExplorerViewProps {
  track: AgeTrack;
  activeSituation: SituationId;
  selectedId: string | null;
  thumbnails: Record<string, string>;
  dialogueCompleted: Record<SituationId, boolean>;
  teacherUnlockedAll: boolean;
  onSelectSituation: (sit: SituationId) => void;
  onSelectObject: (vocabId: string) => void;
  onCompleteGuidedDialogue: (sit: SituationId) => void;
  onGoToConversation: () => void;
  onGoToStudy: () => void;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  track,
  activeSituation,
  selectedId,
  thumbnails,
  dialogueCompleted,
  teacherUnlockedAll,
  onSelectSituation,
  onSelectObject,
  onCompleteGuidedDialogue,
  onGoToConversation,
  onGoToStudy,
}) => {
  const [subMode, setSubMode] = useState<'lexico' | 'escoita' | 'dialogo'>('lexico');
  const [audioStatus, setAudioStatus] = useState('');

  // Guided Dialogue state
  const [stepIdx, setStepIdx] = useState(0);
  const [pickedOption, setPickedOption] = useState<number | null>(null);

  // Listening challenge state
  const [listenTargetId, setListenTargetId] = useState<string | null>(null);
  const [listenFeedback, setListenFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const situationMeta = SITUATION_MAP[activeSituation];

  const itemsInSituation = useMemo(() => {
    const effectiveTrack = teacherUnlockedAll ? '10-14' : track;
    const filtered = getCurriculumItemsForTrack(VOCAB_ITEMS, effectiveTrack, activeSituation);
    return filtered.length > 0
      ? filtered
      : VOCAB_ITEMS.filter((i) => i.situation === activeSituation);
  }, [activeSituation, track, teacherUnlockedAll]);

  const selectedItem: VocabItem | null = useMemo(() => {
    if (!selectedId) return itemsInSituation[0] ?? null;
    return itemsInSituation.find((i) => i.id === selectedId) ?? itemsInSituation[0] ?? null;
  }, [selectedId, itemsInSituation]);

  const playWord = async (text: string) => {
    setAudioStatus('Reproducindo…');
    const res = await speakEnglishWithFallback(text, false);
    setAudioStatus(
      res.mode === 'none'
        ? 'O navegador non ten síntese de voz en inglés dispoñible.'
        : ''
    );
  };

  const handleSituationSwitch = (sit: SituationId) => {
    onSelectSituation(sit);
    setStepIdx(0);
    setPickedOption(null);
    setListenTargetId(null);
    setListenFeedback(null);
  };

  // Start a quick listening round
  const startListeningRound = () => {
    const pool = itemsInSituation;
    if (pool.length === 0) return;
    const next = pool[Math.floor(Math.random() * pool.length)];
    setListenTargetId(next.id);
    setListenFeedback(null);
    void speakEnglishWithFallback(next.word, false);
  };

  const listeningChoices = useMemo(() => {
    if (!listenTargetId) return [];
    const target = itemsInSituation.find((i) => i.id === listenTargetId);
    if (!target) return [];
    const others = itemsInSituation.filter((i) => i.id !== listenTargetId).slice(0, 3);
    const all = [target, ...others];
    return all.sort((a, b) => a.word.localeCompare(b.word));
  }, [listenTargetId, itemsInSituation]);

  const currentDialogueStep = situationMeta.guidedDialogue[stepIdx];

  const handleDialogueOption = (optIdx: number) => {
    if (!currentDialogueStep) return;
    setPickedOption(optIdx);
    const opt = currentDialogueStep.options[optIdx];
    if (opt.isCorrect) {
      void speakEnglishWithFallback(opt.textEn, false);
    }
  };

  const handleNextDialogueStep = () => {
    if (stepIdx + 1 < situationMeta.guidedDialogue.length) {
      setStepIdx((s) => s + 1);
      setPickedOption(null);
    } else {
      onCompleteGuidedDialogue(activeSituation);
    }
  };

  return (
    <aside className="w-full lg:w-[460px] shrink-0 bg-[#ffffff] border border-[#d6cab4] rounded-xl flex flex-col overflow-hidden">
      {/* Situation selector bar */}
      <div className="p-4 border-b border-[#efe8d8]">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h2 className="font-display text-lg font-bold text-[#182433]">
            Situacións A1–A2
          </h2>
          <span className="text-xs font-medium text-[#4b5768] tabular-nums">
            {track === '7-9' ? 'Itinerario 7–9 anos' : 'Itinerario 10–14 anos'}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SITUATIONS.map((sit) => {
            const lockedForYoung = !teacherUnlockedAll && track === '7-9' && sit.trackMin === '10-14';
            const isActive = sit.id === activeSituation;
            return (
              <button
                key={sit.id}
                type="button"
                disabled={lockedForYoung}
                onClick={() => handleSituationSwitch(sit.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#1d4ed8] text-[#ffffff]'
                    : lockedForYoung
                      ? 'bg-[#f7f4ec] text-[#94a3b8] border border-[#e2e8f0] cursor-not-allowed'
                      : 'bg-[#f7f4ec] text-[#182433] border border-[#d6cab4] hover:bg-[#efe8d8]'
                }`}
                title={
                  lockedForYoung
                    ? 'Nivel A2 (10–14 anos). Podes cambialo no perfil ou en Docente.'
                    : `${sit.titleEn} (${sit.level})`
                }
              >
                {SITUATION_SHORT_LABEL[sit.id]} {sit.level}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-[#4b5768] mt-2.5">
          <strong className="text-[#182433]">{situationMeta.titleEn}</strong> · {situationMeta.summaryGl}
        </p>
      </div>

      {/* Sub-mode switcher */}
      <div className="px-4 pt-3 pb-2 border-b border-[#efe8d8] flex items-center gap-1.5 bg-[#f7f4ec]">
        <button
          type="button"
          onClick={() => setSubMode('lexico')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            subMode === 'lexico'
              ? 'bg-[#ffffff] text-[#182433] shadow-sm'
              : 'text-[#4b5768] hover:text-[#182433]'
          }`}
        >
          Léxico ({itemsInSituation.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setSubMode('escoita');
            if (!listenTargetId) startListeningRound();
          }}
          className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            subMode === 'escoita'
              ? 'bg-[#ffffff] text-[#182433] shadow-sm'
              : 'text-[#4b5768] hover:text-[#182433]'
          }`}
        >
          <Headphones className="w-3.5 h-3.5" />
          Modo Escoita
        </button>
        <button
          type="button"
          onClick={() => setSubMode('dialogo')}
          className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            subMode === 'dialogo'
              ? 'bg-[#ffffff] text-[#182433] shadow-sm'
              : 'text-[#4b5768] hover:text-[#182433]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Mini-Reto
        </button>
      </div>

      {/* Body content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {subMode === 'lexico' && (
          <>
            {selectedItem && (
              <div className="p-4 rounded-xl bg-[#f7f4ec] border border-[#d6cab4] space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-[#4b5768]">
                      {selectedItem.level} · Pronuncia: {selectedItem.phoneticHint}
                    </div>
                    <h3 className="font-display text-2xl font-bold text-[#182433] mt-0.5">
                      {selectedItem.article !== '-' ? `${selectedItem.article} ` : ''}
                      {selectedItem.word}
                    </h3>
                    <p className="text-sm font-semibold text-[#1d4ed8]">
                      {selectedItem.gl}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => playWord(`${selectedItem.word}. ${selectedItem.exampleEn}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1d4ed8] hover:bg-[#1e40af] text-[#ffffff] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    aria-label={`Escoitar ${selectedItem.word}`}
                  >
                    <Volume2 className="w-4 h-4" />
                    Escoitar
                  </button>
                </div>

                {audioStatus && <p className="text-xs text-[#b45309]">{audioStatus}</p>}

                <p className="text-sm text-[#182433]">
                  <strong>Exemplo:</strong> {selectedItem.exampleEn}
                </p>
                <p className="text-xs text-[#4b5768]">{selectedItem.exampleGl}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[#4b5768]">
                <span>Toca un obxecto no 3D ou na lista</span>
                <button
                  type="button"
                  onClick={onGoToStudy}
                  className="text-[#1d4ed8] hover:underline cursor-pointer"
                >
                  Repasar con flashcards →
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {itemsInSituation.map((item) => {
                  const isSel = selectedItem?.id === item.id;
                  const thumb = thumbnails[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectObject(item.id)}
                      className={`flex items-center gap-3 p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        isSel
                          ? 'bg-[#eff6ff] border-[#1d4ed8]'
                          : 'bg-[#ffffff] border-[#efe8d8] hover:bg-[#f7f4ec]'
                      }`}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={item.word}
                          className="w-11 h-11 rounded-md object-contain bg-[#f7f4ec] shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-md bg-[#efe8d8] shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-[#182433] truncate">
                          {item.word}
                        </div>
                        <div className="text-xs text-[#4b5768] truncate">{item.gl}</div>
                      </div>
                      <span className="text-xs font-mono-num text-[#4b5768] shrink-0">
                        {item.level}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {subMode === 'escoita' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#f7f4ec] border border-[#d6cab4]">
              <h3 className="font-display text-base font-bold text-[#182433] mb-1">
                Escoita e escolle o obxecto en inglés
              </h3>
              <p className="text-xs text-[#4b5768] mb-3">
                Preme «Repetir audio» e selecciona a tarxeta correcta ou o obxecto no escenario 3D.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = itemsInSituation.find((i) => i.id === listenTargetId);
                    if (target) void playWord(target.word);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1d4ed8] text-[#ffffff] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  Repetir audio
                </button>
                <button
                  type="button"
                  onClick={startListeningRound}
                  className="px-3 py-2 rounded-lg bg-[#efe8d8] text-[#182433] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Seguinte palabra
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {listeningChoices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => {
                    onSelectObject(choice.id);
                    if (choice.id === listenTargetId) {
                      setListenFeedback({
                        ok: true,
                        text: `Moi ben! Era «${choice.word}» (${choice.gl}).`,
                      });
                    } else {
                      setListenFeedback({
                        ok: false,
                        text: `Iso é «${choice.word}» (${choice.gl}). Proba outra vez!`,
                      });
                    }
                  }}
                  className="p-3 rounded-xl border border-[#d6cab4] bg-[#ffffff] hover:bg-[#f7f4ec] text-left cursor-pointer"
                >
                  {thumbnails[choice.id] && (
                    <img
                      src={thumbnails[choice.id]}
                      alt={choice.word}
                      className="w-full h-20 object-contain mb-1.5"
                    />
                  )}
                  <div className="text-sm font-bold text-[#182433] text-center">
                    {choice.word}
                  </div>
                </button>
              ))}
            </div>

            {listenFeedback && (
              <p
                role="status"
                className={`p-3 rounded-lg text-xs font-semibold ${
                  listenFeedback.ok
                    ? 'bg-[#dcfce7] text-[#15803d]'
                    : 'bg-[#fef3c7] text-[#b45309]'
                }`}
              >
                {listenFeedback.text}
              </p>
            )}
          </div>
        )}

        {subMode === 'dialogo' && currentDialogueStep && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-[#4b5768]">
              <span>
                Quenda {stepIdx + 1} de {situationMeta.guidedDialogue.length}
              </span>
              {dialogueCompleted[activeSituation] && (
                <span className="inline-flex items-center gap-1 text-[#15803d]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Completado (+25 XP)
                </span>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#f7f4ec] border border-[#d6cab4] space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-[#182433]">
                  {currentDialogueStep.speakerPromptEn}
                </p>
                <button
                  type="button"
                  onClick={() => void playWord(currentDialogueStep.speakerPromptEn)}
                  className="p-1.5 rounded-lg bg-[#ffffff] border border-[#d6cab4] text-[#1d4ed8] shrink-0 cursor-pointer"
                  aria-label="Escoitar pregunta en inglés"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[#4b5768]">
                {currentDialogueStep.speakerPromptGl}
              </p>
            </div>

            <div className="space-y-2">
              {currentDialogueStep.options.map((opt, idx) => {
                const isPicked = pickedOption === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDialogueOption(idx)}
                    className={`w-full text-left p-3 rounded-xl border text-sm transition-colors cursor-pointer ${
                      isPicked
                        ? opt.isCorrect
                          ? 'bg-[#dcfce7] border-[#15803d] text-[#182433]'
                          : 'bg-[#fee2e2] border-[#b91c1c] text-[#182433]'
                        : 'bg-[#ffffff] border-[#d6cab4] hover:bg-[#f7f4ec] text-[#182433]'
                    }`}
                  >
                    <div className="font-semibold">{opt.textEn}</div>
                    {isPicked && (
                      <div className="text-xs mt-1 text-[#4b5768]">{opt.feedbackGl}</div>
                    )}
                  </button>
                );
              })}
            </div>

            {pickedOption !== null && currentDialogueStep.options[pickedOption]?.isCorrect && (
              <button
                type="button"
                onClick={handleNextDialogueStep}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-[#ffffff] text-sm font-semibold cursor-pointer"
              >
                {stepIdx + 1 < situationMeta.guidedDialogue.length
                  ? 'Seguinte quenda →'
                  : 'Completar mini-reto (+25 XP)'}
              </button>
            )}

            <div className="pt-3 border-t border-[#efe8d8]">
              <button
                type="button"
                onClick={onGoToConversation}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#efe8d8] hover:bg-[#e5dbc5] text-[#182433] text-xs font-semibold cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                Abrir conversa libre con IA nesta situación
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
