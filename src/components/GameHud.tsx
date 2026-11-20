import React, { useEffect, useRef, useState } from 'react';
import { CHAPTERS } from '../game/levelData';
import type { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  onToggleMute: () => void;
  onToggleLockOn: () => void;
  onPause: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  onToggleMute,
  onToggleLockOn,
  onPause,
}) => {
  const [ghostHp, setGhostHp] = useState(hud.hp);
  const ghostTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (hud.hp >= ghostHp) {
      setGhostHp(hud.hp);
      return;
    }
    if (ghostTimerRef.current) window.clearTimeout(ghostTimerRef.current);
    ghostTimerRef.current = window.setTimeout(() => {
      setGhostHp(hud.hp);
    }, 340);
    return () => {
      if (ghostTimerRef.current) window.clearTimeout(ghostTimerRef.current);
    };
  }, [hud.hp, ghostHp]);

  const chapterMeta = CHAPTERS[hud.chapter];
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const ghostPct = Math.max(0, Math.min(100, (ghostHp / hud.maxHp) * 100));
  const stamPct = Math.max(0, Math.min(100, (hud.stamina / hud.maxStamina) * 100));
  const lowHp = hud.hp > 0 && hud.hp <= 30;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Peripheral Low-HP Vignette & Parry Flash */}
      {lowHp && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 110px rgba(165, 16, 16, 0.58)',
          }}
        />
      )}
      {hud.parryFlash && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 70px rgba(240, 184, 82, 0.5)',
          }}
        />
      )}

      {/* TOP-LEFT: Hero Vitality, Stamina, Vials, Chapter */}
      <div className="fixed top-5 left-5 flex flex-col gap-2 max-w-[340px]">
        <div className="flex items-center gap-3">
          {/* Custom SVG Crimson Crest */}
          <svg viewBox="0 0 28 28" className="w-7 h-7 shrink-0" aria-hidden="true">
            <polygon
              points="14,2 25,10 21,25 7,25 3,10"
              fill="#171216"
              stroke="#c49a5c"
              strokeWidth="1.6"
            />
            <polygon points="14,6 20,12 17,21 11,21 8,12" fill="#a81d18" />
          </svg>

          <div className="flex flex-col gap-1 min-w-[220px]">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[11px] font-semibold tracking-widest uppercase text-[#c4b7a6] hud-text-shadow">
                Vitality
              </span>
              <span
                data-testid="hud-hp"
                className="font-mono-num text-sm font-bold text-[#f2ece4] hud-text-shadow"
              >
                {hud.hp} / {hud.maxHp}
              </span>
            </div>

            {/* HP Bar with delayed trailing ghost damage bar */}
            <div className="relative h-3 w-full bg-[#131016]/90 border border-[#c49a5c]/35 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#e6a65c]/75 transition-all duration-300"
                style={{ width: `${ghostPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-[#b31e19] transition-all duration-100"
                style={{ width: `${hpPct}%` }}
              />
            </div>

            {/* Stamina Bar */}
            <div className="relative h-1.5 w-full bg-[#131016]/90 border border-[#5e564e]/45 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#c49a5c] transition-all duration-75"
                style={{ width: `${stamPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Crimson Vials & Chapter Indicator */}
        <div className="flex items-center gap-4 pl-10">
          <div className="flex items-center gap-1.5" aria-label={`Crimson Vials: ${hud.vials}`}>
            {Array.from({ length: hud.maxVials }).map((_, idx) => {
              const filled = idx < hud.vials;
              return (
                <svg
                  key={idx}
                  viewBox="0 0 18 22"
                  className="w-4 h-5"
                  aria-hidden="true"
                >
                  <path
                    d="M6 2 H12 V6 L15 11 V19 H3 V11 L6 6 Z"
                    fill={filled ? '#b81d18' : '#18141a'}
                    stroke={filled ? '#e0a96d' : '#4a434a'}
                    strokeWidth="1.4"
                  />
                </svg>
              );
            })}
            <span className="text-[11px] font-mono-num text-[#c4b7a6] hud-text-shadow ml-1">
              [R]
            </span>
          </div>

          <span className="text-xs text-[#b5a795] hud-text-shadow truncate">
            Ch. {chapterMeta.numeral} · {chapterMeta.title}
          </span>
        </div>
      </div>

      {/* TOP-RIGHT: Compact Square Utility Controls */}
      <div className="fixed top-5 right-5 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleLockOn();
          }}
          title="Lock On (Tab)"
          aria-label={hud.lockedTargetName ? 'Unlock Target' : 'Lock Nearest Enemy'}
          className={`w-10 h-10 flex items-center justify-center border transition-colors cursor-pointer ${
            hud.lockedTargetName
              ? 'bg-[#9e1c16]/90 border-[#e0a96d] text-[#f5efe6]'
              : 'bg-[#121015]/88 border-[#c49a5c]/30 text-[#d8cfc3] hover:bg-[#1e1a22]'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="6" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          title="Mute Audio (M)"
          aria-label={hud.muted ? 'Unmute Audio' : 'Mute Audio'}
          className="w-10 h-10 flex items-center justify-center bg-[#121015]/88 hover:bg-[#1e1a22] border border-[#c49a5c]/30 text-[#d8cfc3] transition-colors cursor-pointer"
        >
          {hud.muted ? (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M22 9l-6 6M16 9l6 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
            </svg>
          )}
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
          title="Pause (P / Esc)"
          aria-label="Pause Game"
          className="w-10 h-10 flex items-center justify-center bg-[#121015]/88 hover:bg-[#1e1a22] border border-[#c49a5c]/30 text-[#d8cfc3] transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" />
            <rect x="14" y="5" width="4" height="14" />
          </svg>
        </button>
      </div>

      {/* TOP-CENTER: Boss Health / Locked Target / Chapter Banner */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 w-[min(460px,80vw)]">
        {hud.bossActive ? (
          <div className="w-full flex flex-col gap-1 bg-[#0e0c11]/85 px-4 py-2.5 border border-[#c49a5c]/35">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-sm font-bold tracking-wider text-[#efe8dc]">
                {hud.bossName}
                {hud.bossPhase === 2 ? ' · Molten Fury' : ''}
              </span>
              <span className="font-mono-num text-xs text-[#c7b9a7]">
                {hud.bossHp} / {hud.bossMaxHp}
              </span>
            </div>
            <div className="h-2.5 w-full bg-[#1a1419] border border-[#52453b]">
              <div
                className="h-full bg-[#b8201a] transition-all duration-100"
                style={{ width: `${(hud.bossHp / hud.bossMaxHp) * 100}%` }}
              />
            </div>
            <div className="h-1 w-full bg-[#1a1419]">
              <div
                className="h-full bg-[#e39b42] transition-all duration-100"
                style={{ width: `${(hud.bossPosture / hud.bossMaxPosture) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          hud.lockedTargetName && (
            <div className="w-[280px] flex flex-col gap-1 bg-[#0e0c11]/82 px-3 py-1.5 border border-[#c49a5c]/30">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-[#e6dfd5]">
                  {hud.lockedTargetName}
                </span>
                <span className="font-mono-num text-[11px] text-[#b8aa98]">
                  {hud.lockedTargetHp} HP
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#1a1419]">
                <div
                  className="h-full bg-[#b8201a]"
                  style={{ width: `${(hud.lockedTargetHp / hud.lockedTargetMaxHp) * 100}%` }}
                />
              </div>
              <div className="h-1 w-full bg-[#1a1419]">
                <div
                  className="h-full bg-[#e39b42]"
                  style={{
                    width: `${(hud.lockedTargetPosture / hud.lockedTargetMaxPosture) * 100}%`,
                  }}
                />
              </div>
            </div>
          )
        )}

        {hud.chapterBanner && (
          <div className="mt-4 px-6 py-2.5 bg-[#0e0c11]/88 border-y border-[#c49a5c]/45 text-center">
            <span className="font-display text-lg md:text-xl font-bold tracking-widest text-[#efe8dc] hud-text-shadow">
              {hud.chapterBanner}
            </span>
          </div>
        )}
      </div>

      {/* BOTTOM-CENTER: Contextual Execute or Shrine Commune Prompt */}
      {(hud.canExecuteName || hud.canInteractTitle) && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2">
          {hud.canExecuteName ? (
            <div className="px-5 py-2 bg-[#7a120e]/95 border border-[#f0a55b] text-[#faf3eb] font-display text-sm font-bold tracking-wider shadow-[0_8px_22px_rgba(0,0,0,0.85)]">
              [E] Execute · {hud.canExecuteName}
            </div>
          ) : (
            <div className="px-4 py-2 bg-[#121015]/92 border border-[#c49a5c]/50 text-[#e8dfd2] text-xs font-semibold tracking-wider shadow-[0_8px_22px_rgba(0,0,0,0.8)]">
              [E] Commune · {hud.canInteractTitle}
            </div>
          )}
        </div>
      )}

      {/* BOTTOM-LEFT: Story Beat / Lore Dialogue Ribbon */}
      {hud.storyBeat && (
        <div className="fixed bottom-6 left-6 max-w-[480px] bg-[#0d0b10]/90 border border-[#c49a5c]/35 px-5 py-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.8)]">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#d4a568] mb-1">
            {hud.storyBeat.title} · {hud.storyBeat.speaker}
          </div>
          <p className="text-sm leading-relaxed text-[#e8e2d9]">
            {hud.storyBeat.text}
          </p>
        </div>
      )}

      {/* BOTTOM-RIGHT: Combo & Brutality Readout */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-1.5">
        {hud.comboCount > 1 && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-display text-4xl font-extrabold text-[#e66b45] stroke-text font-mono-num">
              {hud.comboCount}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-[#e8dfd4] hud-text-shadow">
              Hit Combo
            </span>
          </div>
        )}
        <div className="flex items-center gap-4 text-xs font-mono-num text-[#c4b7a6] hud-text-shadow">
          <span data-testid="hud-kills">Slain {hud.kills}</span>
          <span aria-hidden="true">·</span>
          <span data-testid="hud-executions">Executions {hud.executions}</span>
          <span aria-hidden="true">·</span>
          <span>Parries {hud.parries}</span>
        </div>
      </div>
    </div>
  );
};
