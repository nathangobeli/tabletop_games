// Unified Deck, Card & Shuffling Utility for Tabletop Games

export type StandardSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type StandardRankLabel = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export const STANDARD_SUITS: readonly StandardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'] as const;

export const SUIT_SYMBOLS: Record<StandardSuit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_NAMES: Record<StandardSuit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
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

export interface StandardPlayingCard {
  id: string;
  suit: StandardSuit;
  value: number; // 1 to 13 (1 = Ace, 11 = Jack, 12 = Queen, 13 = King)
  label: string;
  isRed: boolean;
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
export const shuffleDeck = <T>(items: readonly T[] | T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
};

/**
 * Generates a full standard 52-card deck with unique deterministic IDs.
 */
export const createStandard52Deck = (idPrefix = 'card'): StandardPlayingCard[] => {
  const deck: StandardPlayingCard[] = [];
  let index = 1;
  for (let value = 1; value <= 13; value++) {
    for (const suit of STANDARD_SUITS) {
      deck.push({
        id: `${idPrefix}-${index++}-${suit}-${value}`,
        suit,
        value,
        label: STANDARD_RANK_LABELS[value],
        isRed: isRedSuit(suit),
      });
    }
  }
  return deck;
};

/**
 * Deal cards from a deck into specified hand counts.
 * Returns hands array plus remaining undealt cards.
 */
export const dealCards = <T>(deck: T[], counts: number[]): { hands: T[][]; remaining: T[] } => {
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
};
