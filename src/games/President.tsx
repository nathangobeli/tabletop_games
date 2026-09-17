import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import {
  playCardPlaceSound,
  playCaptureSound,
  playVictorySound,
  triggerHaptic,
} from '../utils/feedback';
import { getPresidentAIMove } from '../utils/gameAi';

import {
  shuffleDeck,
  dealCards,
  createStandardDeck,
  SUIT_SYMBOLS,
  STANDARD_SUITS,
  type CardSuit as Suit,
} from '../utils/cards';

export type { Suit };
export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 99; // 11=J, 12=Q, 13=K, 14=A, 15=2, 99=Joker

export interface PlayingCard {
  id: string;
  suit: Suit;
  rank: Rank;
  label: string;
  isJoker?: boolean;
}

// President evaluation order: 3 is lowest (3), Ace is high (14), 2 is highest (15)
const PRESIDENT_RANK_ORDER: Record<number, number> = {
  1: 14, // Ace
  2: 15, // Two
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11, // Jack
  12: 12, // Queen
  13: 13, // King
};

export const CREATE_PRESIDENT_DECK = (): PlayingCard[] => {
  const baseCards = createStandardDeck({
    idPrefix: 'pres',
    includeJokers: true,
    jokerCount: 2,
    customRankOrder: PRESIDENT_RANK_ORDER,
  });

  return baseCards.map((c) => ({
    id: c.id,
    suit: c.suit as Suit,
    rank: (c.isJoker ? 99 : c.value) as Rank,
    label: c.isJoker ? 'JOKER' : c.rankLabel,
    isJoker: c.isJoker,
  }));
};

export interface PlayedCombination {
  cards: PlayingCard[];
  effectiveRank: number;
  count: number;
  player: PlayerNumber;
}

