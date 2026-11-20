import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTACK_SPECS,
  createEnemyFromSpawn,
  createInitialPlayer,
  evaluateMeleeHitOnEnemy,
  findBestExecutionTarget,
  forwardFromYaw,
  getAttackPhase,
  isGateOpen,
  resolveActorPlatforms,
  resolveIncomingPlayerHit,
  yawFromDir,
} from './combatMath';
import { ENEMY_SPAWNS, PLATFORMS, RUNE_GATES } from './levelData';

test('forwardFromYaw and yawFromDir are inverses along cardinal directions', () => {
  const fwd = forwardFromYaw(0);
  assert.ok(Math.abs(fwd.x) < 1e-6);
  assert.ok(Math.abs(fwd.z + 1) < 1e-6);

  const yawWest = yawFromDir(-1, 0);
  const fwdWest = forwardFromYaw(yawWest);
  assert.ok(Math.abs(fwdWest.x + 1) < 1e-6);
  assert.ok(Math.abs(fwdWest.z) < 1e-6);
});

test('resolveActorPlatforms lands player cleanly on terrace and blocks at closed gate', () => {
  const enemies = ENEMY_SPAWNS.map(createEnemyFromSpawn);
  const closedGate = RUNE_GATES[0];

  const landing = resolveActorPlatforms(0, -0.05, 8, 0.2, -5, 0.48, PLATFORMS, [closedGate]);
  assert.equal(landing.grounded, true);
  assert.equal(landing.y, 0);
  assert.equal(landing.vy, 0);

  // Trying to cross closed gate z=-36.5 from south (+z) pushes back south
  const blocked = resolveActorPlatforms(0, 0, -36.1, 0, 0, 0.48, PLATFORMS, [closedGate]);
  assert.ok(blocked.z >= -36.5 + 0.8);

  // Slaying all Chapter I enemies opens Gate I
  for (const e of enemies) {
    if (e.chapter === 0) {
      e.hp = 0;
      e.state = 'ko';
    }
  }
  assert.equal(isGateOpen(closedGate, enemies), true);
});

test('getAttackPhase transitions smoothly across windup -> active -> recovery -> idle', () => {
  assert.equal(getAttackPhase(null, 0), 'idle');
  assert.equal(getAttackPhase('light1', 0.02), 'windup');
  assert.equal(getAttackPhase('light1', 0.12), 'active');
  assert.equal(getAttackPhase('light1', 0.28), 'recovery');
  assert.equal(getAttackPhase('light1', 0.5), 'idle');
});

test('Halberdier blocks frontal light attack but breaks guard on heavy cleave', () => {
  const player = createInitialPlayer([0, 0, 0], 0); // facing -Z
  const halberdierSpawn = ENEMY_SPAWNS.find((s) => s.archetype === 'halberdier')!;
  const halberdier = createEnemyFromSpawn(halberdierSpawn);
  halberdier.x = 0;
  halberdier.y = 0;
  halberdier.z = -2.2;
  halberdier.yaw = Math.PI; // facing +Z directly at player

  const lightHit = evaluateMeleeHitOnEnemy(player, halberdier, ATTACK_SPECS.light1);
  assert.equal(lightHit.inReach, true);
  assert.equal(lightHit.blockedByShield, true);
  assert.ok(lightHit.damageDealt < ATTACK_SPECS.light1.damage);

  const heavyHit = evaluateMeleeHitOnEnemy(player, halberdier, ATTACK_SPECS.heavy);
  assert.equal(heavyHit.inReach, true);
  assert.equal(heavyHit.blockedByShield, false);
  assert.equal(heavyHit.damageDealt, ATTACK_SPECS.heavy.damage);
});

test('Parry negates damage and inflicts massive posture damage to stagger enemy for execution', () => {
  const player = createInitialPlayer([0, 0, 0], 0);
  const thrall = createEnemyFromSpawn(ENEMY_SPAWNS[0]);
  thrall.x = 0;
  thrall.y = 0;
  thrall.z = -1.8;

  player.parryTimer = 0.2;
  const parryResult = resolveIncomingPlayerHit(player, thrall, 22);
  assert.equal(parryResult.outcome, 'parried');
  assert.equal(parryResult.damageTaken, 0);
  assert.equal(parryResult.attackerStaggered, true);

  thrall.posture = thrall.maxPosture;
  thrall.state = 'staggered';
  const execTarget = findBestExecutionTarget(player, [thrall]);
  assert.equal(execTarget?.id, thrall.id);
});
