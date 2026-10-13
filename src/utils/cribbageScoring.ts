// Pure TypeScript Cribbage Rules, Scoring & Pegging Engine
// Zero external dependencies

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13; // 1=A, 11=J, 12=Q, 13=K

export interface CribbageCard {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number; // A=1, 2..9, 10..K=10
  rankLabel: string; // 'A', '2'..'10', 'J', 'Q', 'K'
  isRed: boolean;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_NAMES: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
};

export const RANK_LABELS: Record<Rank, string> = {
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

export const getCribbageValue = (rank: Rank): number => {
  if (rank >= 10) return 10;
  return rank;
};

export const createCard = (suit: Suit, rank: Rank, copyId = ''): CribbageCard => {
  return {
    id: `${suit}-${rank}${copyId ? `-${copyId}` : ''}`,
    suit,
    rank,
    value: getCribbageValue(rank),
    rankLabel: RANK_LABELS[rank],
    isRed: suit === 'hearts' || suit === 'diamonds',
  };
};

export const createStandardDeck = (): CribbageCard[] => {
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const deck: CribbageCard[] = [];
  for (const suit of suits) {
    for (let r = 1; r <= 13; r++) {
      deck.push(createCard(suit, r as Rank));
    }
  }
  return deck;
};

export const shuffleDeck = <T>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// ============================================================================
// 1. PEGGING EVALUATION (The Play to 31)
// ============================================================================

export interface PeggingScoreDetail {
  points: number;
  reason: 'fifteen' | 'thirty_one' | 'pair' | 'three_of_a_kind' | 'four_of_a_kind' | 'run' | 'go' | 'last_card';
  description: string;
}

export interface PeggingPlayResult {
  totalPoints: number;
  details: PeggingScoreDetail[];
  newRunningTotal: number;
  isThirtyOne: boolean;
}

/**
 * Evaluates points earned by playing a card into the current pegging sequence.
 * @param currentSequence List of cards played in the current cycle (running count <= 31)
 * @param playedCard The card just placed
 */
export const evaluatePeggingPlay = (
  currentSequence: CribbageCard[],
  playedCard: CribbageCard
): PeggingPlayResult => {
  const sequence = [...currentSequence, playedCard];
  const newRunningTotal = sequence.reduce((sum, c) => sum + c.value, 0);

  const details: PeggingScoreDetail[] = [];
  let totalPoints = 0;

  // 1. Check for 15
  if (newRunningTotal === 15) {
    details.push({
      points: 2,
      reason: 'fifteen',
      description: 'Fifteen for Two (+2)',
    });
    totalPoints += 2;
  }

  // 2. Check for 31
  const isThirtyOne = newRunningTotal === 31;
  if (isThirtyOne) {
    details.push({
      points: 2,
      reason: 'thirty_one',
      description: 'Thirty-One for Two (+2)',
    });
    totalPoints += 2;
  }

  // 3. Check for Pairs (same rank, checking backward)
  const len = sequence.length;
  if (len >= 2 && sequence[len - 1].rank === sequence[len - 2].rank) {
    if (len >= 3 && sequence[len - 1].rank === sequence[len - 3].rank) {
      if (len >= 4 && sequence[len - 1].rank === sequence[len - 4].rank) {
        // Four of a kind (Double Pair Royal)
        details.push({
          points: 12,
          reason: 'four_of_a_kind',
          description: `Four of a Kind (${playedCard.rankLabel}s) (+12)`,
        });
        totalPoints += 12;
      } else {
        // Three of a kind (Pair Royal)
        details.push({
          points: 6,
          reason: 'three_of_a_kind',
          description: `Three of a Kind (${playedCard.rankLabel}s) (+6)`,
        });
        totalPoints += 6;
      }
    } else {
      // Pair
      details.push({
        points: 2,
        reason: 'pair',
        description: `Pair of ${playedCard.rankLabel}s (+2)`,
      });
      totalPoints += 2;
    }
  }

  // 4. Check for Runs (consecutive ranks in any order, max length possible)
  // Only check runs if no pair was just scored (pairs break runs)
  if (details.every((d) => d.reason !== 'pair' && d.reason !== 'three_of_a_kind' && d.reason !== 'four_of_a_kind')) {
    let longestRun = 0;
    for (let k = Math.min(len, 7); k >= 3; k--) {
      const slice = sequence.slice(len - k);
      const ranks = slice.map((c) => c.rank).sort((a, b) => a - b);

      let isRun = true;
      for (let i = 0; i < ranks.length - 1; i++) {
        if (ranks[i + 1] !== ranks[i] + 1) {
          isRun = false;
          break;
        }
      }

      if (isRun) {
        longestRun = k;
        break; // Found longest run
      }
    }

    if (longestRun >= 3) {
      details.push({
        points: longestRun,
        reason: 'run',
        description: `Run of ${longestRun} (+${longestRun})`,
      });
      totalPoints += longestRun;
    }
  }

  return {
    totalPoints,
    details,
    newRunningTotal,
    isThirtyOne,
  };
};

export const getLegalPeggingCards = (
  hand: CribbageCard[],
  currentCount: number
): CribbageCard[] => {
  return hand.filter((c) => currentCount + c.value <= 31);
};

export const canPlayerPeg = (
  hand: CribbageCard[],
  currentCount: number
): boolean => {
  return hand.some((c) => currentCount + c.value <= 31);
};

// ============================================================================
// 2. THE SHOW (Hand & Crib Counting)
// ============================================================================

export interface ScoreItem {
  category: '15s' | 'pairs' | 'runs' | 'flush' | 'nobs';
  points: number;
  cards: CribbageCard[];
  description: string;
}

export interface CribbageHandScore {
  total: number;
  fifteens: ScoreItem[];
  pairs: ScoreItem[];
  runs: ScoreItem[];
  flush: ScoreItem | null;
  nobs: ScoreItem | null;
  items: ScoreItem[];
}

/**
 * Helper to compute all non-empty subsets of an array
 */
const getSubsets = <T>(array: T[]): T[][] => {
  const result: T[][] = [];
  const total = 1 << array.length;
  for (let mask = 1; mask < total; mask++) {
    const subset: T[] = [];
    for (let i = 0; i < array.length; i++) {
      if ((mask & (1 << i)) !== 0) {
        subset.push(array[i]);
      }
    }
    result.push(subset);
  }
  return result;
};

/**
 * Scores a 4-card Cribbage hand (or crib) against the 1-card starter cut card.
 * @param hand 4 cards in hand or crib
 * @param starter 1 starter cut card
 * @param isCrib True if evaluating dealer's Crib (requires 5-card flush)
 */
export const scoreHand = (
  hand: CribbageCard[],
  starter: CribbageCard,
  isCrib = false
): CribbageHandScore => {
  const allCards = [...hand, starter];
  const items: ScoreItem[] = [];

  // 1. Fifteens (all combinations summing to 15)
  const fifteens: ScoreItem[] = [];
  const subsets = getSubsets(allCards);

  for (const subset of subsets) {
    const sum = subset.reduce((acc, c) => acc + c.value, 0);
    if (sum === 15) {
      const desc = `Fifteen (${subset.map((c) => `${c.rankLabel}${SUIT_SYMBOLS[c.suit]}`).join(', ')})`;
      const item: ScoreItem = {
        category: '15s',
        points: 2,
        cards: subset,
        description: desc,
      };
      fifteens.push(item);
      items.push(item);
    }
  }

  // 2. Pairs (all 2-card combinations of identical ranks)
  const pairs: ScoreItem[] = [];
  for (let i = 0; i < allCards.length; i++) {
    for (let j = i + 1; j < allCards.length; j++) {
      if (allCards[i].rank === allCards[j].rank) {
        const item: ScoreItem = {
          category: 'pairs',
          points: 2,
          cards: [allCards[i], allCards[j]],
          description: `Pair of ${allCards[i].rankLabel}s (${allCards[i].rankLabel}${SUIT_SYMBOLS[allCards[i].suit]}, ${allCards[j].rankLabel}${SUIT_SYMBOLS[allCards[j].suit]})`,
        };
        pairs.push(item);
        items.push(item);
      }
    }
  }

  // 3. Runs (consecutive rank sequences)
  const runs: ScoreItem[] = [];
  // Find longest run length: 5, then 4, then 3
  const checkRunOfLength = (length: number): ScoreItem[] => {
    const foundRuns: ScoreItem[] = [];
    // Subsets of this length
    const lengthSubsets = subsets.filter((s) => s.length === length);

    for (const subset of lengthSubsets) {
      const sorted = [...subset].sort((a, b) => a.rank - b.rank);
      let isConsecutive = true;
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1].rank !== sorted[i].rank + 1) {
          isConsecutive = false;
          break;
        }
      }

      if (isConsecutive) {
        foundRuns.push({
          category: 'runs',
          points: length,
          cards: sorted,
          description: `Run of ${length} (${sorted.map((c) => `${c.rankLabel}${SUIT_SYMBOLS[c.suit]}`).join('-')})`,
        });
      }
    }
    return foundRuns;
  };

  const runsOf5 = checkRunOfLength(5);
  if (runsOf5.length > 0) {
    runs.push(...runsOf5);
    items.push(...runsOf5);
  } else {
    const runsOf4 = checkRunOfLength(4);
    if (runsOf4.length > 0) {
      runs.push(...runsOf4);
      items.push(...runsOf4);
    } else {
      const runsOf3 = checkRunOfLength(3);
      if (runsOf3.length > 0) {
        runs.push(...runsOf3);
        items.push(...runsOf3);
      }
    }
  }

  // 4. Flush
  let flush: ScoreItem | null = null;
  const handSuitsMatch = hand.every((c) => c.suit === hand[0].suit);

  if (isCrib) {
    // In Crib: all 5 cards must match suit
    if (handSuitsMatch && starter.suit === hand[0].suit) {
      flush = {
        category: 'flush',
        points: 5,
        cards: allCards,
        description: `5-Card Crib Flush in ${SUIT_NAMES[hand[0].suit]}`,
      };
      items.push(flush);
    }
  } else {
    // In Hand: 4 cards in hand match = 4 pts. 5 cards with cut = 5 pts.
    if (handSuitsMatch) {
      const is5Card = starter.suit === hand[0].suit;
      flush = {
        category: 'flush',
        points: is5Card ? 5 : 4,
        cards: is5Card ? allCards : hand,
        description: `${is5Card ? '5-Card' : '4-Card'} Flush in ${SUIT_NAMES[hand[0].suit]}`,
      };
      items.push(flush);
    }
  }

  // 5. His Nobs (Jack in hand matching starter's suit)
  let nobs: ScoreItem | null = null;
  const nobJack = hand.find((c) => c.rank === 11 && c.suit === starter.suit);
  if (nobJack) {
    nobs = {
      category: 'nobs',
      points: 1,
      cards: [nobJack, starter],
      description: `His Nobs (J${SUIT_SYMBOLS[nobJack.suit]} matching cut ${starter.rankLabel}${SUIT_SYMBOLS[starter.suit]})`,
    };
    items.push(nobs);
  }

  const total = items.reduce((sum, item) => sum + item.points, 0);

  return {
    total,
    fifteens,
    pairs,
    runs,
    flush,
    nobs,
    items,
  };
};

/**
 * Checks if the cut starter card is a Jack ("Two for his heels").
 * Dealer immediately scores 2 points.
 */
export const checkHisHeels = (starter: CribbageCard): boolean => {
  return starter.rank === 11;
};
