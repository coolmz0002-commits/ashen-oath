import type {
  ChapterIndex,
  ChapterMeta,
  EnemySpawn,
  FlameHazard,
  LoreShrine,
  PlatformBox,
  RuneGate,
} from './types';

export const CHAPTERS: ChapterMeta[] = [
  {
    index: 0,
    numeral: 'I',
    title: 'The Sunken Causeway',
    subtitle: 'Outer Bastion of the Oathbreakers',
    spawnPos: [0, 0, 9],
    spawnYaw: 0,
    introLine:
      'Seven winters since the Keep burned. Only iron and ash remain to guard the oath.',
  },
  {
    index: 1,
    numeral: 'II',
    title: 'The Crimson Crucible',
    subtitle: 'Forges of the Iron Prelate',
    spawnPos: [0, 1.5, -40],
    spawnYaw: 0,
    introLine:
      'The crucible braziers still breathe. Malakor tempered his legion in traitor blood.',
  },
  {
    index: 2,
    numeral: 'III',
    title: 'The Throne of Cinders',
    subtitle: 'Sanctum of Malakor',
    spawnPos: [0, 4.2, -104],
    spawnYaw: 0,
    introLine:
      'At the summit of obsidian lies the Prelate. Break his stance—claim the final word.',
  },
];

export const PLATFORMS: PlatformBox[] = [
  // ================= CHAPTER I: THE SUNKEN CAUSEWAY =================
  // Starting Sanctuary Terrace (open 14m wide, clear forward sightline)
  {
    id: 'ch1_start_terrace',
    x: 0,
    y: 0,
    z: 8,
    width: 14,
    height: 6,
    depth: 18,
    chapter: 0,
    kind: 'terrace',
  },
  // Gap from z=-1 to z=-3.6 (2.6m easy platforming leap)
  // Causeway Span A
  {
    id: 'ch1_bridge_a',
    x: 0,
    y: 0.2,
    z: -10,
    width: 10,
    height: 6,
    depth: 13,
    chapter: 0,
    kind: 'bridge',
  },
  // Elevated flanking balcony step (optional high route / vantage)
  {
    id: 'ch1_step_east',
    x: 7.5,
    y: 1.4,
    z: -12,
    width: 4.5,
    height: 5,
    depth: 6,
    chapter: 0,
    kind: 'step',
  },
  // Gap from z=-16.5 to z=-19.2 (2.7m leap)
  // Courtyard of the Vanguard
  {
    id: 'ch1_courtyard',
    x: 0,
    y: 0,
    z: -28.5,
    width: 16,
    height: 7,
    depth: 18.5,
    chapter: 0,
    kind: 'arena',
  },

  // ================= CHAPTER II: THE CRIMSON CRUCIBLE =================
  // Stepped ascent bridge out of Gate I (z=-37.75)
  {
    id: 'ch2_step_1',
    x: 0,
    y: 0.8,
    z: -41.5,
    width: 9,
    height: 6,
    depth: 7,
    chapter: 1,
    kind: 'step',
  },
  {
    id: 'ch2_step_2',
    x: 0,
    y: 1.8,
    z: -49.5,
    width: 8,
    height: 6,
    depth: 6,
    chapter: 1,
    kind: 'step',
  },
  // Side stepping stone over chasm
  {
    id: 'ch2_stone_west',
    x: -6.5,
    y: 2.5,
    z: -54.5,
    width: 5,
    height: 6,
    depth: 5,
    chapter: 1,
    kind: 'step',
  },
  // Main Crucible Arena
  {
    id: 'ch2_arena',
    x: 0,
    y: 3.0,
    z: -68,
    width: 20,
    height: 8,
    depth: 24,
    chapter: 1,
    kind: 'arena',
  },
  // Elevated Acolyte Balconies flanking Crucible Arena
  {
    id: 'ch2_balcony_west',
    x: -11.5,
    y: 4.8,
    z: -69,
    width: 5,
    height: 6,
    depth: 10,
    chapter: 1,
    kind: 'balcony',
  },
  {
    id: 'ch2_balcony_east',
    x: 11.5,
    y: 4.8,
    z: -69,
    width: 5,
    height: 6,
    depth: 10,
    chapter: 1,
    kind: 'balcony',
  },
  // Exit Causeway to Gate II
  {
    id: 'ch2_exit_span',
    x: 0,
    y: 3.0,
    z: -86,
    width: 10,
    height: 7,
    depth: 12,
    chapter: 1,
    kind: 'bridge',
  },

  // ================= CHAPTER III: THE THRONE OF CINDERS =================
  // Broken Monolith Crossing (platforming rhythm before boss)
  {
    id: 'ch3_monolith_1',
    x: -2.2,
    y: 3.4,
    z: -95.5,
    width: 5.5,
    height: 7,
    depth: 5.5,
    chapter: 2,
    kind: 'step',
  },
  {
    id: 'ch3_monolith_2',
    x: 2.2,
    y: 3.9,
    z: -102.5,
    width: 6.5,
    height: 7,
    depth: 5.5,
    chapter: 2,
    kind: 'step',
  },
  // Pre-Boss Altar Terrace
  {
    id: 'ch3_altar_terrace',
    x: 0,
    y: 4.2,
    z: -112,
    width: 12,
    height: 8,
    depth: 10,
    chapter: 2,
    kind: 'terrace',
  },
  // Grand Throne of Cinders Boss Arena
  {
    id: 'ch3_throne_arena',
    x: 0,
    y: 4.2,
    z: -133,
    width: 26,
    height: 9,
    depth: 30,
    chapter: 2,
    kind: 'arena',
  },
];

