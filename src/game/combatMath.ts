import type {
  AttackKind,
  AttackPhase,
  ChapterIndex,
  EnemyArchetype,
  EnemySim,
  EnemySpawn,
  PlatformBox,
  PlayerSim,
  RuneGate,
} from './types';

export const GRAVITY = 28.0;
export const PLAYER_RADIUS = 0.48;
export const PLAYER_MOVE_SPEED = 8.4;
export const PLAYER_JUMP_SPEED = 11.4;
export const PLAYER_DOUBLE_JUMP_SPEED = 10.2;
export const PLAYER_DASH_SPEED = 19.5;
export const PLAYER_DASH_DURATION = 0.2;
export const PLAYER_DASH_COOLDOWN = 0.48;
export const COYOTE_TIME = 0.11;
export const JUMP_BUFFER_TIME = 0.12;
export const PARRY_WINDOW = 0.24;
export const PARRY_COOLDOWN = 0.42;

export interface AttackSpec {
  windup: number;
  active: number;
  recovery: number;
  damage: number;
  postureDamage: number;
  range: number;
  arcCos: number; // minimum dot product
  lungeSpeed: number;
  staminaCost: number;
  knockback: number;
  hitstop: number;
  breaksGuard: boolean;
}

export const ATTACK_SPECS: Record<AttackKind, AttackSpec> = {
  light1: {
    windup: 0.08,
    active: 0.14,
    recovery: 0.16,
    damage: 22,
    postureDamage: 18,
    range: 3.1,
    arcCos: 0.15,
    lungeSpeed: 5.5,
    staminaCost: 10,
    knockback: 4.5,
    hitstop: 0.035,
    breaksGuard: false,
  },
  light2: {
    windup: 0.08,
    active: 0.14,
    recovery: 0.16,
    damage: 26,
    postureDamage: 22,
    range: 3.25,
    arcCos: 0.1,
    lungeSpeed: 6.2,
    staminaCost: 10,
    knockback: 5.2,
    hitstop: 0.04,
    breaksGuard: false,
  },
  light3: {
    windup: 0.12,
    active: 0.17,
    recovery: 0.25,
    damage: 38,
    postureDamage: 34,
    range: 3.55,
    arcCos: -0.25, // wide sweeping cleave
    lungeSpeed: 8.0,
    staminaCost: 14,
    knockback: 8.5,
    hitstop: 0.06,
    breaksGuard: false,
  },
  heavy: {
    windup: 0.24,
    active: 0.18,
    recovery: 0.28,
    damage: 52,
    postureDamage: 56,
    range: 3.7,
    arcCos: 0.0,
    lungeSpeed: 7.5,
    staminaCost: 24,
    knockback: 11.0,
    hitstop: 0.08,
    breaksGuard: true,
  },
  execute: {
    windup: 0.15,
    active: 0.2,
    recovery: 0.25,
    damage: 140,
    postureDamage: 100,
    range: 3.6,
    arcCos: -1.0,
    lungeSpeed: 0,
    staminaCost: 0,
    knockback: 12.0,
    hitstop: 0.12,
    breaksGuard: true,
  },
};

export function forwardFromYaw(yaw: number): { x: number; z: number } {
  return {
    x: -Math.sin(yaw),
    z: -Math.cos(yaw),
  };
}

