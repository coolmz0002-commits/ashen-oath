import { useCallback, useMemo, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameModal } from './components/GameModal';
import { GameViewport, type GameControllerHandle } from './components/GameViewport';
import { TitleScreen } from './components/TitleScreen';
import type { ChapterIndex, HudSnapshot } from './game/types';

export default function App() {
  const initialAutostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  const controllerRef = useRef<GameControllerHandle | null>(null);

  const [hud, setHud] = useState<HudSnapshot>({
    screen: initialAutostart ? 'playing' : 'title',
    outcome: null,
    chapter: 0,
    highestChapter: 0,
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    vials: 3,
    maxVials: 4,
    comboCount: 0,
    comboTimer: 0,
    kills: 0,
    executions: 0,
    parries: 0,
    elapsedSeconds: 0,
    lockedTargetName: null,
    lockedTargetHp: 0,
    lockedTargetMaxHp: 1,
    lockedTargetPosture: 0,
    lockedTargetMaxPosture: 1,
    bossActive: false,
    bossName: 'Malakor, Iron Prelate',
    bossHp: 460,
    bossMaxHp: 460,
    bossPosture: 0,
    bossMaxPosture: 150,
    bossPhase: 1,
    canExecuteName: null,
    canInteractTitle: null,
    storyBeat: null,
    chapterBanner: null,
    muted: false,
    parryFlash: false,
  });

  const handleHudUpdate = useCallback((snapshot: HudSnapshot) => {
    setHud(snapshot);
  }, []);

  const handleStart = useCallback((chapter: ChapterIndex = 0) => {
    controllerRef.current?.startCampaign(chapter);
  }, []);

  const handleResume = useCallback(() => {
    controllerRef.current?.resumeGame();
  }, []);

  const handlePause = useCallback(() => {
    controllerRef.current?.pauseGame();
  }, []);

  const handleRestartChapter = useCallback(() => {
    controllerRef.current?.restartChapter();
  }, []);

  const handleReturnToTitle = useCallback(() => {
    controllerRef.current?.returnToTitle();
  }, []);

  const handleToggleMute = useCallback(() => {
    controllerRef.current?.toggleMute();
  }, []);

  const handleToggleLockOn = useCallback(() => {
    controllerRef.current?.toggleLockOn();
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#09080b]">
      <GameViewport
        onHudUpdate={handleHudUpdate}
        controllerRef={controllerRef}
        initialAutostart={initialAutostart}
      />

      {hud.screen === 'title' && (
        <TitleScreen
          highestChapter={hud.highestChapter}
          onStart={handleStart}
        />
      )}

      {hud.screen === 'playing' && (
        <GameHud
          hud={hud}
          onToggleMute={handleToggleMute}
          onToggleLockOn={handleToggleLockOn}
          onPause={handlePause}
        />
      )}

      <GameModal
        hud={hud}
        onResume={handleResume}
        onRestartChapter={handleRestartChapter}
        onPlayAgain={handleRestartChapter}
        onReturnToTitle={handleReturnToTitle}
      />
    </main>
  );
}
