import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import {
  playCardPlaceSound,
  playCaptureSound,
  playVictorySound,
  playErrorBuzz,
  triggerHaptic,
} from '../utils/feedback';
import { getLastCardAIMove } from '../utils/gameAi';

import {
  shuffleDeck,
  dealCards,
  createStandardDeck,
  SUIT_SYMBOLS,
  SUIT_NAMES,
  STANDARD_SUITS,
  type CardSuit,
} from '../utils/cards';

export type Suit = Extract<CardSuit, 'spades' | 'hearts' | 'diamonds' | 'clubs'>;
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface LastCardItem {
  id: string;
  suit: Suit;
  rank: Rank;
  label: string;
  rotationJitter?: number;
}

export { SUIT_SYMBOLS, SUIT_NAMES };
export const SUITS = STANDARD_SUITS as Suit[];

export const CREATE_LAST_CARD_DECK = (): LastCardItem[] => {
  const baseCards = createStandardDeck({ idPrefix: 'lc' });
  return baseCards.map((c) => ({
    id: `${c.suit}-${c.rankLabel}-${Math.random().toString(36).slice(2, 6)}`,
    suit: c.suit as Suit,
    rank: c.rankLabel as Rank,
    label: c.rankLabel,
  }));
};

export const LastCardGraphic: React.FC<{
  card: LastCardItem;
  isSelected?: boolean;
  isPlayable?: boolean;
  onClick?: () => void;
  small?: boolean;
}> = ({ card, isSelected, isPlayable = false, onClick, small = false }) => {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const textColor = isRed ? 'text-rose-600' : 'text-slate-900';

  const w = small ? 'w-10 sm:w-12 h-14 sm:h-17' : 'w-13 sm:w-16 md:w-18 h-19 sm:h-24 md:h-27';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative ${w} rounded-2xl bg-white border-2 select-none transition-all duration-150 transform cursor-pointer flex flex-col justify-between p-1.5 sm:p-2 ${
        isSelected
          ? 'ring-3 ring-amber-400 -translate-y-3 scale-108 z-30 shadow-2xl border-amber-400'
          : isPlayable
          ? 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-md hover:-translate-y-1 hover:shadow-xl'
          : 'border-stone-300 shadow-sm opacity-90'
      }`}
    >
      {/* Top Pip */}
      <div className="flex items-center justify-between leading-none z-10">
        <span className={`text-xs sm:text-base font-black ${textColor}`}>
          {card.label}
        </span>
        <span className={`text-xs sm:text-base font-black ${textColor}`}>
          {SUIT_SYMBOLS[card.suit]}
        </span>
      </div>

      {/* Center Art / Action Badge */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {card.rank === '8' ? (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 via-amber-400 to-blue-500 flex items-center justify-center text-white text-xs font-black shadow-md animate-pulse">
            8★
          </div>
        ) : card.rank === '2' ? (
          <div className="px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-black shadow-sm">
            +2
          </div>
        ) : card.rank === 'A' ? (
          <div className="px-1.5 py-0.5 rounded-md bg-amber-500 text-stone-950 text-[10px] font-black shadow-sm">
            AGAIN
          </div>
        ) : card.rank === 'J' ? (
          <div className="px-1.5 py-0.5 rounded-md bg-purple-600 text-white text-[10px] font-black shadow-sm">
            SKIP
          </div>
        ) : (
          <span className={`text-xl sm:text-3xl opacity-80 ${textColor}`}>
            {SUIT_SYMBOLS[card.suit]}
          </span>
        )}
      </div>

      {/* Bottom Pip Inverted */}
      <div className="flex items-center justify-between leading-none rotate-180 z-10">
        <span className={`text-xs sm:text-base font-black ${textColor}`}>
          {card.label}
        </span>
        <span className={`text-xs sm:text-base font-black ${textColor}`}>
          {SUIT_SYMBOLS[card.suit]}
        </span>
      </div>

      {/* Gloss overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-white/10 to-white/30 pointer-events-none" />
    </button>
  );
};

export const LastCard: React.FC = () => {
  const { setGameStatus, resetToMenu, gameMode, isCpuThinking, setIsCpuThinking } = useGame();

  const [drawPile, setDrawPile] = useState<LastCardItem[]>([]);
  const [discardPile, setDiscardPile] = useState<LastCardItem[]>([]);
  const [handP1, setHandP1] = useState<LastCardItem[]>([]);
  const [handP2, setHandP2] = useState<LastCardItem[]>([]);

  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [activeSuit, setActiveSuit] = useState<Suit>('spades');
  const [stackedDrawCount, setStackedDrawCount] = useState<number>(0);

  const [showSuitPicker, setShowSuitPicker] = useState<boolean>(false);
  const [pendingWildCard, setPendingWildCard] = useState<LastCardItem | null>(null);

  const [lastCardCalled, setLastCardCalled] = useState<{ p1: boolean; p2: boolean }>({ p1: false, p2: false });
  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Match top card by Suit or Rank.');
  const [winner, setWinner] = useState<PlayerNumber | null>(null);

  // Initialize Game
  const resetGame = useCallback(() => {
    const deck = shuffleDeck(CREATE_LAST_CARD_DECK());
    const { hands, remaining: undealt } = dealCards(deck, [7, 7]);
    const [p1, p2] = hands;

    // Find non-action starter card
    let startIdx = 0;
    while (
      startIdx < undealt.length &&
      (undealt[startIdx].rank === '8' || undealt[startIdx].rank === '2' || undealt[startIdx].rank === 'A' || undealt[startIdx].rank === 'J')
    ) {
      startIdx++;
    }
    const starter = undealt[startIdx] || undealt[0];
    starter.rotationJitter = 0;

    const remainingDeck = undealt.filter((_, idx) => idx !== startIdx);

    setDrawPile(remainingDeck);
    setDiscardPile([starter]);
    setActiveSuit(starter.suit);
    setHandP1(p1);
    setHandP2(p2);
    setTurn(1);
    setStackedDrawCount(0);
    setShowSuitPicker(false);
    setPendingWildCard(null);
    setLastCardCalled({ p1: false, p2: false });
    setWinner(null);
    setStatusMessage('Player 1: Match top card by Suit or Rank.');
    setGameStatus('active');
  }, [setGameStatus]);

  // Initial deal
  useState(() => {
    resetGame();
  });

  const topDiscard = discardPile[discardPile.length - 1];
  const activeHand = turn === 1 ? handP1 : handP2;

  // Check if a card is legally playable
  const isCardPlayable = useCallback(
    (card: LastCardItem): boolean => {
      if (!topDiscard) return false;

      // If there is an active Draw-2 penalty stack: only another 2 can be played!
      if (stackedDrawCount > 0) {
        return card.rank === '2';
      }

      // 8 is always wild
      if (card.rank === '8') return true;

      // Match active suit OR matching rank
      return card.suit === activeSuit || card.rank === topDiscard.rank;
    },
    [topDiscard, activeSuit, stackedDrawCount]
  );

  const playableCardCount = useMemo(() => {
    return activeHand.filter(isCardPlayable).length;
  }, [activeHand, isCardPlayable]);

  // Draw cards helper
  const drawCards = useCallback(
    (count: number, player: PlayerNumber): LastCardItem[] => {
      let currentDeck = [...drawPile];
      let currentDiscards = [...discardPile];

      if (currentDeck.length < count && currentDiscards.length > 1) {
        // Reshuffle discards except top
        const top = currentDiscards.pop()!;
        const recycled = shuffleDeck(currentDiscards);
        currentDeck = [...currentDeck, ...recycled];
        currentDiscards = [top];
        setDiscardPile(currentDiscards);
      }

      const drawn = currentDeck.slice(0, count);
      const remainingDeck = currentDeck.slice(count);
      setDrawPile(remainingDeck);

      if (player === 1) {
        setHandP1((prev) => [...prev, ...drawn]);
      } else {
        setHandP2((prev) => [...prev, ...drawn]);
      }

      playCardPlaceSound();
      triggerHaptic('medium');
      return drawn;
    },
    [drawPile, discardPile]
  );

  // Handle playing a card
  const handlePlayCard = (card: LastCardItem) => {
    if (gameMode === 'pve' && turn === 2) return;
    if (!isCardPlayable(card)) return;

    // Check "Last Card" penalty: if player had 2 cards and did NOT call Last Card!
    const hadTwoCards = activeHand.length === 2;
    const isCalled = turn === 1 ? lastCardCalled.p1 : lastCardCalled.p2;

    if (card.rank === '8') {
      // Prompt suit picker
      setPendingWildCard(card);
      setShowSuitPicker(true);
      return;
    }

    executeCardPlay(card, card.suit, hadTwoCards && !isCalled);
  };

  // Complete card play
  const executeCardPlay = useCallback(
    (card: LastCardItem, chosenSuit: Suit, penaltyForgotLastCard: boolean) => {
      playCardPlaceSound();
      triggerHaptic('medium');

      card.rotationJitter = (Math.random() - 0.5) * 16;

      // Remove from hand
      const currentHand = turn === 1 ? handP1 : handP2;
      const nextHand = currentHand.filter((c) => c.id !== card.id);
      if (turn === 1) setHandP1(nextHand);
      else setHandP2(nextHand);

      setDiscardPile((prev) => [...prev, card]);
      setActiveSuit(chosenSuit);

      // Apply penalty if forgot Last Card
      if (penaltyForgotLastCard) {
        playErrorBuzz();
        triggerHaptic('warning');
        drawCards(2, turn);
        setStatusMessage(`⚠️ Forgot to call "LAST CARD"! Incurred 2-card penalty!`);
      }

      // Check victory
      if (nextHand.length === 0) {
        playVictorySound();
        triggerHaptic('success');
        setWinner(turn);
        setStatusMessage(`Player ${turn} emptied their hand and won LAST CARD! Victory!`);
        return;
      }

      // Reset last card call
      setLastCardCalled((prev) => ({ ...prev, [turn === 1 ? 'p1' : 'p2']: false }));

      // Action Card Consequences
      const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;

      // 1. Draw 2 (+2)
      if (card.rank === '2') {
        const newStack = stackedDrawCount + 2;
        setStackedDrawCount(newStack);
        setTurn(nextPlayer);
        setStatusMessage(`Player ${turn} played a 2! Player ${nextPlayer} must counter with a 2 or draw ${newStack}!`);
        return;
      }

      // 2. Ace (Play Again)
      if (card.rank === 'A') {
        playCaptureSound();
        setStatusMessage(`Player ${turn} played an Ace! Extra turn!`);
        return;
      }

      // 3. Jack (Skip Opponent)
      if (card.rank === 'J') {
        playCaptureSound();
        setStatusMessage(`Player ${turn} played a Jack! Skipped opponent, play again!`);
        return;
      }

      // 4. Wild 8
      if (card.rank === '8') {
        setTurn(nextPlayer);
        setStatusMessage(`Player ${turn} played Wild 8 and chose ${SUIT_NAMES[chosenSuit]}! Player ${nextPlayer}'s turn.`);
        return;
      }

      // Normal play
      setTurn(nextPlayer);
      setStatusMessage(`Player ${turn} played ${card.label} of ${SUIT_NAMES[chosenSuit]}. Player ${nextPlayer}'s turn.`);
    },
    [turn, handP1, handP2, drawCards, stackedDrawCount]
  );

  // Draw Card Button Action (Voluntary draw or resolving Draw-2 penalty)
  const handleDrawButton = () => {
    if (gameMode === 'pve' && turn === 2) return;
    if (stackedDrawCount > 0) {
      // Must draw penalty cards
      drawCards(stackedDrawCount, turn);
      setStatusMessage(`Player ${turn} drew ${stackedDrawCount} penalty cards!`);
      setStackedDrawCount(0);
      const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
      setTurn(nextPlayer);
      return;
    }

    // Normal single card draw
    drawCards(1, turn);
    setStatusMessage(`Player ${turn} drew a card. Turn passed.`);
    const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
    setTurn(nextPlayer);
  };

  // Suit selection for Wild 8
  const handleSelectSuit = (suit: Suit) => {
    if (!pendingWildCard) return;
    const card = pendingWildCard;
    const hadTwoCards = activeHand.length === 2;
    const isCalled = turn === 1 ? lastCardCalled.p1 : lastCardCalled.p2;

    setShowSuitPicker(false);
    setPendingWildCard(null);
    executeCardPlay(card, suit, hadTwoCards && !isCalled);
  };

  // Toggle "LAST CARD" Callout
  const handleToggleLastCard = () => {
    if (gameMode === 'pve' && turn === 2) return;
    triggerHaptic('success');
    playCaptureSound();
    setLastCardCalled((prev) => {
      const nextState = !prev[turn === 1 ? 'p1' : 'p2'];
      setStatusMessage(
        nextState
          ? `📢 Player ${turn} called "LAST CARD!" Ready to play.`
          : `Player ${turn} cancelled "Last Card" call.`
      );
      return { ...prev, [turn === 1 ? 'p1' : 'p2']: nextState };
    });
  };

  // Non-blocking CPU AI loop for PvE mode
  useEffect(() => {
    if (gameMode !== 'pve' || turn !== 2 || winner !== null) return;
    if (!topDiscard) return;

    setIsCpuThinking(true);
    const timer = setTimeout(() => {
      setIsCpuThinking(false);
      const decision = getLastCardAIMove(handP2, topDiscard, activeSuit, stackedDrawCount);

      if (decision.action === 'draw' || !decision.cardId) {
        if (stackedDrawCount > 0) {
          drawCards(stackedDrawCount, 2);
          setStatusMessage(`CPU drew ${stackedDrawCount} penalty cards!`);
          setStackedDrawCount(0);
          setTurn(1);
        } else {
          drawCards(1, 2);
          setStatusMessage(`CPU drew a card. Player 1's turn.`);
          setTurn(1);
        }
        return;
      }

      const cardToPlay = handP2.find((c) => c.id === decision.cardId);
      if (!cardToPlay) {
        drawCards(1, 2);
        setStatusMessage(`CPU drew a card. Player 1's turn.`);
        setTurn(1);
        return;
      }

      if (decision.callLastCard) {
        setLastCardCalled((prev) => ({ ...prev, p2: true }));
        setStatusMessage(`📢 CPU called "LAST CARD!"`);
      }

      const chosenSuit = (decision.chosenSuit as Suit) || cardToPlay.suit;
      executeCardPlay(cardToPlay, chosenSuit, false);
    }, 850);

    return () => {
      clearTimeout(timer);
      setIsCpuThinking(false);
    };
  }, [
    gameMode,
    turn,
    winner,
    handP2,
    topDiscard,
    activeSuit,
    stackedDrawCount,
    drawCards,
    executeCardPlay,
    setIsCpuThinking,
  ]);

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="last-card"
        gameName="Last Card"
        turn={turn}
        statusText={`Player ${turn}'s Turn`}
        subStatusText={statusMessage}
      />

      {/* Main Table - Full-Viewport Responsive Scaling */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-between p-2 sm:p-3 overflow-hidden w-full max-w-4xl mx-auto">
        {/* Top Status & Hand Overview */}
        <div className="w-full flex items-center justify-between px-3 py-1.5 bg-black/60 border border-[#3e444c] rounded-2xl shadow-md shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-player-1" />
            <span className={`text-xs font-black ${turn === 1 ? 'text-player-1' : 'text-stone-400'}`}>
              P1 Cards: {handP1.length}
            </span>
            {lastCardCalled.p1 && (
              <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-black uppercase animate-pulse">
                LAST CARD!
              </span>
            )}
          </div>

          {/* Active Suit Pill */}
          <div className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-white/10 text-white text-xs font-black border border-white/20 shadow-sm">
            <span
              className={
                activeSuit === 'hearts' || activeSuit === 'diamonds' ? 'text-rose-400 text-sm' : 'text-blue-400 text-sm'
              }
            >
              {SUIT_SYMBOLS[activeSuit]}
            </span>
            <span className="uppercase text-[11px]">{SUIT_NAMES[activeSuit]}</span>
          </div>

          <div className="flex items-center gap-2">
            {lastCardCalled.p2 && (
              <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-black uppercase animate-pulse">
                LAST CARD!
              </span>
            )}
            <span className={`text-xs font-black ${turn === 2 ? 'text-player-2' : 'text-stone-400'}`}>
              P2 Cards: {handP2.length}
            </span>
            <span className="w-3 h-3 rounded-full bg-player-2" />
          </div>
        </div>

        {/* Central Parlor Discard Mat */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center py-1">
          <div className="w-full h-full max-h-[46vh] bg-[#1e1b4b] rounded-3xl border-4 border-[#0f0c36] shadow-2xl p-3 flex flex-col items-center justify-between relative overflow-hidden clubhouse-board-depth">
            {/* Draw Pile & Discard Center Table */}
            <div className="flex-1 w-full flex items-center justify-center gap-8">
              {/* Draw Pile */}
              <button
                type="button"
                onClick={handleDrawButton}
                className="relative w-15 sm:w-18 h-22 sm:h-26 rounded-2xl bg-gradient-to-b from-blue-700 to-indigo-900 border-2 border-white/40 shadow-xl flex flex-col items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                <span className="text-white text-xs font-black uppercase tracking-wider">
                  {stackedDrawCount > 0 ? `Draw ${stackedDrawCount}` : 'Draw'}
                </span>
                <span className="text-white/60 text-[10px] font-bold">
                  {drawPile.length} left
                </span>
                {stackedDrawCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-rose-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                    +{stackedDrawCount}
                  </div>
                )}
              </button>

              {/* Center Discard Pile with Jitter */}
              <div className="relative w-15 sm:w-18 h-22 sm:h-26 flex items-center justify-center">
                {discardPile.map((card, idx) => {
                  const isTop = idx === discardPile.length - 1;
                  return (
                    <div
                      key={card.id}
                      className="absolute"
                      style={{
                        transform: `rotate(${card.rotationJitter || 0}deg) scale(${isTop ? 1.05 : 1})`,
                        zIndex: idx,
                      }}
                    >
                      <LastCardGraphic card={card} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Bar (Draw & Last Card Callout) */}
            <div className="w-full flex items-center justify-center gap-3 z-20">
              <button
                type="button"
                onClick={handleDrawButton}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>{stackedDrawCount > 0 ? `Draw +${stackedDrawCount}` : 'Draw Card'}</span>
              </button>

              {/* Callout Button */}
              <button
                type="button"
                onClick={handleToggleLastCard}
                className={`px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1.5 ${
                  (turn === 1 ? lastCardCalled.p1 : lastCardCalled.p2)
                    ? 'bg-rose-600 text-white ring-2 ring-rose-400 animate-pulse'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-stone-950 hover:from-amber-400'
                }`}
              >
                <span>📢</span>
                <span>
                  {(turn === 1 ? lastCardCalled.p1 : lastCardCalled.p2)
                    ? 'LAST CARD Called!'
                    : 'Call "LAST CARD"'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Wild 8 Suit Picker Modal */}
        {showSuitPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="p-5 rounded-3xl bg-container-dark border-2 border-amber-400 shadow-2xl flex flex-col items-center gap-4 text-center max-w-xs w-full">
              <h4 className="text-sm font-black uppercase text-amber-300 tracking-wider">
                🌟 Wild 8: Choose Next Suit!
              </h4>
              <div className="grid grid-cols-2 gap-3 w-full">
                {SUITS.map((suit) => {
                  const isRed = suit === 'hearts' || suit === 'diamonds';
                  return (
                    <button
                      key={suit}
                      type="button"
                      onClick={() => handleSelectSuit(suit)}
                      className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 flex flex-col items-center justify-center border border-white/10 transition-all cursor-pointer"
                    >
                      <span className={`text-2xl font-black ${isRed ? 'text-rose-500' : 'text-blue-400'}`}>
                        {SUIT_SYMBOLS[suit]}
                      </span>
                      <span className="text-[11px] font-black uppercase text-white mt-1">
                        {SUIT_NAMES[suit]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Active Player Hand Display */}
        <div className="w-full flex flex-col items-center shrink-0 px-1">
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-stone-300 mb-1 px-2">
            <span>
              Player {turn}'s Hand ({activeHand.length} cards)
            </span>
            <span className="text-amber-400/80 text-[10px]">
              {playableCardCount > 0 ? `${playableCardCount} playable card${playableCardCount > 1 ? 's' : ''}` : 'No matches: tap Draw'}
            </span>
          </div>

          <div className="w-full flex items-center justify-center gap-1 sm:gap-1.5 overflow-x-auto py-2 px-2">
            {activeHand.map((card) => {
              const playable = isCardPlayable(card);
              return (
                <LastCardGraphic
                  key={card.id}
                  card={card}
                  isPlayable={playable}
                  onClick={playable ? () => handlePlayCard(card) : undefined}
                />
              );
            })}
          </div>
        </div>
      </main>

      {/* Victory Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Last Card"
          stats={[
            {
              label: 'Match Result',
              p1Value: winner === 1 ? '🏆 Winner' : `${handP1.length} cards left`,
              p2Value: winner === 2 ? '🏆 Winner' : `${handP2.length} cards left`,
            },
            {
              label: 'Discard History',
              p1Value: `${discardPile.length} cards played`,
              p2Value: `${discardPile.length} cards played`,
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
