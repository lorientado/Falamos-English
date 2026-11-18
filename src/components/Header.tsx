import React from 'react';
import { MainTab } from '../types';

interface HeaderProps {
  activeTab: MainTab;
  hasProfile: boolean;
  onSelectTab: (tab: MainTab) => void;
  onOpenTeacher: () => void;
}

const NAV_ITEMS: { id: MainTab; label: string }[] = [
  { id: 'explorar', label: 'Explorar' },
  { id: 'estudar', label: 'Estudar' },
  { id: 'conversa', label: 'Conversa' },
  { id: 'sala', label: 'Escape Room' },
  { id: 'informe', label: 'Informe' },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  hasProfile,
  onSelectTab,
  onOpenTeacher,
}) => {
  return (
    <header className="w-full bg-[#ffffff] border-b border-[#d6cab4] px-3 md:px-8 py-3 shrink-0">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3 md:gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('inicio')}
          className="font-display text-base md:text-xl font-bold tracking-tight text-[#182433] hover:text-[#1d4ed8] transition-colors whitespace-nowrap shrink-0 cursor-pointer text-left"
        >
          Falamos English
        </button>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav
          aria-label="Navegación principal"
          className="flex items-center gap-2.5 md:gap-6 overflow-x-auto min-w-0"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!hasProfile}
                onClick={() => onSelectTab(item.id)}
                className={`py-1.5 text-xs md:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  isActive
                    ? 'text-[#1d4ed8] border-[#1d4ed8]'
                    : 'text-[#4b5768] border-transparent hover:text-[#182433]'
                } ${!hasProfile ? 'opacity-45 cursor-not-allowed' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary utility action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenTeacher}
            className="px-4 py-2 text-xs md:text-sm font-semibold text-[#ffffff] bg-[#182433] rounded-lg hover:bg-[#1d4ed8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Docente
          </button>
        </div>
      </div>
    </header>
  );
};
