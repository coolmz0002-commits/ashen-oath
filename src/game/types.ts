export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type GameOutcome = 'victory' | 'defeat' | null;

export type ChapterIndex = 0 | 1 | 2;

export type EnemyArchetype = 'thrall' | 'halberdier' | 'acolyte' | 'boss';

export type AttackKind = 'light1' | 'light2' | 'light3' | 'heavy' | 'execute';

export type AttackPhase = 'idle' | 'windup' | 'active' | 'recovery';

export interface PlatformBox {
  id: string;
  x: number;
  y: number; // top surface Y
  z: number;
  width: number;
  height: number; // vertical thickness downward from y
  depth: number;
  chapter: ChapterIndex;
  kind: 'terrace' | 'bridge' | 'step' | 'arena' | 'balcony';
  hasWalls?: {
    left?: boolean;
    right?: boolean;
  };
}

export interface FlameHazard {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  period: number;
  phaseOffset: number;
  chapter: ChapterIndex;
}

export interface LoreShrine {
  id: string;
  x: number;
  y: number;
  z: number;
  chapter: ChapterIndex;
  title: string;
  speaker: string;
  lines: string[];
  grantsVial: boolean;
}

export interface RuneGate {
  id: string;
  chapter: ChapterIndex;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
}

export interface EnemySpawn {
  id: string;
  archetype: EnemyArchetype;
  chapter: ChapterIndex;
  x: number;
  y: number;
  z: number;
  facingYaw: number;
}

export interface ChapterMeta {
  index: ChapterIndex;
  numeral: string;
  title: string;
  subtitle: string;
  spawnPos: [number, number, number];
  spawnYaw: number;
  introLine: string;
}

export interface PlayerSim {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  vials: number;
  maxVials: number;
  grounded: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpsRemaining: number;
  dashTimer: number;
  dashCooldown: number;
  dashDirX: number;
  dashDirZ: number;
  invulnTimer: number;
  parryTimer: number;
  parryCooldown: number;
  attackKind: AttackKind | null;
  attackTimer: number;
  attackHitIds: Set<string>;
  comboQueue: boolean;
  hitFlashTimer: number;
  healFlashTimer: number;
  safeX: number;
  safeY: number;
  safeZ: number;
  walkDistance: number;
  squashX: number;
  squashY: number;
  executingTargetId: string | null;
  executeTimer: number;
}

export interface EnemySim {
  id: string;
  archetype: EnemyArchetype;
  chapter: ChapterIndex;
  name: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  posture: number;
  maxPosture: number;
  radius: number;
  height: number;
  state: 'idle' | 'pursue' | 'windup' | 'attack' | 'recover' | 'staggered' | 'ko';
  stateTimer: number;
  attackCooldown: number;
  hitFlashTimer: number;
  koTimer: number;
  grounded: boolean;
  walkDistance: number;
  squashX: number;
  squashY: number;
  phase: 1 | 2;
  attackPattern: number;
  homeX: number;
  homeY: number;
  homeZ: number;
  hasBlockedRecently: number;
}

export interface StoryBeat {
  speaker: string;
  title: string;
  text: string;
  timer: number;
}

export interface HudSnapshot {
  screen: GameScreenState;
  outcome: GameOutcome;
  chapter: ChapterIndex;
  highestChapter: ChapterIndex;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  vials: number;
  maxVials: number;
  comboCount: number;
  comboTimer: number;
  kills: number;
  executions: number;
  parries: number;
  elapsedSeconds: number;
  lockedTargetName: string | null;
  lockedTargetHp: number;
  lockedTargetMaxHp: number;
  lockedTargetPosture: number;
  lockedTargetMaxPosture: number;
  bossActive: boolean;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  bossPosture: number;
  bossMaxPosture: number;
  bossPhase: 1 | 2;
  canExecuteName: string | null;
  canInteractTitle: string | null;
  storyBeat: StoryBeat | null;
  chapterBanner: string | null;
  muted: boolean;
  parryFlash: boolean;
}
