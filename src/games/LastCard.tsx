import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader, type GamePlayMode } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import { RemoteDuelModal } from '../components/RemoteDuelModal';
import { multiplayer, type RemoteMessage } from '../utils/multiplayer';
import { useRemoteMultiplayer } from '../hooks/useRemoteMultiplayer';
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

// Masked Card Back for Opponent (First-Person Perspective Normalization)
export const MaskedCardBack: React.FC<{ small?: boolean; count?: number }> = ({ small = false }) => {
  const w = small ? 'w-9 sm:w-11 h-13 sm:h-16' : 'w-12 sm:w-14 h-17 sm:h-20';
  return (
    <div
      className={`relative ${w} rounded-xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 border-2 border-indigo-400/40 shadow-md flex items-center justify-center p-1 select-none shrink-0 transition-transform`}
    >
      <div className="w-full h-full rounded-lg border border-indigo-500/20 bg-indigo-950/60 flex items-center justify-center">
        <span className="text-amber-400 text-xs sm:text-sm font-black opacity-60">✦</span>
      </div>
    </div>
  );
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

      {/* Bottom Pip */}
      <div className="flex items-center justify-between leading-none z-10">
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
  const { setGameStatus, resetToMenu, isCpuThinking, setIsCpuThinking } = useGame();

  // Mode and Modals
  const [gamePlayMode, setGamePlayMode] = useState<GamePlayMode>('vs-cpu');
  const [showRemoteModal, setShowRemoteModal] = useState<boolean>(false);

  const [drawPile, setDrawPile] = useState<LastCardItem[]>([]);
  const [discardPile, setDiscardPile] = useState<LastCardItem[]>([]);
  const [handP1, setHandP1] = useState<LastCardItem[]>([]);
  const [handP2, setHandP2] = useState<LastCardItem[]>([]);

  // Remote Masked Opponent Tracking
  const [remoteOpponentCardCount, setRemoteOpponentCardCount] = useState<number>(7);
  const [remoteRevealedOpponentCards, setRemoteRevealedOpponentCards] = useState<LastCardItem[] | null>(null);

  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [activeSuit, setActiveSuit] = useState<Suit>('spades');
  const [stackedDrawCount, setStackedDrawCount] = useState<number>(0);

  const [showSuitPicker, setShowSuitPicker] = useState<boolean>(false);
  const [pendingWildCard, setPendingWildCard] = useState<LastCardItem | null>(null);

  const [lastCardCalled, setLastCardCalled] = useState<{ p1: boolean; p2: boolean }>({ p1: false, p2: false });
  const [statusMessage, setStatusMessage] = useState<string>('Match top card by Suit or Rank.');
  const [winner, setWinner] = useState<PlayerNumber | null>(null);

  // Initialize Game
  const resetGame = useCallback((isRemoteRestart = false) => {
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
    setRemoteOpponentCardCount(7);
    setRemoteRevealedOpponentCards(null);
    setTurn(1);
    setStackedDrawCount(0);
    setShowSuitPicker(false);
    setPendingWildCard(null);
    setLastCardCalled({ p1: false, p2: false });
    setWinner(null);
    setStatusMessage('Match top card by Suit or Rank.');
    setGameStatus('active');

    if (gamePlayMode === 'remote' && !isRemoteRestart) {
      if (multiplayer.isLocalHost()) {
        // Authoritative Deal: Host sends Guest their cards only (P1 cards stripped!)
        multiplayer.send({
          type: 'CARD_ACTION',
          gameId: 'last-card',
          payload: {
            action: 'DEAL',
            yourHand: p2,
            starter,
            opponentCardCount: p1.length,
            drawPileCount: remainingDeck.length,
            activeSuit: starter.suit,
          },
        });
      } else {
        multiplayer.send({
          type: 'RESTART',
          gameId: 'last-card',
        });
      }
    }
  }, [gamePlayMode, setGameStatus]);

  // Initial deal
  useEffect(() => {
    resetGame();
  }, [resetGame]);

  // Remote Synchronization Hook
  const {
    localPlayer,
    isMyTurn,
    latency,
    peerPresence,
    turnTimeRemaining,
    isAwaitingServer,
    setIsAwaitingServer,
  } = useRemoteMultiplayer({
    gameId: 'last-card',
    turn,
    gameMode: gamePlayMode,
    onTurnTimeout: () => {
      // 45s timer expired: auto-draw penalty card
      if (isMyTurn && winner === null) {
        setStatusMessage('Turn timer expired (45s)! Auto-drawing penalty card...');
        handleDrawButton();
      }
    },
    onPeerForfeit: () => {
      setWinner(localPlayer);
      setStatusMessage('Opponent disconnected past grace period. VICTORY!');
      triggerHaptic('success');
    },
  });

  const topDiscard = discardPile[discardPile.length - 1];

  // Perspective Normalization:
  // In remote mode: local player always views their own hand at the bottom!
  const myHand = useMemo(() => {
    if (gamePlayMode === 'remote') {
      return localPlayer === 1 ? handP1 : handP2;
    }
    return turn === 1 ? handP1 : handP2;
  }, [gamePlayMode, localPlayer, turn, handP1, handP2]);

  // Check if a card is legally playable
  const isCardPlayable = useCallback(
    (card: LastCardItem): boolean => {
      if (!topDiscard) return false;
      if (gamePlayMode === 'remote' && (!isMyTurn || isAwaitingServer)) return false;

      // If active Draw-2 stack: only another 2 can counter!
      if (stackedDrawCount > 0) {
        return card.rank === '2';
      }

      // 8 is always wild
      if (card.rank === '8') return true;

      // Match active suit OR matching rank
      return card.suit === activeSuit || card.rank === topDiscard.rank;
    },
    [topDiscard, activeSuit, stackedDrawCount, gamePlayMode, isMyTurn, isAwaitingServer]
  );

  const playableCardCount = useMemo(() => {
    return myHand.filter(isCardPlayable).length;
  }, [myHand, isCardPlayable]);

  // Draw cards helper (local)
  const drawCards = useCallback(
    (count: number, player: PlayerNumber): LastCardItem[] => {
      let currentDeck = [...drawPile];
      let currentDiscards = [...discardPile];

      if (currentDeck.length < count && currentDiscards.length > 1) {
        const top = currentDiscards.pop()!;
        const recycled = shuffleDeck(currentDiscards);
        currentDeck = [...currentDeck, ...recycled];
        currentDiscards = [top];
        setDiscardPile([top]);
      }

      const drawn = currentDeck.slice(0, count);
      const remaining = currentDeck.slice(count);
      setDrawPile(remaining);

      if (player === 1) {
        setHandP1((prev) => [...prev, ...drawn]);
      } else {
        setHandP2((prev) => [...prev, ...drawn]);
      }

      return drawn;
    },
    [drawPile, discardPile]
  );

  // Complete card play
  const executeCardPlay = useCallback(
    (card: LastCardItem, chosenSuit: Suit, penaltyForgotLastCard: boolean) => {
      playCardPlaceSound();
      triggerHaptic('medium');

      card.rotationJitter = (Math.random() - 0.5) * 16;

      const currentHand = gamePlayMode === 'remote'
        ? (localPlayer === 1 ? handP1 : handP2)
        : (turn === 1 ? handP1 : handP2);

      const nextHand = currentHand.filter((c) => c.id !== card.id);

      if (gamePlayMode === 'remote') {
        if (localPlayer === 1) setHandP1(nextHand);
        else setHandP2(nextHand);
      } else {
        if (turn === 1) setHandP1(nextHand);
        else setHandP2(nextHand);
      }

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

        if (gamePlayMode === 'remote') {
          multiplayer.send({
            type: 'CARD_ACTION',
            gameId: 'last-card',
            payload: {
              action: 'WIN',
              winner: turn,
              playedCard: card,
              chosenSuit,
            },
          });
        }
        return;
      }

      // Reset last card call
      setLastCardCalled((prev) => ({ ...prev, [turn === 1 ? 'p1' : 'p2']: false }));

      // Action Card Consequences
      const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;

      let nextTurnPlayer: PlayerNumber = nextPlayer;
      let nextStack = stackedDrawCount;

      if (card.rank === '2') {
        nextStack = stackedDrawCount + 2;
        setStackedDrawCount(nextStack);
        setTurn(nextPlayer);
        setStatusMessage(`Player ${turn} played a 2! Player ${nextPlayer} must counter or draw ${nextStack}!`);
      } else if (card.rank === 'A' || card.rank === 'J') {
        // Extra turn / Skip
        playCaptureSound();
        nextTurnPlayer = turn;
        setStatusMessage(`Player ${turn} played ${card.rank === 'A' ? 'an Ace' : 'a Jack'}! Extra turn!`);
      } else if (card.rank === '8') {
        setTurn(nextPlayer);
        setStatusMessage(`Player ${turn} played Wild 8 and chose ${SUIT_NAMES[chosenSuit]}! Player ${nextPlayer}'s turn.`);
      } else {
        setTurn(nextPlayer);
        setStatusMessage(`Player ${turn} played ${card.label} of ${SUIT_NAMES[chosenSuit]}. Player ${nextPlayer}'s turn.`);
      }

      // Broadcast sanitized play in Remote mode (Private cards stripped!)
      if (gamePlayMode === 'remote') {
        setIsAwaitingServer(true);
        multiplayer.send({
          type: 'CARD_ACTION',
          gameId: 'last-card',
          payload: {
            action: 'PLAY',
            playedCard: card,
            chosenSuit,
            hadTwoCardsAndCalled: !penaltyForgotLastCard,
            remainingCount: nextHand.length,
            nextTurn: nextTurnPlayer,
            stackedDrawCount: nextStack,
          },
        });
      }
    },
    [
      gamePlayMode,
      localPlayer,
      turn,
      handP1,
      handP2,
      drawCards,
      stackedDrawCount,
      setIsAwaitingServer,
    ]
  );

  // Play Card Handler
  const handlePlayCard = (card: LastCardItem) => {
    if (gamePlayMode === 'remote' && (!isMyTurn || isAwaitingServer)) return;
    if (gamePlayMode === 'pve' && turn === 2) return;

    const hadTwoCards = myHand.length === 2;
    const isCalled = (gamePlayMode === 'remote' ? localPlayer === 1 : turn === 1)
      ? lastCardCalled.p1
      : lastCardCalled.p2;

    if (card.rank === '8') {
      setPendingWildCard(card);
      setShowSuitPicker(true);
      return;
    }

    executeCardPlay(card, card.suit, hadTwoCards && !isCalled);
  };

  // Draw Card Action
  const handleDrawButton = () => {
    if (gamePlayMode === 'remote' && (!isMyTurn || isAwaitingServer)) return;
    if (gamePlayMode === 'pve' && turn === 2) return;

    if (gamePlayMode === 'remote') {
      setIsAwaitingServer(true);
      const count = stackedDrawCount > 0 ? stackedDrawCount : 1;

      if (multiplayer.isLocalHost()) {
        // Host draws locally
        drawCards(count, 1);
        setStackedDrawCount(0);
        const nextPlayer: PlayerNumber = 2;
        setTurn(nextPlayer);

        multiplayer.send({
          type: 'CARD_ACTION',
          gameId: 'last-card',
          payload: {
            action: 'DRAW_EVENT',
            drawCount: count,
            newCardCount: handP1.length + count,
            remainingDrawPileCount: Math.max(0, drawPile.length - count),
            nextTurn: nextPlayer,
          },
        });
        setIsAwaitingServer(false);
      } else {
        // Guest requests cards from Host
        multiplayer.send({
          type: 'CARD_ACTION',
          gameId: 'last-card',
          payload: {
            action: 'REQUEST_DRAW',
            drawCount: count,
            nextTurn: 1,
          },
        });
      }
      return;
    }

    // Local / PvE Draw
    if (stackedDrawCount > 0) {
      drawCards(stackedDrawCount, turn);
      setStatusMessage(`Player ${turn} drew ${stackedDrawCount} penalty cards!`);
      setStackedDrawCount(0);
      setTurn(turn === 1 ? 2 : 1);
      return;
    }

    drawCards(1, turn);
    setStatusMessage(`Player ${turn} drew a card. Turn passed.`);
    setTurn(turn === 1 ? 2 : 1);
  };

  // Suit selection for Wild 8
  const handleSelectSuit = (suit: Suit) => {
    if (!pendingWildCard) return;
    const card = pendingWildCard;
    const hadTwoCards = myHand.length === 2;
    const isCalled = (gamePlayMode === 'remote' ? localPlayer === 1 : turn === 1)
      ? lastCardCalled.p1
      : lastCardCalled.p2;

    setShowSuitPicker(false);
    setPendingWildCard(null);
    executeCardPlay(card, suit, hadTwoCards && !isCalled);
  };

  // Toggle "LAST CARD" Callout
  const handleToggleLastCard = () => {
    if (gamePlayMode === 'remote' && (!isMyTurn || isAwaitingServer)) return;
    if (gamePlayMode === 'pve' && turn === 2) return;

    triggerHaptic('success');
    playCaptureSound();

    const roleKey = (gamePlayMode === 'remote' ? localPlayer === 1 : turn === 1) ? 'p1' : 'p2';

    setLastCardCalled((prev) => {
      const nextState = !prev[roleKey];
      setStatusMessage(
        nextState
          ? `📢 Player ${turn} called "LAST CARD!" Ready to play.`
          : `Player ${turn} cancelled "Last Card" call.`
      );

      if (gamePlayMode === 'remote') {
        multiplayer.send({
          type: 'CARD_ACTION',
          gameId: 'last-card',
          payload: { action: 'CALL_LAST_CARD', called: nextState, player: localPlayer },
        });
      }

      return { ...prev, [roleKey]: nextState };
    });
  };

  // WebRTC Remote Duel Listeners with Strict State Scrubbing
  useEffect(() => {
    if (gamePlayMode !== 'remote') return;

    const unbind = multiplayer.onMessage((msg: RemoteMessage) => {
      if (msg.gameId !== 'last-card') return;

      if (msg.type === 'CARD_ACTION') {
        const { action } = msg.payload;

        if (action === 'DEAL') {
          // Guest receives deal from Host (P1 cards remain stripped!)
          setHandP2(msg.payload.yourHand);
          setDiscardPile([msg.payload.starter]);
          setActiveSuit(msg.payload.activeSuit);
          setRemoteOpponentCardCount(msg.payload.opponentCardCount);
          setTurn(1);
          setStackedDrawCount(0);
          setWinner(null);
          setStatusMessage('Game started! Host is Player 1.');
        } else if (action === 'PLAY') {
          // Opponent played a card
          setIsAwaitingServer(false);
          const { playedCard, chosenSuit, remainingCount, nextTurn, stackedDrawCount: newStack } = msg.payload;

          setDiscardPile((prev) => [...prev, playedCard]);
          setActiveSuit(chosenSuit);
          setRemoteOpponentCardCount(remainingCount);
          setTurn(nextTurn);
          if (newStack !== undefined) setStackedDrawCount(newStack);

          playCardPlaceSound();
          triggerHaptic('medium');
          setStatusMessage(`Opponent played ${playedCard.label} of ${SUIT_NAMES[chosenSuit]}.`);
        } else if (action === 'DRAW_EVENT') {
          // Host informed Guest of a draw
          setIsAwaitingServer(false);
          setRemoteOpponentCardCount(msg.payload.newCardCount);
          setTurn(msg.payload.nextTurn);
          setStackedDrawCount(0);
          setStatusMessage('Opponent drew a card.');
        } else if (action === 'REQUEST_DRAW') {
          // Host handles Guest draw request
          const count = msg.payload.drawCount;
          const currentDeck = [...drawPile];
          const drawn = currentDeck.slice(0, count);
          const remaining = currentDeck.slice(count);
          setDrawPile(remaining);

          setRemoteOpponentCardCount((prev) => prev + count);
          setStackedDrawCount(0);
          setTurn(msg.payload.nextTurn);

          // Reply with ONLY the drawn cards to the guest
          multiplayer.send({
            type: 'CARD_ACTION',
            gameId: 'last-card',
            payload: {
              action: 'DRAW_REPLY',
              drawnCards: drawn,
              nextTurn: msg.payload.nextTurn,
            },
          });
        } else if (action === 'DRAW_REPLY') {
          // Guest receives drawn cards from Host
          setIsAwaitingServer(false);
          setHandP2((prev) => [...prev, ...msg.payload.drawnCards]);
          setTurn(msg.payload.nextTurn);
          setStackedDrawCount(0);
          setStatusMessage('You drew your card(s). Turn passed.');
        } else if (action === 'CALL_LAST_CARD') {
          const oppKey = localPlayer === 1 ? 'p2' : 'p1';
          setLastCardCalled((prev) => ({ ...prev, [oppKey]: msg.payload.called }));
          if (msg.payload.called) {
            triggerHaptic('warning');
            setStatusMessage('📢 Opponent called "LAST CARD!"');
          }
        } else if (action === 'WIN') {
          setIsAwaitingServer(false);
          setWinner(msg.payload.winner);
          setDiscardPile((prev) => [...prev, msg.payload.playedCard]);
          setStatusMessage(`Opponent played their last card and won!`);
          triggerHaptic('error');

          // Send our remaining cards for post-game inspection
          multiplayer.send({
            type: 'CARD_ACTION',
            gameId: 'last-card',
            payload: {
              action: 'REVEAL_HAND',
              cards: localPlayer === 1 ? handP1 : handP2,
            },
          });
        } else if (action === 'REVEAL_HAND') {
          setRemoteRevealedOpponentCards(msg.payload.cards);
        }
      } else if (msg.type === 'RESTART') {
        resetGame(true);
      }
    });

    return unbind;
  }, [gamePlayMode, localPlayer, drawPile, handP1, handP2, resetGame, setIsAwaitingServer]);

  // Non-blocking CPU AI loop for PvE mode
  useEffect(() => {
    if (gamePlayMode !== 'vs-cpu' || turn !== 2 || winner !== null) return;
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
    gamePlayMode,
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
        onRestart={() => resetGame(false)}
        statusMessage={statusMessage}
        gameMode={gamePlayMode}
        onToggleGameMode={(m) => {
          setGamePlayMode(m);
          resetGame(false);
        }}
        supportedModes={['remote', 'vs-cpu', 'pass-and-play']}
        onOpenRemoteModal={() => setShowRemoteModal(true)}
        latency={latency}
        turnTimeRemaining={turnTimeRemaining}
        isAwaitingServer={isAwaitingServer}
        peerPresence={peerPresence}
        localPlayer={localPlayer}
      />

      {/* Main Table - Full-Viewport Responsive Scaling */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-between p-2 sm:p-3 overflow-hidden w-full max-w-4xl mx-auto">
        {/* Top Status & Hand Overview */}
        <div className="w-full flex items-center justify-between px-3 py-1.5 bg-black/60 border border-[#3e444c] rounded-2xl shadow-md shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-player-1" />
            <span className={`text-xs font-black ${turn === 1 ? 'text-player-1' : 'text-stone-400'}`}>
              {gamePlayMode === 'remote' ? (localPlayer === 1 ? 'You' : 'Opponent') : 'P1'}:{' '}
              {gamePlayMode === 'remote'
                ? (localPlayer === 1 ? handP1.length : remoteOpponentCardCount)
                : handP1.length} cards
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
              {gamePlayMode === 'remote' ? (localPlayer === 2 ? 'You' : 'Opponent') : 'P2'}:{' '}
              {gamePlayMode === 'remote'
                ? (localPlayer === 2 ? handP2.length : remoteOpponentCardCount)
                : handP2.length} cards
            </span>
            <span className="w-3 h-3 rounded-full bg-player-2" />
          </div>
        </div>

        {/* Remote Mode: Opponent Masked Hand at Top (First-Person View) */}
        {gamePlayMode === 'remote' && (
          <div className="w-full flex items-center justify-center gap-0.5 py-1 px-2 overflow-x-hidden">
            {Array.from({ length: Math.min(remoteOpponentCardCount, 12) }).map((_, idx) => (
              <div key={idx} className="-ml-3 first:ml-0 transition-all">
                <MaskedCardBack small />
              </div>
            ))}
            {remoteOpponentCardCount > 12 && (
              <span className="text-[10px] font-bold text-stone-400 ml-1">
                +{remoteOpponentCardCount - 12}
              </span>
            )}
          </div>
        )}

        {/* Central Parlor Discard Mat */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center py-1">
          <div className="w-full h-full max-h-[44vh] bg-[#1e1b4b] rounded-3xl border-4 border-[#0f0c36] shadow-2xl p-3 flex flex-col items-center justify-between relative overflow-hidden clubhouse-board-depth">
            {/* Draw Pile & Discard Center Table */}
            <div className="flex-1 w-full flex items-center justify-center gap-8">
              {/* Draw Pile */}
              <button
                type="button"
                onClick={handleDrawButton}
                disabled={gamePlayMode === 'remote' && (!isMyTurn || isAwaitingServer)}
                className={`relative w-15 sm:w-18 h-22 sm:h-26 rounded-2xl bg-gradient-to-b from-blue-700 to-indigo-900 border-2 border-white/40 shadow-xl flex flex-col items-center justify-center transition-all ${
                  gamePlayMode === 'remote' && (!isMyTurn || isAwaitingServer)
                    ? 'opacity-60 cursor-not-allowed'
                    : 'cursor-pointer hover:scale-105 active:scale-95'
                }`}
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
                disabled={gamePlayMode === 'remote' && (!isMyTurn || isAwaitingServer)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>📥</span>
                <span>{stackedDrawCount > 0 ? `Draw +${stackedDrawCount}` : 'Draw Card'}</span>
              </button>

              {/* Callout Button */}
              <button
                type="button"
                onClick={handleToggleLastCard}
                disabled={gamePlayMode === 'remote' && (!isMyTurn || isAwaitingServer)}
                className={`px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 ${
                  (gamePlayMode === 'remote' ? (localPlayer === 1 ? lastCardCalled.p1 : lastCardCalled.p2) : (turn === 1 ? lastCardCalled.p1 : lastCardCalled.p2))
                    ? 'bg-rose-600 text-white ring-2 ring-rose-400 animate-pulse'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-stone-950 hover:from-amber-400'
                }`}
              >
                <span>📢</span>
                <span>
                  {(gamePlayMode === 'remote' ? (localPlayer === 1 ? lastCardCalled.p1 : lastCardCalled.p2) : (turn === 1 ? lastCardCalled.p1 : lastCardCalled.p2))
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

        {/* Active Player Hand Display (Home Position at Bottom) */}
        <div className="w-full flex flex-col items-center shrink-0 px-1">
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-stone-300 mb-1 px-2">
            <span>
              {gamePlayMode === 'remote' ? 'Your Hand' : `Player ${turn}'s Hand`} ({myHand.length} cards)
            </span>
            <span className="text-amber-400/80 text-[10px]">
              {playableCardCount > 0 ? `${playableCardCount} playable card${playableCardCount > 1 ? 's' : ''}` : 'No matches: tap Draw'}
            </span>
          </div>

          <div className="w-full flex items-center justify-center gap-1 sm:gap-1.5 overflow-x-auto py-2 px-2">
            {myHand.map((card) => {
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
          onRestart={() => resetGame(false)}
          onMenu={resetToMenu}
        />
      )}

      {/* Remote Room Pairing Modal */}
      <RemoteDuelModal
        isOpen={showRemoteModal}
        onClose={() => setShowRemoteModal(false)}
      />
    </div>
  );
};
