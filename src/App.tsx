import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CelebrationConfetti } from './components/CelebrationConfetti';
import { ConversationView } from './components/ConversationView';
import { EscapeRoomView } from './components/EscapeRoomView';
import { ExplorerView } from './components/ExplorerView';
import { Header } from './components/Header';
import { ReportView } from './components/ReportView';
import { StudyView } from './components/StudyView';
import { TeacherModal } from './components/TeacherModal';
import { ThreeSimulatorCanvas } from './components/ThreeSimulatorCanvas';
import { WelcomeView } from './components/WelcomeView';
import { ESCAPE_STAGES } from './data/escapeRoom';
import { SITUATION_MAP, VOCAB_MAP } from './data/situations';
import { renderVocabThumbnails } from './three/thumbnails';
import { MainTab, SavedFlashcard, SituationId, StudentProfile, StudentState } from './types';
import { loadEnglishVoices, speakEnglishWithFallback } from './utils/audio';
import {
  CelebrationEvent,
  CelebrationKind,
  detectEscapeCelebration,
  shouldCelebrateFlashcard,
} from './utils/celebration';
import {
  advanceEscapeStep,
  applyHintPenalty,
  createInitialEscapeRoomState,
  createInitialStudentState,
} from './utils/escapeRoomLogic';
import { advanceLeitnerCard, computeEarnedBadges } from './utils/leitner';

const STORAGE_KEY = 'falamos_english_3d_state_v2';

function loadInitialState(): { state: StudentState; initialTab: MainTab; storageOk: boolean } {
  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  let base = createInitialStudentState();
  let storageOk = true;

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StudentState>;
        if (parsed && parsed.version === 2) {
          base = {
            ...base,
            ...parsed,
            dialogueCompleted: { ...base.dialogueCompleted, ...(parsed.dialogueCompleted ?? {}) },
            escapeRoom: { ...base.escapeRoom, ...(parsed.escapeRoom ?? {}) },
          };
        }
      }
    } catch {
      storageOk = false;
    }
  }

  if (autostart && !base.profile) {
    base = {
      ...base,
      profile: { name: 'Antía', grade: '5º Primaria', track: '10-14' },
    };
  }

  const initialTab: MainTab = autostart ? 'explorar' : base.profile ? 'inicio' : 'inicio';
  return { state: base, initialTab, storageOk };
}

function withSyncedBadges(next: StudentState): StudentState {
  const badges = computeEarnedBadges(next);
  return { ...next, badges };
}

