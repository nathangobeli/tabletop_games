// Persistent Per-Game Statistics & Mid-Match Auto-Save Engine
// Zero external dependencies; safe for SSR and private browsing modes.

export interface GameRecord {
  winsP1: number;
  winsP2: number;
  draws: number;
  gamesPlayed: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayedAt: number;
}

const STATS_STORAGE_KEY = 'tabletop_per_game_stats_v1';
const MATCH_SAVE_PREFIX = 'tabletop_match_save_v1_';

const DEFAULT_RECORD: GameRecord = {
  winsP1: 0,
  winsP2: 0,
  draws: 0,
  gamesPlayed: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastPlayedAt: 0,
};

export const getAllGameStats = (): Record<string, GameRecord> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const getGameStats = (gameId: string): GameRecord => {
  const all = getAllGameStats();
  return all[gameId] ? { ...DEFAULT_RECORD, ...all[gameId] } : { ...DEFAULT_RECORD };
};

export const recordGameResult = (
  gameId: string,
  winner: 1 | 2 | 'draw'
): GameRecord => {
  const all = getAllGameStats();
  const prev = all[gameId] ? { ...DEFAULT_RECORD, ...all[gameId] } : { ...DEFAULT_RECORD };

  const winsP1 = prev.winsP1 + (winner === 1 ? 1 : 0);
  const winsP2 = prev.winsP2 + (winner === 2 ? 1 : 0);
  const draws = prev.draws + (winner === 'draw' ? 1 : 0);
  const gamesPlayed = prev.gamesPlayed + 1;
  const currentStreak = winner === 1 ? prev.currentStreak + 1 : 0;
  const bestStreak = Math.max(prev.bestStreak, currentStreak);

  const updated: GameRecord = {
    winsP1,
    winsP2,
    draws,
    gamesPlayed,
    currentStreak,
    bestStreak,
    lastPlayedAt: Date.now(),
  };

  all[gameId] = updated;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Ignore storage quota errors
    }
  }
  return updated;
};

// ============================================================================
// MID-MATCH AUTO-SAVE & RESUME HELPERS
// ============================================================================

export const saveMatchState = <T>(gameId: string, state: T): void => {
  if (typeof window === 'undefined' || !gameId) return;
  try {
    localStorage.setItem(
      `${MATCH_SAVE_PREFIX}${gameId}`,
      JSON.stringify({ savedAt: Date.now(), state })
    );
  } catch {
    // Ignore storage errors
  }
};

export const loadMatchState = <T>(gameId: string): T | null => {
  if (typeof window === 'undefined' || !gameId) return null;
  try {
    const raw = localStorage.getItem(`${MATCH_SAVE_PREFIX}${gameId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.state ? (parsed.state as T) : null;
  } catch {
    return null;
  }
};

export const clearMatchState = (gameId: string): void => {
  if (typeof window === 'undefined' || !gameId) return;
  try {
    localStorage.removeItem(`${MATCH_SAVE_PREFIX}${gameId}`);
  } catch {
    // Ignore storage errors
  }
};

export const hasSavedMatch = (gameId: string): boolean => {
  if (typeof window === 'undefined' || !gameId) return false;
  try {
    return localStorage.getItem(`${MATCH_SAVE_PREFIX}${gameId}`) !== null;
  } catch {
    return false;
  }
};