export function yawFromDir(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

export function lerpAngle(current: number, target: number, t: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

export function getAttackPhase(
  kind: AttackKind | null,
  timer: number,
): AttackPhase {
  if (!kind) return 'idle';
  const spec = ATTACK_SPECS[kind];
  if (timer < spec.windup) return 'windup';
  if (timer < spec.windup + spec.active) return 'active';
  if (timer < spec.windup + spec.active + spec.recovery) return 'recovery';
  return 'idle';
}

export function getAttackDuration(kind: AttackKind): number {
  const s = ATTACK_SPECS[kind];
  return s.windup + s.active + s.recovery;
}

export function isPointOverPlatform(
  x: number,
  z: number,
  radius: number,
  p: PlatformBox,
): boolean {
  const halfW = p.width * 0.5 + radius * 0.72;
  const halfD = p.depth * 0.5 + radius * 0.72;
  return Math.abs(x - p.x) <= halfW && Math.abs(z - p.z) <= halfD;
}

export function resolveActorPlatforms(
  x: number,
  y: number,
  z: number,
  prevY: number,
  vy: number,
  radius: number,
  platforms: PlatformBox[],
  closedGates: RuneGate[],
): {
  x: number;
  y: number;
  z: number;
  vy: number;
  grounded: boolean;
  landedPlatform: PlatformBox | null;
} {
  let outX = x;
  let outY = y;
  let outZ = z;
  let outVy = vy;
  let grounded = false;
  let landedPlatform: PlatformBox | null = null;

  // Check closed rune gates as solid barriers
  for (const gate of closedGates) {
    const halfW = gate.width * 0.5 + radius;
    const gateThickness = 0.8 + radius;
    if (
      Math.abs(outX - gate.x) < halfW &&
      Math.abs(outZ - gate.z) < gateThickness &&
      outY >= gate.y - 1 &&
      outY <= gate.y + gate.height
    ) {
      if (outZ < gate.z) {
        outZ = gate.z - gateThickness;
      } else {
        outZ = gate.z + gateThickness;
      }
    }
  }

  // Landing on top of platforms
  let bestTop = -Infinity;
  for (const p of platforms) {
    if (!isPointOverPlatform(outX, outZ, radius, p)) continue;
    const topY = p.y;
    const stepTolerance = 0.36;
    const wasAboveOrNear = prevY >= topY - stepTolerance;
    const nowAtOrBelow = outY <= topY + 0.08;
    if (wasAboveOrNear && nowAtOrBelow && outVy <= 0.5 && topY > bestTop) {
      bestTop = topY;
      landedPlatform = p;
    }
  }

  if (landedPlatform) {
    outY = landedPlatform.y;
    outVy = 0;
    grounded = true;
  } else {
    // Horizontal side-wall push-out if below platform top surface
    for (const p of platforms) {
      const topY = p.y;
      const bottomY = p.y - p.height;
      if (outY < topY - 0.36 && outY + 1.6 > bottomY) {
        const halfW = p.width * 0.5 + radius;
        const halfD = p.depth * 0.5 + radius;
        const dx = outX - p.x;
        const dz = outZ - p.z;
        if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
          const penX = halfW - Math.abs(dx);
          const penZ = halfD - Math.abs(dz);
          if (penX < penZ) {
            outX += dx >= 0 ? penX : -penX;
          } else {
            outZ += dz >= 0 ? penZ : -penZ;
          }
        }
      }
    }
  }

  return {
    x: outX,
    y: outY,
    z: outZ,
    vy: outVy,
    grounded,
    landedPlatform,
  };
}

export function createEnemyFromSpawn(spawn: EnemySpawn): EnemySim {
  const stats: Record<
    EnemyArchetype,
    { name: string; hp: number; posture: number; radius: number; height: number }
  > = {
    thrall: {
      name: 'Ashbound Thrall',
      hp: 68,
      posture: 45,
      radius: 0.48,
      height: 1.75,
    },
    halberdier: {
      name: 'Ironclad Halberdier',
      hp: 135,
      posture: 85,
      radius: 0.65,
      height: 2.15,
    },
    acolyte: {
      name: 'Cinder Acolyte',
      hp: 80,
      posture: 40,
      radius: 0.5,
      height: 1.95,
    },
    boss: {
      name: 'Malakor, Iron Prelate',
      hp: 460,
      posture: 150,
      radius: 1.05,
      height: 3.1,
    },
  };

  const s = stats[spawn.archetype];
  return {
    id: spawn.id,
    archetype: spawn.archetype,
    chapter: spawn.chapter,
    name: s.name,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: spawn.facingYaw,
    hp: s.hp,
    maxHp: s.hp,
    posture: 0,
    maxPosture: s.posture,
    radius: s.radius,
    height: s.height,
    state: 'idle',
    stateTimer: 0,
    attackCooldown: 0.8,
    hitFlashTimer: 0,
    koTimer: 0,
    grounded: true,
    walkDistance: 0,
    squashX: 1,
    squashY: 1,
    phase: 1,
    attackPattern: 0,
    homeX: spawn.x,
    homeY: spawn.y,
    homeZ: spawn.z,
    hasBlockedRecently: 0,
  };
}

export function isEnemyExecutable(enemy: EnemySim): boolean {
  if (enemy.state === 'ko' || enemy.hp <= 0) return false;
  if (enemy.state === 'staggered') return true;
  return enemy.archetype !== 'boss' && enemy.hp <= enemy.maxHp * 0.25 && enemy.posture >= enemy.maxPosture * 0.65;
}

export function evaluateMeleeHitOnEnemy(
  player: PlayerSim,
  enemy: EnemySim,
  spec: AttackSpec,
): {
  inReach: boolean;
  blockedByShield: boolean;
  damageDealt: number;
  postureDealt: number;
  triggeredStagger: boolean;
  triggeredKo: boolean;
} {
  if (enemy.state === 'ko' || enemy.hp <= 0) {
    return {
      inReach: false,
      blockedByShield: false,
      damageDealt: 0,
      postureDealt: 0,
      triggeredStagger: false,
      triggeredKo: false,
    };
  }

  const dx = enemy.x - player.x;
  const dz = enemy.z - player.z;
  const dy = Math.abs(enemy.y - player.y);
  const dist = Math.hypot(dx, dz);

  if (dist > spec.range + enemy.radius || dy > 2.4) {
    return {
      inReach: false,
      blockedByShield: false,
      damageDealt: 0,
      postureDealt: 0,
      triggeredStagger: false,
      triggeredKo: false,
    };
  }

  const fwd = forwardFromYaw(player.yaw);
  const dirX = dist > 0.001 ? dx / dist : fwd.x;
  const dirZ = dist > 0.001 ? dz / dist : fwd.z;
  const dot = fwd.x * dirX + fwd.z * dirZ;

  if (dist > 0.9 && dot < spec.arcCos) {
    return {
      inReach: false,
      blockedByShield: false,
      damageDealt: 0,
      postureDealt: 0,
      triggeredStagger: false,
      triggeredKo: false,
    };
  }

  // Check Halberdier front shield block
  let blockedByShield = false;
  if (
    enemy.archetype === 'halberdier' &&
    enemy.state !== 'staggered' &&
    enemy.state !== 'recover' &&
    !spec.breaksGuard
  ) {
    const enemyFwd = forwardFromYaw(enemy.yaw);
    const toPlayerX = -dirX;
    const toPlayerZ = -dirZ;
    const facingDot = enemyFwd.x * toPlayerX + enemyFwd.z * toPlayerZ;
    if (facingDot > 0.25) {
      blockedByShield = true;
    }
  }

  if (blockedByShield) {
    const chipDamage = Math.round(spec.damage * 0.15);
    const chipPosture = Math.round(spec.postureDamage * 0.45);
    const nextPosture = Math.min(enemy.maxPosture, enemy.posture + chipPosture);
    const triggeredStagger = nextPosture >= enemy.maxPosture;
    const nextHp = Math.max(0, enemy.hp - chipDamage);
    return {
      inReach: true,
      blockedByShield: true,
      damageDealt: chipDamage,
      postureDealt: chipPosture,
      triggeredStagger,
      triggeredKo: nextHp <= 0,
    };
  }

  const staggerMultiplier = enemy.state === 'staggered' ? 1.5 : 1.0;
  const damageDealt = Math.round(spec.damage * staggerMultiplier);
  const postureDealt = spec.postureDamage;
  const nextHp = Math.max(0, enemy.hp - damageDealt);
  const nextPosture = enemy.posture + postureDealt;
  const triggeredStagger =
    nextHp > 0 && enemy.state !== 'staggered' && nextPosture >= enemy.maxPosture;

  return {
    inReach: true,
    blockedByShield: false,
    damageDealt,
    postureDealt,
    triggeredStagger,
    triggeredKo: nextHp <= 0,
  };
}

export function resolveIncomingPlayerHit(
  player: PlayerSim,
  attacker: EnemySim,
  rawDamage: number,
): {
  outcome: 'invuln' | 'parried' | 'hurt';
  damageTaken: number;
  attackerPostureDamage: number;
  attackerStaggered: boolean;
} {
  if (player.invulnTimer > 0 || player.dashTimer > 0 || player.executingTargetId) {
    return {
      outcome: 'invuln',
      damageTaken: 0,
      attackerPostureDamage: 0,
      attackerStaggered: false,
    };
  }

  if (player.parryTimer > 0) {
    const postureDmg = attacker.archetype === 'boss' ? 60 : 90;
    const nextPosture = attacker.posture + postureDmg;
    return {
      outcome: 'parried',
      damageTaken: 0,
      attackerPostureDamage: postureDmg,
      attackerStaggered: nextPosture >= attacker.maxPosture,
    };
  }

  return {
    outcome: 'hurt',
    damageTaken: rawDamage,
    attackerPostureDamage: 0,
    attackerStaggered: false,
  };
}

export function isGateOpen(
  gate: RuneGate,
  enemies: EnemySim[],
): boolean {
  for (const e of enemies) {
    if (e.chapter === gate.chapter && e.hp > 0 && e.state !== 'ko') {
      return false;
    }
  }
  return true;
}

export function getClosedGates(
  gates: RuneGate[],
  enemies: EnemySim[],
): RuneGate[] {
  return gates.filter((g) => !isGateOpen(g, enemies));
}

export function findBestExecutionTarget(
  player: PlayerSim,
  enemies: EnemySim[],
): EnemySim | null {
  let best: EnemySim | null = null;
  let bestDist = 3.2;
  for (const e of enemies) {
    if (!isEnemyExecutable(e)) continue;
    const d = Math.hypot(e.x - player.x, e.z - player.z);
    if (d <= bestDist && Math.abs(e.y - player.y) <= 1.8) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

export function countActiveChapterAttackers(
  enemies: EnemySim[],
  chapter: ChapterIndex,
): number {
  let count = 0;
  for (const e of enemies) {
    if (
      e.chapter === chapter &&
      e.state !== 'ko' &&
      (e.state === 'windup' || e.state === 'attack')
    ) {
      count++;
    }
  }
  return count;
}

export function createInitialPlayer(spawnPos: [number, number, number], yaw: number): PlayerSim {
  return {
    x: spawnPos[0],
    y: spawnPos[1],
    z: spawnPos[2],
    vx: 0,
    vy: 0,
    vz: 0,
    yaw,
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    vials: 3,
    maxVials: 4,
    grounded: true,
    coyoteTimer: COYOTE_TIME,
    jumpBufferTimer: 0,
    jumpsRemaining: 2,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 0,
    dashDirZ: -1,
    invulnTimer: 0,
    parryTimer: 0,
    parryCooldown: 0,
    attackKind: null,
    attackTimer: 0,
    attackHitIds: new Set<string>(),
    comboQueue: false,
    hitFlashTimer: 0,
    healFlashTimer: 0,
    safeX: spawnPos[0],
    safeY: spawnPos[1],
    safeZ: spawnPos[2],
    walkDistance: 0,
    squashX: 1,
    squashY: 1,
    executingTargetId: null,
    executeTimer: 0,
  };
}