export const PresidentCardView: React.FC<{
  card: PlayingCard;
  isSelected?: boolean;
  onClick?: () => void;
  small?: boolean;
}> = ({ card, isSelected, onClick, small = false }) => {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const textColor = card.isJoker ? 'text-amber-500' : isRed ? 'text-rose-600' : 'text-stone-900';

  const w = small ? 'w-10 sm:w-12 h-14 sm:h-17' : 'w-12 sm:w-15 md:w-17 h-18 sm:h-22 md:h-25';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative ${w} rounded-xl bg-white border border-stone-300 shadow-md select-none transition-all duration-150 transform cursor-pointer flex flex-col justify-between p-1 sm:p-1.5 ${
        isSelected
          ? 'ring-3 ring-amber-400 -translate-y-3 scale-108 z-30 shadow-xl'
          : 'hover:-translate-y-1 hover:shadow-lg active:scale-95'
      }`}
    >
      {/* Top Left Pip */}
      <div className="flex flex-col items-start leading-none z-10 font-serif-classic">
        <span className={`text-xs sm:text-sm font-black ${textColor}`}>
          {card.label}
        </span>
        <span className={`text-[10px] sm:text-xs font-black ${textColor}`}>
          {SUIT_SYMBOLS[card.suit]}
        </span>
      </div>

      {/* Center Art */}
      <div className="flex-1 flex items-center justify-center">
        {card.isJoker ? (
          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 text-xs font-black font-serif-classic">
            👑
          </div>
        ) : (
          <span className={`text-lg sm:text-2xl opacity-80 ${textColor}`}>
            {SUIT_SYMBOLS[card.suit]}
          </span>
        )}
      </div>

      {/* Bottom Right Pip (Inverted) */}
      <div className="flex flex-col items-end leading-none rotate-180 z-10 font-serif-classic">
        <span className={`text-xs sm:text-sm font-black ${textColor}`}>
          {card.label}
        </span>
        <span className={`text-[10px] sm:text-xs font-black ${textColor}`}>
          {SUIT_SYMBOLS[card.suit]}
        </span>
      </div>

      {/* Gloss reflection overlay */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-transparent via-white/10 to-white/30 pointer-events-none" />
    </button>
  );
};

export const President: React.FC = () => {
  const { setGameStatus, resetToMenu, gameMode, isCpuThinking, setIsCpuThinking } = useGame();

  const [handP1, setHandP1] = useState<PlayingCard[]>([]);
  const [handP2, setHandP2] = useState<PlayingCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [currentStack, setCurrentStack] = useState<PlayedCombination | null>(null);
  const [discardHistory, setDiscardHistory] = useState<PlayedCombination[]>([]);

  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [isRevolution, setIsRevolution] = useState<boolean>(false);
  const [consecutivePasses, setConsecutivePasses] = useState<number>(0);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1 leads! Select cards to play.');

  // Sort helper according to current revolution state
  const sortCards = useCallback(
    (cards: PlayingCard[]) => {
      return [...cards].sort((a, b) => {
        if (a.isJoker && !b.isJoker) return 1;
        if (!a.isJoker && b.isJoker) return -1;
        if (isRevolution) {
          // 3 is highest (rank 3 > rank 15)
          return b.rank - a.rank;
        }
        // Normal: 3 lowest (rank 3 < rank 15)
        return a.rank - b.rank;
      });
    },
    [isRevolution]
  );

  // Initialize Game
  const resetGame = useCallback(() => {
    const deck = shuffleDeck(CREATE_PRESIDENT_DECK());
    const { hands } = dealCards(deck, [18, 18]);
    const [p1, p2] = hands;

    setIsRevolution(false);
    setHandP1(p1.sort((a, b) => a.rank - b.rank));
    setHandP2(p2.sort((a, b) => a.rank - b.rank));
    setSelectedCards([]);
    setCurrentStack(null);
    setDiscardHistory([]);
    setTurn(1);
    setConsecutivePasses(0);
    setWinner(null);
    setStatusMessage('Player 1: Lead with any Single, Pair, Triple, or 4-of-a-Kind.');
    setGameStatus('active');
  }, [setGameStatus]);

  // Initial deal
  useState(() => {
    resetGame();
  });

  const activeHand = useMemo(() => {
    const hand = turn === 1 ? handP1 : handP2;
    return sortCards(hand);
  }, [turn, handP1, handP2, sortCards]);

  // Toggle selection
  const handleCardClick = (cardId: string) => {
    if (gameMode === 'pve' && turn === 2) return;
    playCardPlaceSound();
    triggerHaptic('light');

    setSelectedCards((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      return [...prev, cardId];
    });
  };

  // Validate combination of selected cards
  const selectedObjList = useMemo(() => {
    return activeHand.filter((c) => selectedCards.includes(c.id));
  }, [activeHand, selectedCards]);

  const combinationValidation = useMemo(() => {
    if (selectedObjList.length === 0) return { valid: false, reason: 'Select cards to play' };

    const count = selectedObjList.length;
    const nonJokers = selectedObjList.filter((c) => !c.isJoker);

    // Check same rank
    if (nonJokers.length > 0) {
      const baseRank = nonJokers[0].rank;
      const allSame = nonJokers.every((c) => c.rank === baseRank);
      if (!allSame) {
        return { valid: false, reason: 'All selected cards must share the same rank (or Joker)' };
      }
    }

    const effectiveRank = nonJokers.length > 0 ? nonJokers[0].rank : 99;

    // Check count against active stack
    if (currentStack) {
      if (count !== currentStack.count) {
        return {
          valid: false,
          reason: `Must match stack count (${currentStack.count} card${currentStack.count > 1 ? 's' : ''})`,
        };
      }

      // Check rank hierarchy
      if (effectiveRank === 99) {
        // Joker beats any single
        if (count !== 1 && currentStack.effectiveRank === 99) {
          return { valid: false, reason: 'Cannot beat Joker' };
        }
      } else {
        if (isRevolution) {
          if (effectiveRank >= currentStack.effectiveRank) {
            return { valid: false, reason: `Revolution active: must be LOWER rank than ${RANK_LABELS[currentStack.effectiveRank as Rank]}` };
          }
        } else {
          if (effectiveRank <= currentStack.effectiveRank) {
            return { valid: false, reason: `Must be HIGHER rank than ${RANK_LABELS[currentStack.effectiveRank as Rank]}` };
          }
        }
      }
    }

    return {
      valid: true,
      count,
      effectiveRank,
      hasEight: nonJokers.some((c) => c.rank === 8),
      isQuad: count === 4,
    };
  }, [selectedObjList, currentStack, isRevolution]);

  // Execute Play
  const handlePlay = () => {
    if (gameMode === 'pve' && turn === 2) return;
    if (!combinationValidation.valid) return;

    playCaptureSound();
    triggerHaptic('medium');

    const playedCombo: PlayedCombination = {
      cards: selectedObjList,
      effectiveRank: combinationValidation.effectiveRank!,
      count: combinationValidation.count!,
      player: turn,
    };

    // Remove cards from player's hand
    const remainingHand = activeHand.filter((c) => !selectedCards.includes(c.id));
    if (turn === 1) setHandP1(remainingHand);
    else setHandP2(remainingHand);

    setSelectedCards([]);

    // Check win condition immediately
    if (remainingHand.length === 0) {
      playVictorySound();
      triggerHaptic('success');
      setWinner(turn);
      setStatusMessage(`Player ${turn} shed all cards and became the PRESIDENT! Victory!`);
      return;
    }

    // 1. Revolution (4-of-a-kind)
    if (combinationValidation.isQuad) {
      setIsRevolution((prev) => !prev);
      setStatusMessage(`⚡ REVOLUTION! Hierarchy reversed by Player ${turn}'s 4-of-a-Kind!`);
    }

    // 2. 8-End (Hachi-Giri)
    if (combinationValidation.hasEight) {
      triggerHaptic('success');
      setDiscardHistory((prev) => [...prev, playedCombo]);
      setCurrentStack(null);
      setConsecutivePasses(0);
      setStatusMessage(`💥 8-END! Stack swept. Player ${turn} keeps the lead with a fresh combination!`);
      return;
    }

    // Normal play progression
    setDiscardHistory((prev) => [...prev, playedCombo]);
    setCurrentStack(playedCombo);
    setConsecutivePasses(0);

    const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
    setTurn(nextPlayer);
    setStatusMessage(
      `Player ${turn} played ${playedCombo.count}x ${
        playedCombo.effectiveRank === 99 ? 'Joker' : RANK_LABELS[playedCombo.effectiveRank as Rank]
      }. Player ${nextPlayer}'s turn.`
    );
  };

  // Pass Turn
  const handlePass = useCallback((isCpu = false) => {
    if (!isCpu && gameMode === 'pve' && turn === 2) return;
    if (!currentStack) return; // Cannot pass on empty lead

    playCardPlaceSound();
    triggerHaptic('light');

    const nextPasses = consecutivePasses + 1;
    setConsecutivePasses(nextPasses);

    if (nextPasses >= 1) {
      // Both passed! Clear stack and grant free lead to last player
      const nextLead: PlayerNumber = currentStack.player;
      setCurrentStack(null);
      setConsecutivePasses(0);
      setTurn(nextLead);
      setSelectedCards([]);
      const leadName = nextLead === 2 && gameMode === 'pve' ? '🤖 CPU' : `Player ${nextLead}`;
      setStatusMessage(`Both passed! Stack cleared. ${leadName} has the lead.`);
      return;
    }

    const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
    setTurn(nextPlayer);
    setSelectedCards([]);
    const passerName = turn === 2 && gameMode === 'pve' ? '🤖 CPU' : `Player ${turn}`;
    const nextName = nextPlayer === 2 && gameMode === 'pve' ? '🤖 CPU' : `Player ${nextPlayer}`;
    setStatusMessage(`${passerName} passed. ${nextName}'s turn.`);
  }, [currentStack, consecutivePasses, turn, gameMode]);

  // Automated CPU Turn for Player 2 when in 'pve' mode
  useEffect(() => {
    if (gameMode !== 'pve' || turn !== 2 || winner !== null) {
      return;
    }

    setIsCpuThinking(true);
    setStatusMessage('🤖 CPU is deciding which cards to play...');

    const timer = setTimeout(() => {
      setIsCpuThinking(false);
      const chosenCardIds = getPresidentAIMove(handP2, currentStack, isRevolution);

      if (chosenCardIds && chosenCardIds.length > 0) {
        // Execute CPU Play
        const chosenCards = handP2.filter((c) => chosenCardIds.includes(c.id));
        const nonJokers = chosenCards.filter((c) => !c.isJoker);
        const effRank = nonJokers.length > 0 ? nonJokers[0].rank : 99;
        const playedCombo: PlayedCombination = {
          cards: chosenCards,
          effectiveRank: effRank,
          count: chosenCards.length,
          player: 2,
        };

        const remainingHand = handP2.filter((c) => !chosenCardIds.includes(c.id));
        setHandP2(remainingHand);
        setSelectedCards([]);

        playCaptureSound();
        triggerHaptic('medium');

        if (remainingHand.length === 0) {
          playVictorySound();
          triggerHaptic('success');
          setWinner(2);
          setStatusMessage('🤖 CPU shed all cards and became the PRESIDENT! Victory!');
          return;
        }

        if (chosenCards.length === 4) {
          setIsRevolution((prev) => !prev);
          setStatusMessage('⚡ REVOLUTION! Hierarchy reversed by 🤖 CPU!');
        }

        if (nonJokers.some((c) => c.rank === 8)) {
          triggerHaptic('success');
          setDiscardHistory((prev) => [...prev, playedCombo]);
          setCurrentStack(null);
          setConsecutivePasses(0);
          setStatusMessage('💥 8-END! Stack swept. 🤖 CPU keeps the lead!');
          return;
        }

        setDiscardHistory((prev) => [...prev, playedCombo]);
        setCurrentStack(playedCombo);
        setConsecutivePasses(0);
        setTurn(1);
        setStatusMessage("Player 1's turn.");
      } else {
        // CPU Passes
        handlePass(true);
      }
    }, 900);

    return () => {
      clearTimeout(timer);
      setIsCpuThinking(false);
    };
  }, [gameMode, turn, winner, handP2, currentStack, isRevolution, handlePass, setIsCpuThinking]);

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="president"
        gameName="President (Daifugo)"
        turn={turn}
        statusText={`Player ${turn}'s Turn`}
        subStatusText={statusMessage}
      />

      {/* Main Saloon Table - Responsive Full-Viewport Scaling */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-between p-2 sm:p-3 overflow-hidden w-full max-w-4xl mx-auto">
        {/* Top Status & Opponent Hand Count */}
        <div className="w-full flex items-center justify-between px-3 py-1.5 bg-black/60 border border-[#3e444c] rounded-2xl shadow-md shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-player-1" />
            <span className={`text-xs font-black font-mono-digital ${turn === 1 ? 'text-player-1' : 'text-stone-400'}`}>
              P1 Cards: {handP1.length}
            </span>
          </div>

          {/* Revolution Indicator */}
          <div
            className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider font-serif-classic transition-all ${
              isRevolution
                ? 'bg-amber-500 text-stone-950 animate-pulse shadow-md'
                : 'bg-white/10 text-stone-300'
            }`}
          >
            {isRevolution ? '⚡ Revolution: 3 High' : 'Standard: 2 High'}
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-black font-mono-digital ${turn === 2 ? 'text-player-2' : 'text-stone-400'}`}>
              P2 Cards: {handP2.length}
            </span>
            <span className="w-3 h-3 rounded-full bg-player-2" />
          </div>
        </div>

        {/* Central Felt Discard Arena */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center py-1">
          <div className="w-full h-full max-h-[46vh] bg-[#3b1d07] rounded-3xl border-4 border-[#200e03] shadow-2xl p-3 flex flex-col items-center justify-between relative overflow-hidden clubhouse-board-depth">
            {/* Table Branding */}
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-500/60 flex items-center justify-between w-full px-2 font-serif-classic">
              <span>President Saloon Duel</span>
              <span className="font-mono-digital">Discards: {discardHistory.length} tricks</span>
            </div>

            {/* Active Stack Plate */}
            <div className="flex-1 flex flex-col items-center justify-center">
              {currentStack ? (
                <div className="flex flex-col items-center gap-2 animate-fade-in">
                  <div className="flex items-center justify-center gap-1 sm:gap-2">
                    {currentStack.cards.map((card, idx) => (
                      <div
                        key={card.id}
                        style={{ transform: `rotate(${(idx - (currentStack.cards.length - 1) / 2) * 5}deg)` }}
                      >
                        <PresidentCardView card={card} />
                      </div>
                    ))}
                  </div>
                  <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-black/60 text-amber-400 border border-amber-400/30 shadow-sm">
                    Played by P{currentStack.player} • {currentStack.count}x{' '}
                    {currentStack.effectiveRank === 99 ? 'Joker' : RANK_LABELS[currentStack.effectiveRank as Rank]}
                  </span>
                </div>
              ) : (
                <div className="w-32 h-44 rounded-2xl border-2 border-dashed border-amber-500/30 flex flex-col items-center justify-center text-center p-3 text-amber-500/40">
                  <span className="text-2xl mb-1">🃏</span>
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Free Lead
                  </span>
                  <span className="text-[9px] font-semibold">Play any count</span>
                </div>
              )}
            </div>

            {/* Action Buttons Bar */}
            <div className="w-full flex items-center justify-center gap-3 z-20">
              <button
                type="button"
                onClick={handlePass}
                disabled={!currentStack}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed text-stone-200 font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md"
              >
                Pass Turn
              </button>

              <button
                type="button"
                onClick={handlePlay}
                disabled={!combinationValidation.valid}
                className={`px-6 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1.5 ${
                  combinationValidation.valid
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-stone-950 border border-amber-300 shadow-amber-500/20'
                    : 'bg-stone-700 text-stone-400 cursor-not-allowed'
                }`}
              >
                <span>
                  {combinationValidation.valid
                    ? `Play ${combinationValidation.count}x ${
                        combinationValidation.effectiveRank === 99
                          ? 'Joker'
                          : RANK_LABELS[combinationValidation.effectiveRank as Rank]
                      }`
                    : combinationValidation.reason}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Player Hand Display */}
        <div className="w-full flex flex-col items-center shrink-0 px-1">
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-stone-300 mb-1 px-2">
            <span>
              Player {turn}'s Hand ({activeHand.length} cards)
            </span>
            <span className="text-amber-400/80 text-[10px]">
              Tap cards to select combination
            </span>
          </div>

          <div className="w-full flex items-center justify-center gap-1 sm:gap-1.5 overflow-x-auto py-2 px-2">
            {activeHand.map((card) => (
              <PresidentCardView
                key={card.id}
                card={card}
                isSelected={selectedCards.includes(card.id)}
                onClick={() => handleCardClick(card.id)}
              />
            ))}
          </div>
        </div>
      </main>

      {/* Victory Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="President (Daifugo)"
          stats={[
            {
              label: 'Match Result',
              p1Value: winner === 1 ? '👑 President' : 'Scum (Daifugo)',
              p2Value: winner === 2 ? '👑 President' : 'Scum (Daifugo)',
            },
            {
              label: 'Remaining Cards',
              p1Value: `${handP1.length} cards`,
              p2Value: `${handP2.length} cards`,
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