export const FLAME_HAZARDS: FlameHazard[] = [
  {
    id: 'haz_ch2_1',
    x: 0,
    y: 1.8,
    z: -49.5,
    radius: 2.1,
    period: 3.6,
    phaseOffset: 0,
    chapter: 1,
  },
  {
    id: 'haz_ch2_2',
    x: -4.5,
    y: 3.0,
    z: -62,
    radius: 2.2,
    period: 4.0,
    phaseOffset: 1.8,
    chapter: 1,
  },
  {
    id: 'haz_ch2_3',
    x: 4.5,
    y: 3.0,
    z: -62,
    radius: 2.2,
    period: 4.0,
    phaseOffset: 0.2,
    chapter: 1,
  },
  {
    id: 'haz_ch3_1',
    x: 0,
    y: 4.2,
    z: -125,
    radius: 2.3,
    period: 4.5,
    phaseOffset: 0.9,
    chapter: 2,
  },
];

export const LORE_SHRINES: LoreShrine[] = [
  {
    id: 'shrine_1',
    x: -4.2,
    y: 0,
    z: 5.5,
    chapter: 0,
    title: 'Oathstone of Ash',
    speaker: 'Inscribed Tablet',
    lines: [
      'Strike true with Steel [J], shatter shields with Cleave [K], and deflect blows [F] to break the sworn.',
    ],
    grantsVial: false,
  },
  {
    id: 'shrine_2',
    x: -7.5,
    y: 3.0,
    z: -59,
    chapter: 1,
    title: 'Crucible Reliquary',
    speaker: 'Echo of the Fallen',
    lines: [
      'When an enemy staggers under crimson light, step close and Execute [E] to tear vitality from their ribs.',
    ],
    grantsVial: true,
  },
  {
    id: 'shrine_3',
    x: 3.8,
    y: 4.2,
    z: -110.5,
    chapter: 2,
    title: 'Altar Before the Pyre',
    speaker: 'Kaelen, Oathbreaker',
    lines: [
      'Malakor awaits beyond the arch. No mercy for kings built on cinders.',
    ],
    grantsVial: true,
  },
];

export const RUNE_GATES: RuneGate[] = [
  {
    id: 'gate_ch1',
    chapter: 0,
    x: 0,
    y: 0,
    z: -36.5,
    width: 7.5,
    height: 6.2,
  },
  {
    id: 'gate_ch2',
    chapter: 1,
    x: 0,
    y: 3.0,
    z: -91.0,
    width: 7.5,
    height: 6.2,
  },
];

export const ENEMY_SPAWNS: EnemySpawn[] = [
  // Chapter I
  {
    id: 'e_ch1_thrall_0',
    archetype: 'thrall',
    chapter: 0,
    x: 0.6,
    y: 0,
    z: 1.8,
    facingYaw: Math.PI,
  },
  {
    id: 'e_ch1_thrall_1',
    archetype: 'thrall',
    chapter: 0,
    x: -2.4,
    y: 0.2,
    z: -9.5,
    facingYaw: Math.PI,
  },
  {
    id: 'e_ch1_thrall_2',
    archetype: 'thrall',
    chapter: 0,
    x: 2.4,
    y: 0.2,
    z: -12.5,
    facingYaw: Math.PI,
  },
  {
    id: 'e_ch1_halberdier_1',
    archetype: 'halberdier',
    chapter: 0,
    x: 0,
    y: 0,
    z: -28.5,
    facingYaw: Math.PI,
  },
  {
    id: 'e_ch1_thrall_3',
    archetype: 'thrall',
    chapter: 0,
    x: -4.8,
    y: 0,
    z: -26.5,
    facingYaw: Math.PI,
  },
  {
    id: 'e_ch1_thrall_4',
    archetype: 'thrall',
    chapter: 0,
    x: 4.8,
    y: 0,
    z: -30.5,
    facingYaw: Math.PI,
  },

  // Chapter II
  {
    id: 'e_ch2_halberdier_1',
    archetype: 'halberdier',
    chapter: 1,
    x: -3.5,
    y: 3.0,
    z: -66.5,
    facingYaw: Math.PI,
  },
  {
    id: 'e_ch2_halberdier_2',
    archetype: 'halberdier',
    chapter: 1,
    x: 3.5,
    y: 3.0,
    z: -71.5,
    facingYaw: Math.PI,
  },
  {
    id: 'e_ch2_thrall_1',
    archetype: 'thrall',
    chapter: 1,
    x: 0,
    y: 3.0,
    z: -63.5,
    facingYaw: Math.PI,
  },
  {
    id: 'e_ch2_acolyte_1',
    archetype: 'acolyte',
    chapter: 1,
    x: -11.5,
    y: 4.8,
    z: -69,
    facingYaw: Math.PI / 2,
  },
  {
    id: 'e_ch2_acolyte_2',
    archetype: 'acolyte',
    chapter: 1,
    x: 11.5,
    y: 4.8,
    z: -69,
    facingYaw: -Math.PI / 2,
  },

  // Chapter III Boss
  {
    id: 'e_ch3_boss_malakor',
    archetype: 'boss',
    chapter: 2,
    x: 0,
    y: 4.2,
    z: -136,
    facingYaw: Math.PI,
  },
];

export function getChapterForZ(z: number): ChapterIndex {
  if (z < -91) return 2;
  if (z < -36.5) return 1;
  return 0;
}
