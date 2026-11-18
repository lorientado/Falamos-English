import React, { useState } from 'react';
import { Award, Copy, Download, Upload } from 'lucide-react';
import { ESCAPE_STAGES } from '../data/escapeRoom';
import { SITUATIONS, VOCAB_ITEMS } from '../data/situations';
import { StudentState } from '../types';
import {
  decodeProgressCode,
  encodeProgressCode,
  formatDurationMs,
  generateTextReport,
} from '../utils/escapeRoomLogic';
import { getCurriculumItemsForTrack, getLeitnerDistribution } from '../utils/leitner';

interface ReportViewProps {
  studentState: StudentState;
  onImportState: (next: StudentState) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  studentState,
  onImportState,
}) => {
  const [importCode, setImportCode] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const track = studentState.profile?.track ?? '10-14';
  const trackItems = getCurriculumItemsForTrack(VOCAB_ITEMS, track, 'all');
  const dist = getLeitnerDistribution(trackItems, studentState.leitner);
  const mastered = (dist[3] ?? 0) + (dist[4] ?? 0) + (dist[5] ?? 0);
  const dialoguesDone = Object.values(studentState.dialogueCompleted).filter(Boolean).length;

  const handleDownloadTxt = () => {
    const content = generateTextReport(studentState);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-falamos-english-${(studentState.profile?.name || 'alumno').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatusMsg('Informe .txt descargado.');
  };

  const handleCopyCode = async () => {
    const code = encodeProgressCode(studentState);
    try {
      await navigator.clipboard.writeText(code);
      setStatusMsg('Código de progreso copiado ao portapapeis.');
    } catch {
      setImportCode(code);
      setStatusMsg('Código xerado na caixa inferior para copialo manualmente.');
    }
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const decoded = decodeProgressCode(importCode);
    if (!decoded) {
      setStatusMsg('O código introducido non é válido.');
      return;
    }
    onImportState(decoded);
    setImportCode('');
    setStatusMsg('Progreso cargado correctamente!');
  };

  return (
    <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
      <div className="max-w-[1040px] mx-auto space-y-6">
        <section className="bg-[#ffffff] border border-[#d6cab4] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#182433]">
              Informe de progreso · {studentState.profile?.name ?? 'Alumnado'}
            </h1>
            <p className="text-sm text-[#4b5768]">
              {studentState.profile?.grade} ·{' '}
              {track === '7-9' ? '7–9 anos (A1 Inicial)' : '10–14 anos (5º EP–2º ESO A1–A2)'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1d4ed8] text-[#ffffff] text-xs font-semibold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Descargar informe .txt
            </button>
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#efe8d8] text-[#182433] text-xs font-semibold cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              Exportar código
            </button>
          </div>
        </section>

        {/* KPI strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#d6cab4]">
            <div className="text-xs text-[#4b5768]">Experiencia total</div>
            <div className="font-mono-num text-2xl font-bold text-[#1d4ed8] mt-1">
              {studentState.xp} XP
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#d6cab4]">
            <div className="text-xs text-[#4b5768]">Léxico dominado (Caixa 3+)</div>
            <div className="font-mono-num text-2xl font-bold text-[#182433] mt-1">
              {mastered} / {trackItems.length}
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#d6cab4]">
            <div className="text-xs text-[#4b5768]">Mini-retos superados</div>
            <div className="font-mono-num text-2xl font-bold text-[#182433] mt-1">
              {dialoguesDone} / {SITUATIONS.length}
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#d6cab4]">
            <div className="text-xs text-[#4b5768]">Escape Room da casa</div>
            <div className="font-mono-num text-lg font-bold text-[#15803d] mt-1">
              {studentState.escapeRoom.finished
                ? formatDurationMs(
                    studentState.escapeRoom.activeMs + studentState.escapeRoom.penaltyMs
                  )
                : `Proba ${studentState.escapeRoom.stageIndex + 1}/${ESCAPE_STAGES.length}`}
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="bg-[#ffffff] border border-[#d6cab4] rounded-2xl p-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-[#182433]">
            Insignias conseguidas ({studentState.badges.length})
          </h2>
          {studentState.badges.length === 0 ? (
            <p className="text-sm text-[#4b5768]">
              Completa a proba inicial, repasa tarxetas ou supera o escape room para gañar insignias.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {studentState.badges.map((b) => (
                <div
                  key={b}
                  className="p-3 rounded-xl bg-[#f7f4ec] border border-[#d6cab4] flex items-center gap-2.5 text-sm font-semibold text-[#182433]"
                >
                  <Award className="w-5 h-5 text-[#b45309] shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Import / Restore Progress Code */}
        <section className="bg-[#ffffff] border border-[#d6cab4] rounded-2xl p-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-[#182433]">
            Cargar ou transferir progreso (código Base64)
          </h2>
          <form onSubmit={handleImportSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              placeholder="Pega aquí un código de progreso exportado..."
              className="flex-1 px-3.5 py-2 rounded-lg border border-[#d6cab4] bg-[#f7f4ec] text-xs font-mono-num"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#182433] text-[#ffffff] text-xs font-semibold cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Cargar código
            </button>
          </form>
          {statusMsg && (
            <p role="status" className="text-xs font-semibold text-[#1d4ed8]">
              {statusMsg}
            </p>
          )}
        </section>
      </div>
    </main>
  );
};
