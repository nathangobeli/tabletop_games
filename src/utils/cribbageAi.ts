// Tactical Heuristic AI for Cribbage (Discarding & Pegging Strategy)
import {
  type CribbageCard,
  evaluatePeggingPlay,
  getLegalPeggingCards,
} from './cribbageScoring';

/**
 * Evaluates the expected crib synergy of a 2-card discard pair.
 * High positive values indicate cards that naturally form 15s, pairs, or runs.
 */
export const evaluateCribDiscardSynergy = (c1: CribbageCard, c2: CribbageCard): number => {
  let score = 0;

  // 1. Both sum to 15 (e.g. 5 + 10/J/Q/K, 7 + 8, 6 + 9)
  if (c1.value + c2.value === 15) {
    score += 5.5;
  }

  // 2. Contains a 5 (the ultimate crib card because 16 out of 52 cards are 10-value)
  if (c1.rank === 5) score += 3.5;
  if (c2.rank === 5) score += 3.5;

  // 3. Pair
  if (c1.rank === c2.rank) {
    score += c1.rank === 5 ? 8.5 : 4.0;
  }

  // 4. Consecutive connectors (runs)
  const diff = Math.abs(c1.rank - c2.rank);
  if (diff === 1) {
    score += 2.5;
    // 7-8 is prime
    if ((c1.rank === 7 && c2.rank === 8) || (c1.rank === 8 && c2.rank === 7)) {
      score += 2.0;
    }
  } else if (diff === 2) {
    score += 1.2;
  }

  // 5. Suited cards
  if (c1.suit === c2.suit) {
    score += 0.8;
  }

  // 6. Safe balking cards (unfavorable for crib: King/Queen + wide-gapped non-5 low card)
  const highRank = Math.max(c1.rank, c2.rank);
  const lowRank = Math.min(c1.rank, c2.rank);
  if (highRank >= 12 && lowRank <= 4) {
    score -= 1.5;
  }

  return score;
};

/**
 * Fast evaluation of a 4-card hand across standard starter cut card expectations.
 */
const estimateHandValue = (keptCards: CribbageCard[]): number => {
  // Base 4-card combinations (sum to 15, pairs, runs in hand)
  let handScore = 0;

  // 15s in the 4 cards
  const n = keptCards.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) !== 0) sum += keptCards[i].value;
    }
    if (sum === 15) handScore += 2;
  }

  // Pairs
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (keptCards[i].rank === keptCards[j].rank) handScore += 2;
    }
  }

  // Runs (check run of 4, otherwise all 3-card subsets for single or double runs of 3)
  const ranks = [...keptCards].map((c) => c.rank).sort((a, b) => a - b);
  if (ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1 && ranks[3] === ranks[2] + 1) {
    handScore += 4;
  } else {
    // Check all 4 possible 3-card combinations (handles double runs like 3-4-4-5 = 6 pts)
    for (let skip = 0; skip < 4; skip++) {
      const trio = keptCards.filter((_, idx) => idx !== skip).map((c) => c.rank).sort((a, b) => a - b);
      if (trio[1] === trio[0] + 1 && trio[2] === trio[1] + 1) {
        handScore += 3;
      }
    }
  }

  // Flush
  if (keptCards.every((c) => c.suit === keptCards[0].suit)) {
    handScore += 4;
  }

  // His Nobs potential (+0.25 per Jack in hand, since 4/16 chance cut matches suit)
  for (const c of keptCards) {
    if (c.rank === 11) handScore += 0.25;
    if (c.rank === 5) handScore += 1.5;
  }

  return handScore;
};

/**
 * Evaluates all 15 discard combinations and picks the optimal 2 cards to send to Crib.
 * @param hand 6 dealt cards
 * @param isCpuDealer True if Crib belongs to the CPU
 */
export const chooseCribDiscards = (
  hand: CribbageCard[],
  isCpuDealer: boolean
): [CribbageCard, CribbageCard] => {
  if (hand.length !== 6) {
    return [hand[0], hand[1]];
  }

  let bestDiscardPair: [CribbageCard, CribbageCard] = [hand[0], hand[1]];
  let bestScore = -Infinity;

  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const discardPair: [CribbageCard, CribbageCard] = [hand[i], hand[j]];
      const keptCards = hand.filter((_, idx) => idx !== i && idx !== j);

      const handVal = estimateHandValue(keptCards);
      const cribSynergy = evaluateCribDiscardSynergy(hand[i], hand[j]);

      // If CPU is dealer: maximize handVal + cribSynergy
      // If opponent is dealer: maximize handVal - cribSynergy (balking the opponent)
      const totalScore = isCpuDealer
        ? handVal + cribSynergy * 1.15
        : handVal - cribSynergy * 1.25;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestDiscardPair = discardPair;
      }
    }
  }

  return bestDiscardPair;
};

// ============================================================================
// 2. PEGGING AI TACTICS
// ============================================================================

/**
 * Chooses the best card to play during the pegging phase.
 * @param hand CPU's remaining unplayed cards in current round
 * @param currentCount Current running pegging total (0..31)
 * @param sequence Current sequence of cards played in this 31 cycle
 */
export const choosePeggingCard = (
  hand: CribbageCard[],
  currentCount: number,
  sequence: CribbageCard[]
): CribbageCard | null => {
  const legalCards = getLegalPeggingCards(hand, currentCount);
  if (legalCards.length === 0) return null; // Must declare "Go"

  if (legalCards.length === 1) return legalCards[0];

  let bestCard = legalCards[0];
  let highestHeuristic = -Infinity;

  for (const card of legalCards) {
    let score = 0;
    const playResult = evaluatePeggingPlay(sequence, card);
    const newTotal = playResult.newRunningTotal;

    // 1. Direct Points Earned by playing this card
    score += playResult.totalPoints * 35;

    // 2. Hitting 31 is the holy grail (+2 pts and count resets)
    if (newTotal === 31) {
      score += 60;
    }

    // 3. Hitting 15 is excellent (+2 pts)
    if (newTotal === 15) {
      score += 45;
    }

    // 4. Defensive Trap Avoidance:
    // Leaving the count at 5 allows opponent to easily play a 10 to hit 15!
    if (newTotal === 5) {
      score -= 50;
    }

    // Leaving count at 21 allows opponent to easily play a 10 to hit 31!
    if (newTotal === 21) {
      score -= 45;
    }

    // Leaving count at 11 or 10 gives opponent chance for 15
    if (newTotal === 10 || newTotal === 11) {
      score -= 15;
    }

    // 5. If Leading (currentCount === 0):
    if (currentCount === 0) {
      // Leading a 4 is classically the best lead in Cribbage (cannot make 15 next turn)
      if (card.rank === 4) score += 30;
      else if (card.rank === 3) score += 20;
      else if (card.rank === 2) score += 15;
      else if (card.rank === 5) score -= 60; // Never lead a 5!
      else if (card.value === 10) score -= 10;
    }

    // 6. Holding duplicate: If we have a pair of this card in hand, playing one sets up a trap
    // if opponent pairs it, we can hit 3-of-a-kind (+6)!
    const matchingInHand = hand.filter((c) => c.id !== card.id && c.rank === card.rank).length;
    if (matchingInHand >= 1 && newTotal + card.value <= 31) {
      score += 15;
    }

    // 7. Small tie-breaker: prefer saving Aces and low cards for late Go/31 traps
    if (card.rank === 1) score -= 5;

    if (score > highestHeuristic) {
      highestHeuristic = score;
      bestCard = card;
    }
  }

  return bestCard;
};
