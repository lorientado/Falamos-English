import React, { useState } from 'react';
import { ArrowRight, BookOpen, Compass, KeyRound, MessageCircle } from 'lucide-react';
import { AgeTrack, StudentProfile, StudentState } from '../types';

interface WelcomeViewProps {
  studentState: StudentState;
  onStartProfile: (profile: StudentProfile) => void;
  onContinue: () => void;
}

const GRADE_OPTIONS_BY_TRACK: Record<AgeTrack, string[]> = {
  '7-9': ['2º Primaria', '3º Primaria', '4º Primaria'],
  '10-14': ['5º Primaria', '6º Primaria', '1º ESO', '2º ESO'],
};

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  studentState,
  onStartProfile,
  onContinue,
}) => {
  const existing = studentState.profile;
  const [name, setName] = useState(existing?.name ?? '');
  const [track, setTrack] = useState<AgeTrack>(existing?.track ?? '10-14');
  const [grade, setGrade] = useState(existing?.grade ?? '5º Primaria');
  const [errorMsg, setErrorMsg] = useState('');

  const handleTrackChange = (nextTrack: AgeTrack) => {
    setTrack(nextTrack);
    const validGrades = GRADE_OPTIONS_BY_TRACK[nextTrack];
    if (!validGrades.includes(grade)) {
      setGrade(validGrades[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setErrorMsg('Escribe o teu nome (polo menos 2 letras) para gardar o teu progreso.');
      return;
    }
    setErrorMsg('');
    onStartProfile({ name: cleanName, grade, track });
  };

  return (
    <main className="flex-1 overflow-y-auto px-4 md:px-8 py-8 md:py-12">
      <div className="max-w-[1160px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left column: Editorial intro & value */}
        <section className="lg:col-span-7 flex flex-col justify-between bg-[#ffffff] border border-[#d6cab4] rounded-2xl p-6 md:p-10">
          <div>
            <p className="text-sm font-semibold text-[#1d4ed8] mb-3">
              Inglés comunicativo para Galicia · Niveis A1 e A2
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-[#182433] leading-[1.12] mb-5">
              Explora escenarios en 3D, conversa e supera o escape room da casa
            </h1>
            <p className="text-base md:text-lg text-[#4b5768] max-w-[60ch] mb-8">
              Un espazo lúdico pensado para rapazas e rapaces de 7 a 14 anos. Practica vocabulario real en 7 situacións cotiás, consolida palabras con tarxetas espaciadas e resolve o misterio da casa de Uxía.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-6 border-t border-[#efe8d8]">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-[#efe8d8] text-[#182433] shrink-0">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-[#182433]">
                    7 situacións en 3D
                  </h2>
                  <p className="text-sm text-[#4b5768]">
                    Casa, escola, cafetería, rutina, vila, médico e estación de tren interactivas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-[#efe8d8] text-[#182433] shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-[#182433]">
                    Flashcards espaciadas
                  </h2>
                  <p className="text-sm text-[#4b5768]">
                    Repaso intelixente en 5 caixas Leitner con imaxes 3D, audio e escritura.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-[#efe8d8] text-[#182433] shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-[#182433]">
                    Conversa en inglés
                  </h2>
                  <p className="text-sm text-[#4b5768]">
                    Diálogos guiados, chat de titoría e voz en tempo real coa IA.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-[#efe8d8] text-[#182433] shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-[#182433]">
                    Escape Room da casa
                  </h2>
                  <p className="text-sm text-[#4b5768]">
                    8 retos con pistas e cronómetro para atopar o caderno secreto de Uxía.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {existing && (
            <div className="mt-8 pt-5 border-t border-[#efe8d8] flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-[#4b5768] tabular-nums">
                Progreso gardado: <strong className="text-[#182433]">{existing.name}</strong> ·{' '}
                {studentState.xp} XP · {studentState.badges.length} insignias
              </div>
              <button
                type="button"
                onClick={onContinue}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#1d4ed8] bg-[#eff6ff] hover:bg-[#dbeafe] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Continuar sen cambiar
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>

        {/* Right column: Student Profile & Age/Level Track Selector */}
        <section className="lg:col-span-5 bg-[#ffffff] border border-[#d6cab4] rounded-2xl p-6 md:p-8 flex flex-col justify-center">
          <h2 className="font-display text-2xl font-bold text-[#182433] mb-2">
            Configura o teu perfil
          </h2>
          <p className="text-sm text-[#4b5768] mb-6">
            Escolle a túa idade e nivel para adaptar o vocabulario e as conversas en inglés.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="student-name" className="block text-sm font-semibold text-[#182433] mb-1.5">
                O teu nome
              </label>
              <input
                id="student-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Antía, Brais..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6cab4] bg-[#f7f4ec] text-[#182433] text-base focus:bg-[#ffffff]"
                required
              />
            </div>

            <div>
              <span className="block text-sm font-semibold text-[#182433] mb-2">
                Itinerario por idade e nivel
              </span>
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleTrackChange('7-9')}
                  className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                    track === '7-9'
                      ? 'border-[#1d4ed8] bg-[#eff6ff]'
                      : 'border-[#d6cab4] bg-[#f7f4ec] hover:bg-[#efe8d8]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-[#182433]">
                      7–9 anos · A1 Inicial
                    </span>
                    <span className="text-xs font-semibold text-[#1d4ed8]">
                      {track === '7-9' ? 'Seleccionado' : 'Escoller'}
                    </span>
                  </div>
                  <p className="text-xs text-[#4b5768] mt-1">
                    Vocabulario esencial das situacións A1, frases curtas e ritmo pausado.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleTrackChange('10-14')}
                  className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                    track === '10-14'
                      ? 'border-[#1d4ed8] bg-[#eff6ff]'
                      : 'border-[#d6cab4] bg-[#f7f4ec] hover:bg-[#efe8d8]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-[#182433]">
                      10–14 anos · 5º EP–2º ESO (A1–A2)
                    </span>
                    <span className="text-xs font-semibold text-[#1d4ed8]">
                      {track === '10-14' ? 'Seleccionado' : 'Escoller'}
                    </span>
                  </div>
                  <p className="text-xs text-[#4b5768] mt-1">
                    Todo o léxico A1 + ampliación A2 (vila, saúde, estación de tren e diálogos completos).
                  </p>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="student-grade" className="block text-sm font-semibold text-[#182433] mb-1.5">
                Curso escolar
              </label>
              <select
                id="student-grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6cab4] bg-[#f7f4ec] text-[#182433] text-base"
              >
                {GRADE_OPTIONS_BY_TRACK[track].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {errorMsg && (
              <p role="alert" className="text-sm font-medium text-[#b91c1c] bg-[#fee2e2] px-3.5 py-2 rounded-lg">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              data-start="true"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-[#ffffff] font-semibold text-base transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Comezar a aprender
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </section>
      </div>
    </main>
  );
};
