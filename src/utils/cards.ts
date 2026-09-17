// Universal Card, Deck, Shuffling & Dealing Engine for Tabletop Games

export type CardSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs' | 'joker';
export type StandardRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export type StandardRankLabel = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export const STANDARD_SUITS: readonly CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'] as const;

export const SUIT_SYMBOLS: Record<CardSuit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  joker: '🃏',
};

export const SUIT_NAMES: Record<CardSuit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
  joker: 'Joker',
};

export const STANDARD_RANK_LABELS: Record<number, StandardRankLabel> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

export interface PlayingCard {
  id: string;
  suit: CardSuit;
  value: number; // Numeric evaluation value (e.g. 1..13 or custom)
  rankLabel: string; // 'A', '2'..'10', 'J', 'Q', 'K', 'JOKER'
  isRed: boolean;
  isJoker?: boolean;
}

/**
 * Returns true if the suit is red (hearts or diamonds).
 */
export const isRedSuit = (suit: string): boolean => {
  return suit === 'hearts' || suit === 'diamonds';
};

/**
 * Unbiased Fisher-Yates shuffle algorithm.
 * Returns a new shuffled copy of the input array without mutating original.
 */
export function shuffleDeck<T>(items: readonly T[] | T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export const shuffleCards = shuffleDeck;

export interface CreateDeckOptions {
  idPrefix?: string;
  includeJokers?: boolean;
  jokerCount?: number;
  customRankOrder?: Record<number, number>; // Maps standard value to game-specific evaluation value
}

/**
 * Generates a full standard playing card deck (52 cards, plus optional Jokers).
 */
export const createStandardDeck = (options: CreateDeckOptions = {}): PlayingCard[] => {
  const {
    idPrefix = 'card',
    includeJokers = false,
    jokerCount = 2,
    customRankOrder,
  } = options;

  const deck: PlayingCard[] = [];
  let index = 1;

  for (let rank = 1; rank <= 13; rank++) {
    for (const suit of STANDARD_SUITS) {
      const evalValue = customRankOrder && customRankOrder[rank] !== undefined
        ? customRankOrder[rank]
        : rank;

      deck.push({
        id: `${idPrefix}-${index++}-${suit}-${rank}`,
        suit,
        value: evalValue,
        rankLabel: STANDARD_RANK_LABELS[rank],
        isRed: isRedSuit(suit),
        isJoker: false,
      });
    }
  }

  if (includeJokers) {
    for (let j = 1; j <= jokerCount; j++) {
      deck.push({
        id: `${idPrefix}-joker-${j}`,
        suit: 'joker',
        value: 99,
        rankLabel: '★',
        isRed: false,
        isJoker: true,
      });
    }
  }

  return deck;
};

/**
 * Partitions a deck into designated hand quantities and remaining stockpile.
 */
export function dealCards<T>(deck: T[], counts: number[]): { hands: T[][]; remaining: T[] } {
  const hands: T[][] = [];
  let cursor = 0;

  for (const count of counts) {
    hands.push(deck.slice(cursor, cursor + count));
    cursor += count;
  }

  return {
    hands,
    remaining: deck.slice(cursor),
  };
}

/**
 * Sorts an array of cards by value (ascending or descending).
 */
export function sortCards<T extends { value: number; suit: string }>(
  cards: T[],
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...cards].sort((a, b) => {
    if (a.value !== b.value) {
      return direction === 'asc' ? a.value - b.value : b.value - a.value;
    }
    return a.suit.localeCompare(b.suit);
  });
}
