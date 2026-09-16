import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { GameId, PlayerNumber, GameStatus, GameSettings, GameContextValue } from '../types/game';

const GameContext = createContext<GameContextValue | null>(null);

export interface GameProviderProps {
  children: React.ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<PlayerNumber>(1);
  const [gameStatus, setGameStatus] = useState<GameStatus>('lobby');
  const [settings, setSettings] = useState<GameSettings>({
    haptics: true,
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
    triggerHaptic(15);
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