export default function App() {
  const initial = useMemo(() => loadInitialState(), []);
  const [studentState, setStudentState] = useState<StudentState>(initial.state);
  const [activeTab, setActiveTab] = useState<MainTab>(initial.initialTab);
  const [storageWarning] = useState(!initial.storageOk);
  const [teacherOpen, setTeacherOpen] = useState(false);

  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [selectedVocabId, setSelectedVocabId] = useState<string | null>(null);
  const [escapeFocusRoom, setEscapeFocusRoom] = useState<string | null>(null);
  const [lastPicked3dId, setLastPicked3dId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const prevEscapeRef = useRef({
    startedAt: studentState.escapeRoom.startedAt,
    stageIndex: studentState.escapeRoom.stageIndex,
    finished: studentState.escapeRoom.finished,
  });

  const triggerCelebration = useCallback((kind: CelebrationKind) => {
    setCelebration({ id: Date.now() + Math.random(), kind });
  }, []);

  // Trigger confetti celebration when an Escape Room stage or full game is completed
  useEffect(() => {
    const next = {
      startedAt: studentState.escapeRoom.startedAt,
      stageIndex: studentState.escapeRoom.stageIndex,
      finished: studentState.escapeRoom.finished,
    };
    const kind = detectEscapeCelebration(prevEscapeRef.current, next);
    prevEscapeRef.current = next;
    if (kind) {
      triggerCelebration(kind);
    }
  }, [
    studentState.escapeRoom.startedAt,
    studentState.escapeRoom.stageIndex,
    studentState.escapeRoom.finished,
    triggerCelebration,
  ]);

  // Sync body state attribute for accessibility & verification
  useEffect(() => {
    document.body.dataset.state = activeTab === 'inicio' ? 'title' : activeTab;
  }, [activeTab]);

  // Persist to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(studentState));
    } catch {
      // ignore
    }
  }, [studentState]);

  // Render 3D thumbnails and preload English SpeechSynthesis voices once on mount
  useEffect(() => {
    void loadEnglishVoices();
    const id = window.setTimeout(() => {
      const imgs = renderVocabThumbnails(160);
      setThumbnails(imgs);
    }, 120);
    return () => window.clearTimeout(id);
  }, []);

  const updateState = useCallback((updater: (prev: StudentState) => StudentState) => {
    setStudentState((prev) => withSyncedBadges(updater(prev)));
  }, []);

  const handleStartProfile = (profile: StudentProfile) => {
    const today = new Date().toISOString().slice(0, 10);
    updateState((prev) => ({
      ...prev,
      profile,
      lastStudyDay: today,
    }));
    setActiveTab('explorar');
  };

  const handleSelectSituation = (sit: SituationId) => {
    updateState((prev) => ({ ...prev, activeSituation: sit }));
    setSelectedVocabId(null);
  };

  const handleSelectObjectInExplorer = (vocabId: string) => {
    setSelectedVocabId(vocabId);
    const item = VOCAB_MAP[vocabId];
    if (item) {
      void speakEnglishWithFallback(item.word, false);
    }
  };

  const handleCompleteGuidedDialogue = (sit: SituationId) => {
    updateState((prev) => {
      const already = prev.dialogueCompleted[sit];
      return {
        ...prev,
        xp: prev.xp + (already ? 5 : 25),
        dialogueCompleted: { ...prev.dialogueCompleted, [sit]: true },
      };
    });
  };

  const handleRecordLeitner = (
    vocabId: string,
    outcome: 'correct' | 'partial' | 'wrong',
    xpGain: number
  ) => {
    updateState((prev) => ({
      ...prev,
      xp: prev.xp + xpGain,
      leitner: {
        ...prev.leitner,
        [vocabId]: advanceLeitnerCard(prev.leitner[vocabId], outcome),
      },
    }));
    if (shouldCelebrateFlashcard(outcome)) {
      triggerCelebration('flashcard');
    }
  };

  const handleCompleteTest = (
    kind: 'initial' | 'final',
    score: number,
    total: number,
    answers: Record<string, boolean>
  ) => {
    updateState((prev) => {
      const nextLeitner = { ...prev.leitner };
      for (const [id, ok] of Object.entries(answers)) {
        nextLeitner[id] = advanceLeitnerCard(nextLeitner[id], ok ? 'correct' : 'wrong');
      }
      if (kind === 'initial') {
        return {
          ...prev,
          xp: prev.xp + score * 5 + 15,
          leitner: nextLeitner,
          initialTest: { done: true, score, total, answers },
        };
      }
      return {
        ...prev,
        xp: prev.xp + score * 8 + 30,
        leitner: nextLeitner,
        finalTest: { ...prev.finalTest, unlocked: true, done: true, score, total, answers },
      };
    });
  };

  const handleSaveFlashcards = (cards: Omit<SavedFlashcard, 'id' | 'createdAt'>[]) => {
    const now = new Date().toISOString();
    updateState((prev) => ({
      ...prev,
      xp: prev.xp + cards.length * 15,
      savedFlashcards: [
        ...cards.map((c, idx) => ({
          ...c,
          id: `ai-${Date.now()}-${idx}`,
          createdAt: now,
        })),
        ...prev.savedFlashcards,
      ],
    }));
  };

  const handleRemoveSavedFlashcard = (id: string) => {
    updateState((prev) => ({
      ...prev,
      savedFlashcards: prev.savedFlashcards.filter((c) => c.id !== id),
    }));
  };

  // Escape room handlers
  const handleStartEscape = () => {
    updateState((prev) => ({
      ...prev,
      escapeRoom: {
        ...createInitialEscapeRoomState(),
        startedAt: new Date().toISOString(),
      },
    }));
  };

  const handleEscapeTick = useCallback((deltaMs: number) => {
    setStudentState((prev) => {
      if (!prev.escapeRoom.startedAt || prev.escapeRoom.finished) return prev;
      return {
        ...prev,
        escapeRoom: {
          ...prev.escapeRoom,
          activeMs: prev.escapeRoom.activeMs + deltaMs,
        },
      };
    });
  }, []);

  const handleEscapeHint = (newHintLevel: number) => {
    updateState((prev) => ({
      ...prev,
      escapeRoom: applyHintPenalty(prev.escapeRoom, newHintLevel),
    }));
  };

  const handleEscapeSolveStep = useCallback(
    (solvedWordIds: string[], hintLevelUsed: number) => {
      updateState((prev) => {
        const nextEsc = advanceEscapeStep(prev.escapeRoom, solvedWordIds, hintLevelUsed);
        const bonusXp = nextEsc.finished && !prev.escapeRoom.finished ? 60 : 15;
        return {
          ...prev,
          xp: prev.xp + bonusXp,
          escapeRoom: nextEsc,
        };
      });
    },
    [updateState]
  );

  const handleEscapeError = useCallback(() => {
    setStudentState((prev) => {
      const idx = prev.escapeRoom.stageIndex;
      return {
        ...prev,
        escapeRoom: {
          ...prev.escapeRoom,
          errors: {
            ...prev.escapeRoom.errors,
            [idx]: (prev.escapeRoom.errors[idx] ?? 0) + 1,
          },
        },
      };
    });
  }, []);

  const handleResetEscape = () => {
    updateState((prev) => ({
      ...prev,
      escapeRoom: createInitialEscapeRoomState(),
    }));
  };

  const handleClearPicked3d = useCallback(() => {
    setLastPicked3dId(null);
  }, []);

  // Compute highlighted 3D object IDs during Escape Room
  const escapeHighlightedIds = useMemo(() => {
    if (activeTab !== 'sala' || !studentState.escapeRoom.startedAt || studentState.escapeRoom.finished) {
      return [];
    }
    const stage = ESCAPE_STAGES[studentState.escapeRoom.stageIndex];
    const step = stage?.steps[studentState.escapeRoom.stepIndex];
    if (step?.type === 'writeEn') return step.targetIds;
    return [];
  }, [activeTab, studentState.escapeRoom]);

  const show3DStage = activeTab === 'explorar' || activeTab === 'sala';
  const sceneSituation: SituationId = activeTab === 'sala' ? 'home' : studentState.activeSituation;

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#f7f4ec] text-[#182433] lg:overflow-hidden">
      <CelebrationConfetti event={celebration} reduceMotion={studentState.reduceMotion} />
      <Header
        activeTab={activeTab}
        hasProfile={Boolean(studentState.profile)}
        onSelectTab={setActiveTab}
        onOpenTeacher={() => setTeacherOpen(true)}
      />

      {storageWarning && (
        <div className="bg-[#fef3c7] text-[#92400e] text-xs px-4 py-1.5 text-center border-b border-[#f59e0b]/40">
          O almacenamento local está desactivado; o progreso desta sesión non se gardará ao pechar.
        </div>
      )}

      {activeTab === 'inicio' && (
        <WelcomeView
          studentState={studentState}
          onStartProfile={handleStartProfile}
          onContinue={() => setActiveTab('explorar')}
        />
      )}

      {show3DStage && (
        <main className="flex-1 lg:min-h-0 flex flex-col lg:flex-row gap-4 p-4 max-w-[1440px] w-full mx-auto lg:overflow-hidden">
          <div className="flex-1 min-h-[340px] lg:min-h-0">
            <ThreeSimulatorCanvas
              situation={sceneSituation}
              selectedId={activeTab === 'explorar' ? selectedVocabId : null}
              highlightedIds={escapeHighlightedIds}
              focusRoomId={activeTab === 'sala' ? escapeFocusRoom : null}
              onSelectObject={(vocabId) => {
                if (activeTab === 'explorar') {
                  handleSelectObjectInExplorer(vocabId);
                } else if (activeTab === 'sala') {
                  setLastPicked3dId(vocabId);
                }
              }}
              reduceMotion={studentState.reduceMotion}
              captionGl={
                activeTab === 'sala'
                  ? 'Escape Room da casa · Preme nos mobles para resolver as pistas'
                  : `${SITUATION_MAP[sceneSituation].titleEn} · Arrasta para xirar e preme nun obxecto`
              }
            />
          </div>

          {activeTab === 'explorar' && (
            <ExplorerView
              track={studentState.profile?.track ?? '10-14'}
              activeSituation={studentState.activeSituation}
              selectedId={selectedVocabId}
              thumbnails={thumbnails}
              dialogueCompleted={studentState.dialogueCompleted}
              teacherUnlockedAll={studentState.teacherUnlockedAll}
              onSelectSituation={handleSelectSituation}
              onSelectObject={handleSelectObjectInExplorer}
              onCompleteGuidedDialogue={handleCompleteGuidedDialogue}
              onGoToConversation={() => setActiveTab('conversa')}
              onGoToStudy={() => setActiveTab('estudar')}
            />
          )}

          {activeTab === 'sala' && (
            <EscapeRoomView
              escapeRoom={studentState.escapeRoom}
              lastPicked3dId={lastPicked3dId}
              onStartEscape={handleStartEscape}
              onTickMs={handleEscapeTick}
              onUseHint={handleEscapeHint}
              onSolveStep={handleEscapeSolveStep}
              onRecordError={handleEscapeError}
              onResetEscape={handleResetEscape}
              onFocusRoom={setEscapeFocusRoom}
              onClearPicked3d={handleClearPicked3d}
            />
          )}
        </main>
      )}

      {activeTab === 'estudar' && (
        <StudyView
          studentState={studentState}
          thumbnails={thumbnails}
          onRecordLeitner={handleRecordLeitner}
          onCompleteTest={handleCompleteTest}
          onRemoveSavedFlashcard={handleRemoveSavedFlashcard}
        />
      )}

      {activeTab === 'conversa' && (
        <ConversationView
          track={studentState.profile?.track ?? '10-14'}
          grade={studentState.profile?.grade}
          activeSituation={studentState.activeSituation}
          teacherUnlockedAll={studentState.teacherUnlockedAll}
          onSelectSituation={handleSelectSituation}
          onSaveFlashcards={handleSaveFlashcards}
          onGoToGuidedMiniChallenge={() => setActiveTab('explorar')}
        />
      )}

      {activeTab === 'informe' && (
        <ReportView
          studentState={studentState}
          onImportState={(next) => setStudentState(withSyncedBadges(next))}
        />
      )}

      <TeacherModal
        open={teacherOpen}
        studentState={studentState}
        onClose={() => setTeacherOpen(false)}
        onUnlockFinalTest={() =>
          updateState((prev) => ({
            ...prev,
            finalTest: { ...prev.finalTest, unlocked: true },
          }))
        }
        onUnlockAllSituations={() =>
          updateState((prev) => ({
            ...prev,
            teacherUnlockedAll: true,
          }))
        }
        onResetEscapeRoom={handleResetEscape}
        onResetAll={() => {
          setStudentState(createInitialStudentState());
          setActiveTab('inicio');
          setTeacherOpen(false);
        }}
      />
    </div>
  );
}
