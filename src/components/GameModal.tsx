import React from 'react';
import { CHAPTERS } from '../game/levelData';
import type { HudSnapshot } from '../game/types';

interface GameModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestartChapter: () => void;
  onPlayAgain: () => void;
  onReturnToTitle: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const GameModal: React.FC<GameModalProps> = ({
  hud,
  onResume,
  onRestartChapter,
  onPlayAgain,
  onReturnToTitle,
}) => {
  if (hud.screen !== 'paused' && hud.screen !== 'gameover') return null;

  const isVictory = hud.screen === 'gameover' && hud.outcome === 'victory';
  const isDefeat = hud.screen === 'gameover' && hud.outcome === 'defeat';
  const chapterMeta = CHAPTERS[hud.chapter];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#070609]/82">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-modal-title"
        className="w-full max-w-md bg-[#110f14] border border-[#c49a5c]/40 p-8 shadow-[0_24px_60px_rgba(0,0,0,0.9)] flex flex-col gap-6"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#c49a5c]">
            Chapter {chapterMeta.numeral} · {chapterMeta.title}
          </span>
          <h2 id="game-modal-title" className="font-display text-3xl font-bold text-[#f2ece4]">
            {hud.screen === 'paused'
              ? 'Pilgrimage Paused'
              : isVictory
                ? 'Oath Fulfilled'
                : 'Fallen in Ash'}
          </h2>
          {isVictory && (
            <p className="text-sm text-[#bfb4a6]">
              Malakor lies shattered upon the Obsidian Throne. The Keep falls silent.
            </p>
          )}
          {isDefeat && (
            <p className="text-sm text-[#bfb4a6]">
              Your steel broke before the Prelate&apos;s legion. Rise again at the chapter gate.
            </p>
          )}
        </div>

        {/* Stat Tiles (Tabular Numerals) */}
        <div className="grid grid-cols-3 gap-3 border-y border-[#c49a5c]/20 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] uppercase tracking-wider text-[#9c8f80]">
              Slain
            </span>
            <span className="font-mono-num text-xl font-bold text-[#f2ece4]">
              {hud.kills}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] uppercase tracking-wider text-[#9c8f80]">
              Executions
            </span>
            <span className="font-mono-num text-xl font-bold text-[#d94d3b]">
              {hud.executions}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] uppercase tracking-wider text-[#9c8f80]">
              {isVictory ? 'Clear Time' : 'Time'}
            </span>
            <span className="font-mono-num text-xl font-bold text-[#f2ece4]">
              {formatDuration(hud.elapsedSeconds)}
            </span>
          </div>
        </div>

        {/* Primary Action CTAs */}
        <div className="flex flex-col gap-2.5">
          {hud.screen === 'paused' ? (
            <>
              <button
                type="button"
                onClick={onResume}
                className="w-full py-3 px-4 bg-[#9e1c16] hover:bg-[#b8231c] text-[#f5efe6] font-display text-sm font-bold tracking-wider border border-[#d66558]/40 transition-colors cursor-pointer"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={onRestartChapter}
                className="w-full py-2.5 px-4 bg-[#19161d] hover:bg-[#231e28] text-[#e6dfd5] text-sm font-semibold border border-[#c49a5c]/30 transition-colors cursor-pointer"
              >
                Restart Chapter
              </button>
            </>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onPlayAgain}
              className="w-full py-3 px-4 bg-[#9e1c16] hover:bg-[#b8231c] text-[#f5efe6] font-display text-sm font-bold tracking-wider border border-[#d66558]/40 transition-colors cursor-pointer"
            >
              {isVictory ? 'Play Again' : 'Try Again'}
            </button>
          )}
          <button
            type="button"
            onClick={onReturnToTitle}
            className="w-full py-2.5 px-4 bg-transparent hover:bg-[#19161d] text-[#b8aa98] text-sm font-medium border border-[#3a333b] transition-colors cursor-pointer"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
};
