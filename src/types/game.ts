export type GameId = 
  | 'mancala' 
  | 'dots-and-boxes' 
  | 'speed' 
  | 'yacht-dice' 
  | 'renegade' 
  | 'connect-four'
  | 'air-hockey'
  | 'toy-tennis'
  | 'carrom'
  | 'gomoku'
  | 'checkers'
  | 'backgammon'
  | 'billiards'
  | 'darts'
  | 'bowling'
  | 'mini-shogi'
  | 'toy-curling'
  | 'hex'
  | 'matching'
  | 'nine-mens-morris'
  | 'hare-and-hounds'
  | 'hit-and-blow'
  | 'hanafuda'
  | 'president'
  | 'last-card'
  | 'riichi-mahjong';

export type PlayerNumber = 1 | 2;

export type GameStatus = 'lobby' | 'active' | 'awaiting_ack' | 'finished';

export type TableTheme = 'wood' | 'midnight' | 'emerald' | 'arcade';

export interface GameSettings {
  haptics: boolean;
  theme: TableTheme;
}

export type GameMode = 'pvp' | 'pve';

export interface GameMetadata {
  id: GameId;
  name: string;
  category: string;
  description: string;
  accentColor: string;
}

export interface GameContextValue {
  activeGame: GameId | null;
  currentPlayer: PlayerNumber;
  gameStatus: GameStatus;
  settings: GameSettings;
  theme: TableTheme;
  gameMode: GameMode;
  isCpuThinking: boolean;
  setGameMode: (mode: GameMode) => void;
  setIsCpuThinking: (thinking: boolean) => void;
  setTheme: (theme: TableTheme) => void;
  startGame: (gameId: GameId) => void;
  resetToMenu: () => void;
  togglePlayerTurn: () => void;
  acknowledgeTurn: () => void;
  setGameStatus: (status: GameStatus) => void;
  toggleHaptics: () => void;
}

