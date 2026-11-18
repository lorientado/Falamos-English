import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  KeyRound,
  RotateCcw,
  Trophy,
  Volume2,
} from 'lucide-react';
import { ESCAPE_STAGES } from '../data/escapeRoom';
import { HOUSE_ROOMS, ROOM_NAME_MAP, VOCAB_ITEMS, VOCAB_MAP } from '../data/situations';
import { EscapeRoomState, EscapeStep } from '../types';
import { speakEnglishWithFallback } from '../utils/audio';
import { checkEnglishWordAnswer, checkRoomAnswer } from '../utils/evaluation';
import { formatDurationMs } from '../utils/escapeRoomLogic';

interface EscapeRoomViewProps {
  escapeRoom: EscapeRoomState;
  lastPicked3dId: string | null;
  onStartEscape: () => void;
  onTickMs: (deltaMs: number) => void;
  onUseHint: (newHintLevel: number) => void;
  onSolveStep: (solvedWordIds: string[], hintLevelUsed: number) => void;
  onRecordError: () => void;
  onResetEscape: () => void;
  onFocusRoom: (roomId: string | null) => void;
  onClearPicked3d: () => void;
}

export const EscapeRoomView: React.FC<EscapeRoomViewProps> = ({
  escapeRoom,
  lastPicked3dId,
  onStartEscape,
  onTickMs,
  onUseHint,
  onSolveStep,
  onRecordError,
  onResetEscape,
  onFocusRoom,
  onClearPicked3d,
}) => {
  const [hintLevel, setHintLevel] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [speakingPrompt, setSpeakingPrompt] = useState(false);
  const [promptAudioNote, setPromptAudioNote] = useState<string | null>(null);

  // Inputs per step type
  const [writeInputs, setWriteInputs] = useState<Record<number, string>>({});
  const [defInputs, setDefInputs] = useState<Record<number, string>>({});
  const [classifyInputs, setClassifyInputs] = useState<Record<number, string>>({});
  const [roomInput, setRoomInput] = useState('');
  const [finalItemId, setFinalItemId] = useState('');
  const [finalRoomId, setFinalRoomId] = useState('');

  const stage = ESCAPE_STAGES[escapeRoom.stageIndex];
  const step: EscapeStep | undefined = stage?.steps[escapeRoom.stepIndex];

  // Focus camera on current stage's room
  useEffect(() => {
    if (escapeRoom.startedAt && !escapeRoom.finished && stage) {
      onFocusRoom(stage.roomId);
    }
  }, [escapeRoom.startedAt, escapeRoom.finished, stage, onFocusRoom]);

  // Reset local step inputs whenever stage/step advances
  useEffect(() => {
    setHintLevel(0);
    setFeedback(null);
    setPromptAudioNote(null);
    setWriteInputs({});
    setDefInputs({});
    setClassifyInputs({});
    setRoomInput('');
    setFinalItemId('');
    setFinalRoomId('');
    onClearPicked3d();
  }, [escapeRoom.stageIndex, escapeRoom.stepIndex, onClearPicked3d]);

  // Active timer
  useEffect(() => {
    if (!escapeRoom.startedAt || escapeRoom.finished) return;
    const id = window.setInterval(() => {
      onTickMs(1000);
    }, 1000);
    return () => window.clearInterval(id);
  }, [escapeRoom.startedAt, escapeRoom.finished, onTickMs]);

  // Handle 3D click when step is 'pick3d'
  useEffect(() => {
    if (!lastPicked3dId || !step || step.type !== 'pick3d' || escapeRoom.finished) return;
    if (lastPicked3dId === step.targetId) {
      const target = VOCAB_MAP[step.targetId];
      setFeedback({
        ok: true,
        text: `Exacto! Atopaches «${target?.word ?? step.targetId}» (${target?.gl ?? ''}).`,
      });
      if (target) void speakEnglishWithFallback(target.word, false);
      onSolveStep([step.targetId], hintLevel);
    } else {
      const picked = VOCAB_MAP[lastPicked3dId];
      onRecordError();
      setFeedback({
        ok: false,
        text: `Ese obxecto é «${picked?.word ?? lastPicked3dId}» (${picked?.gl ?? ''}). Proba outro!`,
      });
    }
    onClearPicked3d();
  }, [lastPicked3dId, step, escapeRoom.finished, hintLevel, onSolveStep, onRecordError, onClearPicked3d]);

  const homeWords = VOCAB_ITEMS.filter((v) => v.situation === 'home').map((v) => v.word);

  const handleRequestHint = () => {
    if (hintLevel >= 3) return;
    const next = hintLevel + 1;
    setHintLevel(next);
    onUseHint(next);
  };

  const handleWriteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!step || step.type !== 'writeEn') return;
    for (let idx = 0; idx < step.targetIds.length; idx++) {
      const item = VOCAB_MAP[step.targetIds[idx]];
      if (!item) continue;
      const check = checkEnglishWordAnswer(writeInputs[idx] ?? '', item, homeWords);
      if (!check.accepted) {
        onRecordError();
        setFeedback({
          ok: false,
          text: `Revisa o oco ${idx + 1}: esa palabra non coincide co obxecto marcado en 3D.`,
        });
        return;
      }
    }
    setFeedback({ ok: true, text: 'Excelente! Todas as palabras en inglés son correctas.' });
    onSolveStep(step.targetIds, hintLevel);
  };

  const handleDefinitionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!step || step.type !== 'definition') return;
    for (let idx = 0; idx < step.items.length; idx++) {
      const item = VOCAB_MAP[step.items[idx].targetId];
      if (!item) continue;
      const check = checkEnglishWordAnswer(defInputs[idx] ?? '', item, homeWords);
      if (!check.accepted) {
        onRecordError();
        setFeedback({
          ok: false,
          text: `A definición ${idx + 1} aínda non está ben. Le a pista en inglés e galego.`,
        });
        return;
      }
    }
    setFeedback({ ok: true, text: 'Moi ben! Todas as definicións resoltas.' });
    onSolveStep(
      step.items.map((i) => i.targetId),
      hintLevel
    );
  };

  const handleClassifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!step || step.type !== 'classify') return;
    for (let idx = 0; idx < step.items.length; idx++) {
      const entry = step.items[idx];
      const vocab = VOCAB_MAP[entry.itemId];
      const chosenRoom = classifyInputs[idx];
      const validRooms = vocab?.plausibleRooms ?? [entry.targetRoomId];
      if (!chosenRoom || (chosenRoom !== entry.targetRoomId && !validRooms.includes(chosenRoom))) {
        onRecordError();
        setFeedback({
          ok: false,
          text: `Revisa onde vai «${vocab?.word ?? entry.itemId}» (${vocab?.gl ?? ''}).`,
        });
        return;
      }
    }
    setFeedback({ ok: true, text: 'Casa ordenada perfectamente!' });
    onSolveStep(
      step.items.map((i) => i.itemId),
      hintLevel
    );
  };

  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!step || step.type !== 'roomName') return;
    const room = ROOM_NAME_MAP[step.targetRoomId];
    if (!room) return;
    if (!checkRoomAnswer(roomInput, room.nameEn)) {
      onRecordError();
      setFeedback({
        ok: false,
        text: `Non é exacto. Pensa como se escribe «${room.nameGl}» en inglés.`,
      });
      return;
    }
    setFeedback({ ok: true, text: `Correcto! «${room.nameEn}».` });
    onSolveStep([`room_${room.id}`], hintLevel);
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!step || step.type !== 'final') return;
    if (finalItemId !== step.targetItemId || finalRoomId !== step.targetRoomId) {
      onRecordError();
      setFeedback({
        ok: false,
        text: 'Esa combinación non abre o peche! Repasa as pistas recollidas.',
      });
      return;
    }
    setFeedback({ ok: true, text: 'Atopaches o caderno secreto de Uxía!' });
    onSolveStep([step.targetItemId], hintLevel);
  };

  // Intro state before starting
  if (!escapeRoom.startedAt) {
    return (
      <aside className="w-full lg:w-[460px] shrink-0 bg-[#ffffff] border border-[#d6cab4] rounded-xl p-6 flex flex-col justify-between gap-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#b45309]">
            <KeyRound className="w-4 h-4" />
            Xogo tipo Escape Room · Léxico da casa en inglés
          </div>
          <h2 className="font-display text-2xl font-bold text-[#182433]">
            O segredo da casa de Uxía
          </h2>
          <p className="text-sm text-[#4b5768]">
            Uxía escondeu o seu caderno de inglés nun dos mobles desta casa 3D. Supera 8 probas encadeadas clicando obxectos no visor 3D, escribindo palabras en inglés e clasificándoas nas súas habitacións.
          </p>
          <div className="p-4 rounded-xl bg-[#f7f4ec] border border-[#d6cab4] text-xs text-[#4b5768] space-y-1.5">
            <div>1. Preme directamente nos mobles dentro do modelo 3D ou usa os controis.</div>
            <div>2. Se atascas, podes pedir pistas (+30 s de penalización) ou ver a solución (+90 s).</div>
            <div>3. Cada proba superada desbloquea un fragmento de pista para o segredo final.</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartEscape}
          className="w-full py-3 px-5 rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-[#ffffff] font-semibold text-base cursor-pointer"
        >
          Comezar Escape Room
        </button>
      </aside>
    );
  }

  // Victory state
  if (escapeRoom.finished) {
    const totalMs = escapeRoom.activeMs + escapeRoom.penaltyMs;
    return (
      <aside className="w-full lg:w-[460px] shrink-0 bg-[#ffffff] border border-[#d6cab4] rounded-xl p-6 flex flex-col justify-between gap-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-[#15803d]">
            <Trophy className="w-5 h-5" />
            Escape Room completado!
          </div>
          <h2 className="font-display text-2xl font-bold text-[#182433]">
            Atopaches o caderno na «bookcase» do «study»!
          </h2>
          <p className="text-sm text-[#4b5768]">
            Parabéns! Dominaches o vocabulario da casa en inglés e superaches todas as probas da casa de Uxía.
          </p>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-[#f7f4ec] border border-[#d6cab4]">
              <div className="text-xs text-[#4b5768]">Tempo activo</div>
              <div className="font-mono-num text-sm font-bold text-[#182433] mt-0.5">
                {formatDurationMs(escapeRoom.activeMs)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#f7f4ec] border border-[#d6cab4]">
              <div className="text-xs text-[#4b5768]">Penalización</div>
              <div className="font-mono-num text-sm font-bold text-[#b45309] mt-0.5">
                +{formatDurationMs(escapeRoom.penaltyMs)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#eff6ff] border border-[#1d4ed8]">
              <div className="text-xs text-[#1d4ed8]">Total final</div>
              <div className="font-mono-num text-sm font-bold text-[#182433] mt-0.5">
                {formatDurationMs(totalMs)}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onResetEscape}
          className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#efe8d8] hover:bg-[#e5dbc5] text-[#182433] text-sm font-semibold cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Volver xogar ao Escape Room
        </button>
      </aside>
    );
  }

  const totalTimerMs = escapeRoom.activeMs + escapeRoom.penaltyMs;
  const roomItemsForFallback = VOCAB_ITEMS.filter(
    (v) => v.situation === 'home' && v.roomId === stage?.roomId
  );

  return (
    <aside className="w-full lg:w-[460px] shrink-0 bg-[#ffffff] border border-[#d6cab4] rounded-xl flex flex-col overflow-hidden">
      {/* Top HUD bar */}
      <div className="p-4 border-b border-[#efe8d8] bg-[#f7f4ec] flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[#4b5768] tabular-nums">
            Proba {escapeRoom.stageIndex + 1} de {ESCAPE_STAGES.length} · Paso{' '}
            {escapeRoom.stepIndex + 1}/{stage?.steps.length ?? 1}
          </div>
          <h2 className="font-display text-lg font-bold text-[#182433]">{stage?.titleGl}</h2>
        </div>

        <div className="text-right tabular-nums">
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-[#182433]">
            <Clock className="w-3.5 h-3.5 text-[#1d4ed8]" />
            <span className="font-mono-num">{formatDurationMs(totalTimerMs)}</span>
          </div>
          {escapeRoom.penaltyMs > 0 && (
            <div className="text-[11px] font-mono-num text-[#b45309]">
              (+{Math.round(escapeRoom.penaltyMs / 1000)} s axudas)
            </div>
          )}
        </div>
      </div>

      {/* Stage narrative & interactive puzzle */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <p className="text-xs text-[#4b5768]">{stage?.storyGl}</p>

        {step && (
          <div className="p-4 rounded-xl bg-[#f7f4ec] border border-[#d6cab4] space-y-3">
            <p className="text-sm font-bold text-[#182433]">{step.promptGl}</p>

            {/* Step 1: pick3d */}
            {step.type === 'pick3d' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#ffffff] border border-[#d6cab4]">
                  <span className="text-sm font-semibold text-[#1d4ed8]">{step.promptEn}</span>
                  <button
                    type="button"
                    disabled={speakingPrompt}
                    onClick={async () => {
                      setSpeakingPrompt(true);
                      setPromptAudioNote(null);
                      try {
                        const res = await speakEnglishWithFallback(step.promptEn, true);
                        if (res.mode === 'none') {
                          setPromptAudioNote(
                            'O audio en inglés nativo non puido reproducirse agora mesmo; téntao de novo nun segundo.'
                          );
                        }
                      } finally {
                        setSpeakingPrompt(false);
                      }
                    }}
                    className="p-1.5 rounded-md bg-[#efe8d8] hover:bg-[#e5dbc5] text-[#182433] disabled:opacity-55 cursor-pointer"
                    aria-label="Escoitar instrución en inglés nativo"
                    title="Escoitar en inglés nativo"
                  >
                    <Volume2 className={`w-4 h-4 ${speakingPrompt ? 'animate-pulse text-[#1d4ed8]' : ''}`} />
                  </button>
                </div>
                {promptAudioNote && (
                  <p className="text-[11px] text-[#b45309] font-medium">{promptAudioNote}</p>
                )}
                <p className="text-xs text-[#4b5768]">
                  Preme directamente no obxecto na casa 3D (ou escólleo aquí se usas teclado):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {roomItemsForFallback.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.id === step.targetId) {
                          void speakEnglishWithFallback(item.word, false);
                          onSolveStep([step.targetId], hintLevel);
                        } else {
                          onRecordError();
                          setFeedback({
                            ok: false,
                            text: `«${item.word}» é ${item.gl}. Busca outro obxecto!`,
                          });
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#ffffff] border border-[#d6cab4] hover:bg-[#efe8d8] text-xs font-semibold text-[#182433] cursor-pointer"
                    >
                      {item.word}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: writeEn */}
            {step.type === 'writeEn' && (
              <form onSubmit={handleWriteSubmit} className="space-y-3">
                {step.targetIds.map((tid, idx) => {
                  const vocab = VOCAB_MAP[tid];
                  return (
                    <div key={tid} className="space-y-1">
                      <label
                        htmlFor={`esc-write-${idx}`}
                        className="block text-xs font-semibold text-[#182433]"
                      >
                        Obxecto {idx + 1} destacado no 3D ({vocab?.gl}):
                      </label>
                      <input
                        id={`esc-write-${idx}`}
                        type="text"
                        value={writeInputs[idx] ?? ''}
                        onChange={(e) =>
                          setWriteInputs((prev) => ({ ...prev, [idx]: e.target.value }))
                        }
                        placeholder="Escribe en inglés..."
                        className="w-full px-3 py-2 rounded-lg border border-[#d6cab4] bg-[#ffffff] text-sm"
                      />
                    </div>
                  );
                })}
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-[#1d4ed8] text-[#ffffff] text-sm font-semibold cursor-pointer"
                >
                  Comprobar palabras
                </button>
              </form>
            )}

            {/* Step 3: definition */}
            {step.type === 'definition' && (
              <form onSubmit={handleDefinitionSubmit} className="space-y-3">
                {step.items.map((entry, idx) => (
                  <div key={entry.targetId} className="p-3 rounded-lg bg-[#ffffff] border border-[#d6cab4] space-y-1.5">
                    <div className="text-xs font-semibold text-[#182433]">{entry.clueEn}</div>
                    <div className="text-xs text-[#4b5768]">{entry.clueGl}</div>
                    <input
                      type="text"
                      value={defInputs[idx] ?? ''}
                      onChange={(e) =>
                        setDefInputs((prev) => ({ ...prev, [idx]: e.target.value }))
                      }
                      placeholder="Palabra en inglés..."
                      className="w-full px-3 py-1.5 rounded-lg border border-[#d6cab4] text-sm"
                    />
                  </div>
                ))}
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-[#1d4ed8] text-[#ffffff] text-sm font-semibold cursor-pointer"
                >
                  Comprobar definicións
                </button>
              </form>
            )}

            {/* Step 4: classify */}
            {step.type === 'classify' && (
              <form onSubmit={handleClassifySubmit} className="space-y-2.5">
                {step.items.map((entry, idx) => {
                  const vocab = VOCAB_MAP[entry.itemId];
                  return (
                    <div
                      key={entry.itemId}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#ffffff] border border-[#d6cab4]"
                    >
                      <div className="text-sm font-bold text-[#182433]">
                        {vocab?.word}{' '}
                        <span className="text-xs font-normal text-[#4b5768]">({vocab?.gl})</span>
                      </div>
                      <select
                        value={classifyInputs[idx] ?? ''}
                        onChange={(e) =>
                          setClassifyInputs((prev) => ({ ...prev, [idx]: e.target.value }))
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-[#d6cab4] text-xs font-semibold bg-[#f7f4ec]"
                      >
                        <option value="">Escolle cuarto...</option>
                        {HOUSE_ROOMS.filter((r) => r.id !== 'hallway').map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-[#1d4ed8] text-[#ffffff] text-sm font-semibold cursor-pointer"
                >
                  Validar clasificación
                </button>
              </form>
            )}

            {/* Step 5: roomName */}
            {step.type === 'roomName' && (
              <form onSubmit={handleRoomSubmit} className="space-y-2.5">
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder="Nome da habitación en inglés..."
                  className="w-full px-3 py-2 rounded-lg border border-[#d6cab4] bg-[#ffffff] text-sm"
                />
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-[#1d4ed8] text-[#ffffff] text-sm font-semibold cursor-pointer"
                >
                  Comprobar habitación
                </button>
              </form>
            )}

            {/* Step 6: final */}
            {step.type === 'final' && (
              <form onSubmit={handleFinalSubmit} className="space-y-3">
                <div>
                  <label htmlFor="final-item" className="block text-xs font-semibold text-[#182433] mb-1">
                    Moble secreto (en inglés):
                  </label>
                  <select
                    id="final-item"
                    value={finalItemId}
                    onChange={(e) => setFinalItemId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#d6cab4] bg-[#ffffff] text-sm"
                  >
                    <option value="">Escolle o moble...</option>
                    {VOCAB_ITEMS.filter((v) => v.situation === 'home').map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.word} ({v.gl})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="final-room" className="block text-xs font-semibold text-[#182433] mb-1">
                    Habitación secreta (en inglés):
                  </label>
                  <select
                    id="final-room"
                    value={finalRoomId}
                    onChange={(e) => setFinalRoomId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#d6cab4] bg-[#ffffff] text-sm"
                  >
                    <option value="">Escolle a habitación...</option>
                    {HOUSE_ROOMS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nameEn} ({r.nameGl})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-[#15803d] text-[#ffffff] text-sm font-bold cursor-pointer"
                >
                  Abrir o peche secreto!
                </button>
              </form>
            )}

            {feedback && (
              <div
                role="status"
                className={`p-2.5 rounded-lg text-xs font-semibold ${
                  feedback.ok ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {/* Hints box */}
            <div className="pt-2 border-t border-[#d6cab4] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={hintLevel >= 3}
                  onClick={handleRequestHint}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b45309] hover:underline disabled:opacity-45 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  {hintLevel === 0
                    ? 'Pedir pista (+30 s)'
                    : hintLevel === 1
                      ? 'Pedir 2ª pista (+30 s)'
                      : hintLevel === 2
                        ? 'Ver solución (+90 s)'
                        : 'Solución amosada'}
                </button>
              </div>
              {hintLevel >= 1 && (
                <p className="text-xs text-[#182433] bg-[#fef3c7] px-3 py-1.5 rounded-lg">
                  <strong>Pista 1:</strong> {step.hintsGl[0]}
                </p>
              )}
              {hintLevel >= 2 && (
                <p className="text-xs text-[#182433] bg-[#fef3c7] px-3 py-1.5 rounded-lg">
                  <strong>Axuda extra:</strong> {step.hintsGl[1]}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Collected clues */}
        {escapeRoom.collectedClues.length > 0 && (
          <div className="p-3.5 rounded-xl bg-[#ffffff] border border-[#d6cab4] space-y-1.5">
            <div className="text-xs font-bold text-[#182433] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#15803d]" />
              Pistas do segredo recollidas ({escapeRoom.collectedClues.length})
            </div>
            <ul className="space-y-1 text-xs text-[#4b5768]">
              {escapeRoom.collectedClues.map((clue, i) => (
                <li key={i}>{clue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
};
