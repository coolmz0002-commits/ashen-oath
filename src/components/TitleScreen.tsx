import React from 'react';
import { CHAPTERS } from '../game/levelData';
import type { ChapterIndex } from '../game/types';

interface TitleScreenProps {
  highestChapter: ChapterIndex;
  onStart: (chapter?: ChapterIndex) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ highestChapter, onStart }) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-8 md:p-14 bg-gradient-to-r from-[#09080b]/90 via-[#09080b]/45 to-transparent">
      <div className="max-w-lg my-auto flex flex-col items-start gap-7">
        {/* Custom Inline SVG Emblem & Title Lockup */}
        <div className="flex flex-col items-start gap-3">
          <svg
            viewBox="0 0 360 88"
            className="w-[310px] md:w-[360px] h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.95)]"
            role="img"
            aria-label="Ashen Oath"
          >
            {/* Sword & Crown Crest */}
            <g transform="translate(8, 12)">
              <path
                d="M28 2 L34 18 L50 18 L38 28 L42 46 L28 36 L14 46 L18 28 L6 18 L22 18 Z"
                fill="none"
                stroke="#c49a5c"
                strokeWidth="1.8"
              />
              <path d="M28 8 L28 58" stroke="#c82b24" strokeWidth="3.2" strokeLinecap="round" />
              <path d="M18 46 L38 46" stroke="#c49a5c" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="28" cy="24" r="4" fill="#c82b24" />
            </g>

            {/* Engraved Display Typography */}
            <text
              x="76"
              y="46"
              fill="#efe8dc"
              fontFamily="Cinzel, Georgia, serif"
              fontWeight="800"
              fontSize="36"
              letterSpacing="3"
            >
              ASHEN OATH
            </text>
            <line x1="76" y1="56" x2="344" y2="56" stroke="#c49a5c" strokeOpacity="0.45" strokeWidth="1" />
            <text
              x="77"
              y="74"
              fill="#b8aa99"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="600"
              fontSize="12.5"
              letterSpacing="3.5"
            >
              BLOOD OF THE BASALT KEEP
            </text>
          </svg>
        </div>

        {/* Primary CTA */}
        <div className="flex flex-col items-start gap-4 w-full">
          <button
            type="button"
            data-start="true"
            onClick={() => onStart(0)}
            className="px-7 py-3.5 bg-[#9e1c16] hover:bg-[#b8231c] active:bg-[#821510] text-[#f5efe6] border border-[#d66558]/40 font-display text-base font-bold tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-[0_10px_28px_rgba(0,0,0,0.75)] focus-visible:outline-2 focus-visible:outline-[#e29f5a]"
          >
            Begin Pilgrimage
          </button>

          {/* Chapter Select Strip */}
          <div className="flex flex-col gap-2 pt-2">
            <span className="text-xs font-medium tracking-widest uppercase text-[#a39789] hud-text-shadow">
              Chapters
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {CHAPTERS.map((ch) => {
                const locked = ch.index > highestChapter;
                return (
                  <button
                    key={ch.index}
                    type="button"
                    disabled={locked}
                    onClick={() => onStart(ch.index)}
                    className={`px-3.5 py-2 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                      locked
                        ? 'bg-[#121015]/75 text-[#645c56] border-[#2c272c] cursor-not-allowed'
                        : 'bg-[#151218]/90 hover:bg-[#231b20] text-[#e8e0d5] border-[#c49a5c]/35 cursor-pointer'
                    }`}
                  >
                    {ch.numeral}. {ch.title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Flat Single-Line Control Hint in Bottom Safe Margin */}
      <div className="text-xs md:text-sm text-[#b4a89a] hud-text-shadow tracking-wide">
        WASD Move · Space Jump · Shift Dash · J / Left Click Slash · K / Right Click Cleave · F Parry · E Execute · R Heal · Tab Lock-On
      </div>
    </div>
  );
};
