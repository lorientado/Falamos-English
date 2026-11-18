import React, { useEffect, useState } from 'react';
import { Lock, Unlock, Volume2, X } from 'lucide-react';
import { VOCAB_ITEMS } from '../data/situations';
import { StudentState } from '../types';
import { loadEnglishVoices, speakBrowserEnglish } from '../utils/audio';

interface TeacherModalProps {
  open: boolean;
  studentState: StudentState;
  onClose: () => void;
  onUnlockFinalTest: () => void;
  onUnlockAllSituations: () => void;
  onResetEscapeRoom: () => void;
  onResetAll: () => void;
}

const TEACHER_PIN = '4729';

export const TeacherModal: React.FC<TeacherModalProps> = ({
  open,
  studentState,
  onClose,
  onUnlockFinalTest,
  onUnlockAllSituations,
  onResetEscapeRoom,
  onResetAll,
}) => {
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!open) return;
    void loadEnglishVoices().then(setVoices);
  }, [open]);

  if (!open) return null;

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim() === TEACHER_PIN) {
      setUnlocked(true);
      setPinError('');
    } else {
      setPinError('PIN incorrecto. O código de proba docente é 4729.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-modal-title"
      className="fixed inset-0 z-50 bg-[#182433]/65 flex items-center justify-center p-4"
    >
      <div className="bg-[#ffffff] border border-[#d6cab4] rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-[#efe8d8] flex items-center justify-between">
          <h2 id="teacher-modal-title" className="font-display text-xl font-bold text-[#182433]">
            Panel Docente
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#4b5768] hover:bg-[#f7f4ec] cursor-pointer"
            aria-label="Pechar panel docente"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!unlocked ? (
            <form onSubmit={handlePinSubmit} className="space-y-4 max-w-sm mx-auto py-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#182433]">
                <Lock className="w-4 h-4 text-[#1d4ed8]" />
                Introduce o PIN do profesorado (4729)
              </div>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN docente"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6cab4] bg-[#f7f4ec]"
              />
              {pinError && <p className="text-xs font-semibold text-[#b91c1c]">{pinError}</p>}
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-[#1d4ed8] text-[#ffffff] text-sm font-semibold cursor-pointer"
              >
                Acceder
              </button>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onUnlockFinalTest}
                  className="inline-flex items-center justify-center gap-2 p-3 rounded-xl bg-[#eff6ff] border border-[#1d4ed8] text-[#1d4ed8] text-xs font-bold cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  Desbloquear proba final
                </button>
                <button
                  type="button"
                  onClick={onUnlockAllSituations}
                  className="inline-flex items-center justify-center gap-2 p-3 rounded-xl bg-[#efe8d8] text-[#182433] text-xs font-bold cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  Activar todas as situacións (A1+A2)
                </button>
                <button
                  type="button"
                  onClick={onResetEscapeRoom}
                  className="p-3 rounded-xl bg-[#f7f4ec] border border-[#d6cab4] text-[#182433] text-xs font-bold cursor-pointer"
                >
                  Reiniciar só o Escape Room
                </button>
                <button
                  type="button"
                  onClick={onResetAll}
                  className="p-3 rounded-xl bg-[#fee2e2] text-[#b91c1c] text-xs font-bold cursor-pointer"
                >
                  Borrar todo o progreso do alumno
                </button>
              </div>

              {/* English TTS Voice Diagnostics */}
              <div className="p-4 rounded-xl bg-[#f7f4ec] border border-[#d6cab4] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#182433]">
                    Diagnóstico de voces en inglés do navegador ({voices.length})
                  </div>
                  <button
                    type="button"
                    onClick={() => speakBrowserEnglish('Hello! Welcome to Falamos English.')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#ffffff] border border-[#d6cab4] text-xs font-semibold cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Probar voz
                  </button>
                </div>
                <p className="text-xs text-[#4b5768]">
                  {voices.length > 0
                    ? voices
                        .slice(0, 4)
                        .map((v) => `${v.name} (${v.lang})`)
                        .join(' · ')
                    : 'Non se detectaron voces locais en inglés; usarase /api/tts cando haxa clave Gemini.'}
                </p>
              </div>

              {/* Curriculum accuracy table */}
              <div>
                <h3 className="font-display text-sm font-bold text-[#182433] mb-2">
                  Estado por palabra (Leitner)
                </h3>
                <div className="max-h-56 overflow-y-auto border border-[#d6cab4] rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f7f4ec] border-b border-[#d6cab4]">
                      <tr>
                        <th className="py-2 px-3">Inglés</th>
                        <th className="py-2 px-3">Galego</th>
                        <th className="py-2 px-3">Nivel</th>
                        <th className="py-2 px-3 text-right">Caixa</th>
                        <th className="py-2 px-3 text-right">Acertos/Erros</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#efe8d8] tabular-nums">
                      {VOCAB_ITEMS.slice(0, 30).map((item) => {
                        const c = studentState.leitner[item.id];
                        return (
                          <tr key={item.id}>
                            <td className="py-1.5 px-3 font-semibold">{item.word}</td>
                            <td className="py-1.5 px-3 text-[#4b5768]">{item.gl}</td>
                            <td className="py-1.5 px-3">{item.level}</td>
                            <td className="py-1.5 px-3 text-right">{c?.box ?? 1}</td>
                            <td className="py-1.5 px-3 text-right">
                              {c?.correctCount ?? 0} / {c?.wrongCount ?? 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
