import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { GameId, PlayerNumber, GameStatus, GameSettings, GameContextValue, TableTheme } from '../types/game';

const GameContext = createContext<GameContextValue | null>(null);

export interface GameProviderProps {
  children: React.ReactNode;
}

const getStoredTheme = (): TableTheme => {
  if (typeof window === 'undefined') return 'wood';
  const saved = localStorage.getItem('tabletop_theme');
  if (saved === 'wood' || saved === 'midnight' || saved === 'emerald' || saved === 'arcade') {
    return saved;
  }
  return 'wood';
};

const getInitialGame = (): GameId | null => {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const g = params.get('game') as GameId | null;
    return g || null;
  } catch {
    return null;
  }
};

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [activeGame, setActiveGame] = useState<GameId | null>(getInitialGame);
  const [currentPlayer, setCurrentPlayer] = useState<PlayerNumber>(1);
  const [gameStatus, setGameStatus] = useState<GameStatus>('lobby');
  const [theme, setThemeState] = useState<TableTheme>(getStoredTheme);
  const [gameMode, setGameModeState] = useState<GameMode>('pvp');
  const [isCpuThinking, setIsCpuThinking] = useState<boolean>(false);
  const [settings, setSettings] = useState<GameSettings>({
    haptics: true,
    theme: getStoredTheme(),
  });

  const triggerHaptic = useCallback((pattern: number | number[] = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Silently ignore browsers blocking vibrations without user interaction
      }
    }
  }, []);

  const setTheme = useCallback((newTheme: TableTheme) => {
    setThemeState(newTheme);
    setSettings((prev) => ({ ...prev, theme: newTheme }));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tabletop_theme', newTheme);
      } catch {}
    }
    triggerHaptic(20);
  }, [triggerHaptic]);

  const startGame = useCallback((gameId: GameId) => {
    setActiveGame(gameId);
    setCurrentPlayer(1);
    setGameStatus('active');
    triggerHaptic(25);
  }, [triggerHaptic]);

  const resetToMenu = useCallback(() => {
    setActiveGame(null);
    setCurrentPlayer(1);
    setGameStatus('lobby');
    setIsCpuThinking(false);
    triggerHaptic(15);
  }, [triggerHaptic]);

  const setGameMode = useCallback((mode: GameMode) => {
    setGameModeState(mode);
    setIsCpuThinking(false);
    triggerHaptic(20);
  }, [triggerHaptic]);

  const togglePlayerTurn = useCallback(() => {
    setCurrentPlayer((prev) => (prev === 1 ? 2 : 1));
    triggerHaptic(20);
  }, [triggerHaptic]);

  const acknowledgeTurn = useCallback(() => {
    setGameStatus('active');
    triggerHaptic(15);
  }, [triggerHaptic]);

  const toggleHaptics = useCallback(() => {
    setSettings((prev) => {
      const next = !prev.haptics;
      if (next) triggerHaptic([10, 30, 10]);
      return { ...prev, haptics: next };
    });
  }, [triggerHaptic]);

  const value = useMemo<GameContextValue>(() => ({
    activeGame,
    currentPlayer,
    gameStatus,
    settings,
    theme,
    gameMode,
    isCpuThinking,
    setGameMode,
    setIsCpuThinking,
    setTheme,
    startGame,
    resetToMenu,
    togglePlayerTurn,
    acknowledgeTurn,
    setGameStatus,
    toggleHaptics,
  }), [
    activeGame,
    currentPlayer,
    gameStatus,
    settings,
    theme,
    gameMode,
    isCpuThinking,
    setGameMode,
    setIsCpuThinking,
    setTheme,
    startGame,
    resetToMenu,
    togglePlayerTurn,
    acknowledgeTurn,
    toggleHaptics,
  ]);

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextValue => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
