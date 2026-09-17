import React, { useState, useCallback, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import {
  playHanafudaSnapSound,
  playCaptureSound,
  playVictorySound,
  triggerHaptic,
} from '../utils/feedback';

export type HanafudaMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type CardType = 'bright' | 'animal' | 'ribbon' | 'chaff';
export type RibbonType = 'akatan' | 'aotan' | 'plain';

export interface HanafudaCard {
  id: string;
  month: HanafudaMonth;
  monthName: string;
  flower: string;
  type: CardType;
  name: string;
  ribbonType?: RibbonType;
  isCup?: boolean; // Chrysanthemum Sake Cup
  isRainman?: boolean; // Willow Rainman
}

// 48 Traditional Hanafuda Cards
export const HANAFUDA_DECK: HanafudaCard[] = [
  // Jan - Pine (Matsu)
  { id: 'm01-1', month: 1, monthName: 'Jan', flower: 'Pine', type: 'bright', name: 'Crane with Sun' },
  { id: 'm01-2', month: 1, monthName: 'Jan', flower: 'Pine', type: 'ribbon', ribbonType: 'akatan', name: 'Pine Poetry Ribbon' },
  { id: 'm01-3', month: 1, monthName: 'Jan', flower: 'Pine', type: 'chaff', name: 'Pine Chaff 1' },
  { id: 'm01-4', month: 1, monthName: 'Jan', flower: 'Pine', type: 'chaff', name: 'Pine Chaff 2' },

  // Feb - Plum (Ume)
  { id: 'm02-1', month: 2, monthName: 'Feb', flower: 'Plum', type: 'animal', name: 'Warbler on Branch' },
  { id: 'm02-2', month: 2, monthName: 'Feb', flower: 'Plum', type: 'ribbon', ribbonType: 'akatan', name: 'Plum Poetry Ribbon' },
  { id: 'm02-3', month: 2, monthName: 'Feb', flower: 'Plum', type: 'chaff', name: 'Plum Chaff 1' },
  { id: 'm02-4', month: 2, monthName: 'Feb', flower: 'Plum', type: 'chaff', name: 'Plum Chaff 2' },

  // Mar - Cherry (Sakura)
  { id: 'm03-1', month: 3, monthName: 'Mar', flower: 'Cherry', type: 'bright', name: 'Camp Curtain' },
  { id: 'm03-2', month: 3, monthName: 'Mar', flower: 'Cherry', type: 'ribbon', ribbonType: 'akatan', name: 'Cherry Poetry Ribbon' },
  { id: 'm03-3', month: 3, monthName: 'Mar', flower: 'Cherry', type: 'chaff', name: 'Cherry Chaff 1' },
  { id: 'm03-4', month: 3, monthName: 'Mar', flower: 'Cherry', type: 'chaff', name: 'Cherry Chaff 2' },

  // Apr - Wisteria (Fuji)
  { id: 'm04-1', month: 4, monthName: 'Apr', flower: 'Wisteria', type: 'animal', name: 'Cuckoo & Moon' },
  { id: 'm04-2', month: 4, monthName: 'Apr', flower: 'Wisteria', type: 'ribbon', ribbonType: 'plain', name: 'Wisteria Ribbon' },
  { id: 'm04-3', month: 4, monthName: 'Apr', flower: 'Wisteria', type: 'chaff', name: 'Wisteria Chaff 1' },
  { id: 'm04-4', month: 4, monthName: 'Apr', flower: 'Wisteria', type: 'chaff', name: 'Wisteria Chaff 2' },

  // May - Iris (Ayame)
  { id: 'm05-1', month: 5, monthName: 'May', flower: 'Iris', type: 'animal', name: 'Eight-Plank Bridge' },
  { id: 'm05-2', month: 5, monthName: 'May', flower: 'Iris', type: 'ribbon', ribbonType: 'plain', name: 'Iris Ribbon' },
  { id: 'm05-3', month: 5, monthName: 'May', flower: 'Iris', type: 'chaff', name: 'Iris Chaff 1' },
  { id: 'm05-4', month: 5, monthName: 'May', flower: 'Iris', type: 'chaff', name: 'Iris Chaff 2' },

  // Jun - Peony (Botan)
  { id: 'm06-1', month: 6, monthName: 'Jun', flower: 'Peony', type: 'animal', name: 'Butterflies' },
  { id: 'm06-2', month: 6, monthName: 'Jun', flower: 'Peony', type: 'ribbon', ribbonType: 'aotan', name: 'Peony Blue Ribbon' },
  { id: 'm06-3', month: 6, monthName: 'Jun', flower: 'Peony', type: 'chaff', name: 'Peony Chaff 1' },
  { id: 'm06-4', month: 6, monthName: 'Jun', flower: 'Peony', type: 'chaff', name: 'Peony Chaff 2' },

  // Jul - Bush Clover (Hagi)
  { id: 'm07-1', month: 7, monthName: 'Jul', flower: 'Clover', type: 'animal', name: 'Wild Boar' },
  { id: 'm07-2', month: 7, monthName: 'Jul', flower: 'Clover', type: 'ribbon', ribbonType: 'plain', name: 'Clover Ribbon' },
  { id: 'm07-3', month: 7, monthName: 'Jul', flower: 'Clover', type: 'chaff', name: 'Clover Chaff 1' },
  { id: 'm07-4', month: 7, monthName: 'Jul', flower: 'Clover', type: 'chaff', name: 'Clover Chaff 2' },

  // Aug - Pampas Grass (Susuki)
  { id: 'm08-1', month: 8, monthName: 'Aug', flower: 'Pampas', type: 'bright', name: 'Harvest Moon' },
  { id: 'm08-2', month: 8, monthName: 'Aug', flower: 'Pampas', type: 'animal', name: 'Wild Geese' },
  { id: 'm08-3', month: 8, monthName: 'Aug', flower: 'Pampas', type: 'chaff', name: 'Pampas Chaff 1' },
  { id: 'm08-4', month: 8, monthName: 'Aug', flower: 'Pampas', type: 'chaff', name: 'Pampas Chaff 2' },

  // Sep - Chrysanthemum (Kiku)
  { id: 'm09-1', month: 9, monthName: 'Sep', flower: 'Chrysanth.', type: 'animal', isCup: true, name: 'Poetry Sake Cup' },
  { id: 'm09-2', month: 9, monthName: 'Sep', flower: 'Chrysanth.', type: 'ribbon', ribbonType: 'aotan', name: 'Chrysanth. Blue Ribbon' },
  { id: 'm09-3', month: 9, monthName: 'Sep', flower: 'Chrysanth.', type: 'chaff', name: 'Chrysanth. Chaff 1' },
  { id: 'm09-4', month: 9, monthName: 'Sep', flower: 'Chrysanth.', type: 'chaff', name: 'Chrysanth. Chaff 2' },

  // Oct - Maple (Momiji)
  { id: 'm10-1', month: 10, monthName: 'Oct', flower: 'Maple', type: 'animal', name: 'Stag under Maple' },
  { id: 'm10-2', month: 10, monthName: 'Oct', flower: 'Maple', type: 'ribbon', ribbonType: 'aotan', name: 'Maple Blue Ribbon' },
  { id: 'm10-3', month: 10, monthName: 'Oct', flower: 'Maple', type: 'chaff', name: 'Maple Chaff 1' },
  { id: 'm10-4', month: 10, monthName: 'Oct', flower: 'Maple', type: 'chaff', name: 'Maple Chaff 2' },

  // Nov - Willow (Yanagi)
  { id: 'm11-1', month: 11, monthName: 'Nov', flower: 'Willow', type: 'bright', isRainman: true, name: 'Rainman under Willow' },
  { id: 'm11-2', month: 11, monthName: 'Nov', flower: 'Willow', type: 'animal', name: 'Swallow in Flight' },
  { id: 'm11-3', month: 11, monthName: 'Nov', flower: 'Willow', type: 'ribbon', ribbonType: 'plain', name: 'Willow Ribbon' },
  { id: 'm11-4', month: 11, monthName: 'Nov', flower: 'Willow', type: 'chaff', name: 'Lightning & Rain' },

  // Dec - Paulownia (Kiri)
  { id: 'm12-1', month: 12, monthName: 'Dec', flower: 'Paulownia', type: 'bright', name: 'Chinese Phoenix' },
  { id: 'm12-2', month: 12, monthName: 'Dec', flower: 'Paulownia', type: 'chaff', name: 'Paulownia Yellow Chaff' },
  { id: 'm12-3', month: 12, monthName: 'Dec', flower: 'Paulownia', type: 'chaff', name: 'Paulownia Chaff 1' },
  { id: 'm12-4', month: 12, monthName: 'Dec', flower: 'Paulownia', type: 'chaff', name: 'Paulownia Chaff 2' },
];

export interface YakuResult {
  name: string;
  points: number;
}

export const evaluateYaku = (captured: HanafudaCard[]): { total: number; yakus: YakuResult[] } => {
  const yakus: YakuResult[] = [];

  const brights = captured.filter((c) => c.type === 'bright');
  const animals = captured.filter((c) => c.type === 'animal');
  const ribbons = captured.filter((c) => c.type === 'ribbon');
  const chaff = captured.filter((c) => c.type === 'chaff');

  const hasCup = captured.some((c) => c.isCup);
  const hasMoon = captured.some((c) => c.id === 'm08-1');
  const hasCurtain = captured.some((c) => c.id === 'm03-1');
  const hasRainman = captured.some((c) => c.isRainman);

  // 1. Brights (Hikari)
  if (brights.length === 5) {
    yakus.push({ name: 'Five Brights (Goko)', points: 10 });
  } else if (brights.length === 4) {
    if (hasRainman) {
      yakus.push({ name: 'Rainy Four (Ame-Shiko)', points: 7 });
    } else {
      yakus.push({ name: 'Four Brights (Shiko)', points: 8 });
    }
  } else if (brights.length === 3 && !hasRainman) {
    yakus.push({ name: 'Three Brights (Sanko)', points: 5 });
  }

  // 2. Viewing Yaku (Hanami & Tsukimi)
  if (hasMoon && hasCup) {
    yakus.push({ name: 'Moon Viewing (Tsukimi-zake)', points: 5 });
  }
  if (hasCurtain && hasCup) {
    yakus.push({ name: 'Cherry Viewing (Hanami-zake)', points: 5 });
  }

  // 3. Inoshikacho (Boar-Deer-Butterfly)
  const hasBoar = captured.some((c) => c.id === 'm07-1');
  const hasDeer = captured.some((c) => c.id === 'm10-1');
  const hasButterfly = captured.some((c) => c.id === 'm06-1');
  if (hasBoar && hasDeer && hasButterfly) {
    yakus.push({ name: 'Boar-Deer-Butterfly (Inoshikacho)', points: 5 });
  }

  // 4. Ribbons
  const akatan = ribbons.filter((r) => r.ribbonType === 'akatan');
  const aotan = ribbons.filter((r) => r.ribbonType === 'aotan');
  if (akatan.length === 3) {
    yakus.push({ name: 'Red Poetry Ribbons (Akatan)', points: 5 });
  }
  if (aotan.length === 3) {
    yakus.push({ name: 'Blue Ribbons (Aotan)', points: 5 });
  }
  if (ribbons.length >= 5) {
    yakus.push({ name: `Ribbons (${ribbons.length})`, points: 1 + (ribbons.length - 5) });
  }

  // 5. Animals (Tane)
  if (animals.length >= 5) {
    yakus.push({ name: `Animals (${animals.length})`, points: 1 + (animals.length - 5) });
  }

  // 6. Chaff (Kasu)
  if (chaff.length >= 10) {
    yakus.push({ name: `Plain Chaff (${chaff.length})`, points: 1 + (chaff.length - 10) });
  }

  const total = yakus.reduce((sum, y) => sum + y.points, 0);
  return { total, yakus };
};

// Procedural SVG Card Graphic
export const HanafudaCardView: React.FC<{
  card: HanafudaCard;
  isSelected?: boolean;
  isMatched?: boolean;
  onClick?: () => void;
  small?: boolean;
}> = ({ card, isSelected, isMatched, onClick, small = false }) => {
  const flowerColorMap: Record<string, string> = {
    Pine: '#15803d',
    Plum: '#f43f5e',
    Cherry: '#fda4af',
    Wisteria: '#818cf8',
    Iris: '#6366f1',
    Peony: '#ec4899',
    Clover: '#a855f7',
    Pampas: '#ca8a04',
    'Chrysanth.': '#eab308',
    Maple: '#ea580c',
    Willow: '#059669',
    Paulownia: '#7c3aed',
  };

  const badgeColor =
    card.type === 'bright'
      ? 'bg-amber-400 text-black'
      : card.type === 'animal'
      ? 'bg-orange-500 text-white'
      : card.type === 'ribbon'
      ? card.ribbonType === 'aotan'
        ? 'bg-blue-600 text-white'
        : 'bg-rose-600 text-white'
      : 'bg-stone-600 text-stone-200';

  const w = small ? 'w-10 sm:w-12 h-14 sm:h-17' : 'w-13 sm:w-16 md:w-18 h-18 sm:h-23 md:h-26';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative ${w} rounded-lg select-none transition-all duration-150 transform cursor-pointer ${
        isSelected
          ? 'ring-3 ring-amber-400 scale-108 -translate-y-2 z-20 shadow-xl'
          : isMatched
          ? 'ring-2 ring-emerald-400 animate-pulse scale-104 shadow-lg'
          : 'hover:scale-103 shadow-md active:scale-95'
      }`}
      style={{
        background: '#881337', // Deep lacquer red edge
        padding: '2.5px',
      }}
    >
      {/* Off-White Card Face Inlay */}
      <div className="w-full h-full rounded-md bg-[#fffdfa] border border-[#d6d3d1] flex flex-col justify-between p-1 relative overflow-hidden shadow-inner">
        {/* Top Header: Flower & Month */}
        <div className="flex items-center justify-between z-10">
          <span className="text-[9px] font-black text-stone-800 leading-none">
            {card.month}月
          </span>
          <span
            className="text-[7px] font-extrabold uppercase px-1 rounded-sm tracking-tighter"
            style={{
              backgroundColor: `${flowerColorMap[card.flower] || '#78716c'}25`,
              color: flowerColorMap[card.flower] || '#44403c',
            }}
          >
            {card.flower.slice(0, 4)}
          </span>
        </div>

        {/* Center Graphic */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {card.type === 'bright' && (
            <div className="w-6 h-6 rounded-full bg-red-600/90 shadow-sm flex items-center justify-center text-white text-[9px] font-black">
              光
            </div>
          )}
          {card.type === 'animal' && (
            <div className="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-600/30 flex items-center justify-center text-amber-700 text-[10px]">
              {card.isCup ? '🍶' : '🐾'}
            </div>
          )}
          {card.type === 'ribbon' && (
            <div
              className={`w-6 h-2 rounded-xs shadow-xs ${
                card.ribbonType === 'aotan' ? 'bg-indigo-600' : 'bg-rose-600'
              }`}
            />
          )}
          {card.type === 'chaff' && (
            <div
              className="w-4 h-4 rounded-full opacity-60"
              style={{ backgroundColor: flowerColorMap[card.flower] || '#a8a29e' }}
            />
          )}
        </div>

        {/* Bottom Tag */}
        <div className="flex items-center justify-between z-10">
          <span className={`text-[7px] font-bold px-1 rounded-xs uppercase ${badgeColor}`}>
            {card.type === 'bright'
              ? 'Hikari'
              : card.type === 'animal'
              ? 'Tane'
              : card.type === 'ribbon'
              ? 'Tan'
              : 'Kasu'}
          </span>
        </div>

        {/* Gloss Sheen */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-white/40 pointer-events-none" />
      </div>
    </button>
  );
};

export const Hanafuda: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  const [deck, setDeck] = useState<HanafudaCard[]>([]);
  const [handP1, setHandP1] = useState<HanafudaCard[]>([]);
  const [handP2, setHandP2] = useState<HanafudaCard[]>([]);
  const [field, setField] = useState<HanafudaCard[]>([]);
  const [capturedP1, setCapturedP1] = useState<HanafudaCard[]>([]);
  const [capturedP2, setCapturedP2] = useState<HanafudaCard[]>([]);

  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [selectedHandCard, setSelectedHandCard] = useState<HanafudaCard | null>(null);
  const [activeStep, setActiveStep] = useState<'hand' | 'deck' | 'koi_decision'>('hand');
  const [drawnDeckCard, setDrawnDeckCard] = useState<HanafudaCard | null>(null);

  const [p1Score, setP1Score] = useState<number>(0);
  const [p2Score, setP2Score] = useState<number>(0);
  const [koiKoiCalled, setKoiKoiCalled] = useState<{ p1: boolean; p2: boolean }>({ p1: false, p2: false });
  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Select a card from your hand to match or discard.');
  const [winner, setWinner] = useState<PlayerNumber | null>(null);

  // Initialize Game
  const resetGame = useCallback(() => {
    const shuffled = [...HANAFUDA_DECK].sort(() => Math.random() - 0.5);

    const p1 = shuffled.slice(0, 8);
    const p2 = shuffled.slice(8, 16);
    const fld = shuffled.slice(16, 24);
    const remainingDeck = shuffled.slice(24);

    setDeck(remainingDeck);
    setHandP1(p1);
    setHandP2(p2);
    setField(fld);
    setCapturedP1([]);
    setCapturedP2([]);
    setTurn(1);
    setSelectedHandCard(null);
    setActiveStep('hand');
    setDrawnDeckCard(null);
    setKoiKoiCalled({ p1: false, p2: false });
    setWinner(null);
    setStatusMessage('Player 1: Select a card from your hand to match or discard.');
    setGameStatus('active');
  }, [setGameStatus]);

  // Initial deal
  useState(() => {
    resetGame();
  });

  const activeHand = turn === 1 ? handP1 : handP2;
  const activeCaptured = turn === 1 ? capturedP1 : capturedP2;

  // Evaluate active player Yaku
  const p1Yaku = useMemo(() => evaluateYaku(capturedP1), [capturedP1]);
  const p2Yaku = useMemo(() => evaluateYaku(capturedP2), [capturedP2]);
  const currentYaku = turn === 1 ? p1Yaku : p2Yaku;

  // Matching field cards for selected card
  const getMatchingFieldCards = (card: HanafudaCard | null): HanafudaCard[] => {
    if (!card) return [];
    return field.filter((f) => f.month === card.month);
  };

  // Turn Progression Helper
  const completeTurn = useCallback(() => {
    const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;

    // Check if hands empty -> round over
    if (handP1.length === 0 && handP2.length === 0) {
      if (p1Score > p2Score) setWinner(1);
      else if (p2Score > p1Score) setWinner(2);
      else setWinner(p1Yaku.total >= p2Yaku.total ? 1 : 2);
      setStatusMessage('Round complete! Both hands exhausted.');
      return;
    }

    setTurn(nextPlayer);
    setActiveStep('hand');
    setSelectedHandCard(null);
    setDrawnDeckCard(null);
    setStatusMessage(`Player ${nextPlayer}: Select a card from hand to play.`);
  }, [turn, handP1, handP2, p1Score, p2Score, p1Yaku, p2Yaku]);

  // Step 2: Draw from Deck and Match/Discard
  const resolveDeckDraw = useCallback(
    (deckRemaining: HanafudaCard[], currentField: HanafudaCard[]) => {
      if (deckRemaining.length === 0) {
        completeTurn();
        return;
      }

      const [topCard, ...nextDeck] = deckRemaining;
      setDeck(nextDeck);
      setDrawnDeckCard(topCard);
      playHanafudaSnapSound();
      triggerHaptic('light');

      const matches = currentField.filter((f) => f.month === topCard.month);

      if (matches.length > 0) {
        // Automatically capture matched card (first matching)
        const target = matches[0];
        const updatedField = currentField.filter((f) => f.id !== target.id);
        setField(updatedField);

        const newCaptures = [topCard, target];
        playCaptureSound();
        triggerHaptic('medium');

        if (turn === 1) {
          setCapturedP1((prev) => [...prev, ...newCaptures]);
        } else {
          setCapturedP2((prev) => [...prev, ...newCaptures]);
        }

        setStatusMessage(`Player ${turn} drew ${topCard.name} & matched ${target.name}!`);

        // Check if new Yaku formed
        const updatedCaptures = [...activeCaptured, ...newCaptures];
        const evaluated = evaluateYaku(updatedCaptures);
        if (evaluated.total > 0) {
          setActiveStep('koi_decision');
          setStatusMessage(`Player ${turn} formed Yaku! (${evaluated.total} pts) Decide: Stop or Koi-Koi?`);
          return;
        }
      } else {
        // No match -> place on field
        setField([...currentField, topCard]);
        setStatusMessage(`Player ${turn} drew ${topCard.name} and placed it on the field.`);
      }

      setTimeout(() => {
        completeTurn();
      }, 1000);
    },
    [turn, activeCaptured, completeTurn]
  );

  // Step 1: Play from Hand
  const handleHandCardClick = (card: HanafudaCard) => {
    if (activeStep !== 'hand') return;
    playHanafudaSnapSound();
    triggerHaptic('light');

    if (selectedHandCard?.id === card.id) {
      setSelectedHandCard(null);
      return;
    }

    setSelectedHandCard(card);

    const matches = getMatchingFieldCards(card);
    if (matches.length > 0) {
      setStatusMessage(`Tap the matching ${card.flower} card on the field to capture!`);
    } else {
      setStatusMessage(`No match on field. Tap "Place on Field" to discard.`);
    }
  };

  // Confirm Hand Match / Discard
  const handleFieldCardClick = (fieldCard: HanafudaCard) => {
    if (activeStep !== 'hand' || !selectedHandCard) return;

    // Must match month
    if (fieldCard.month !== selectedHandCard.month) {
      triggerHaptic('medium');
      return;
    }

    // Capture pair!
    playCaptureSound();
    triggerHaptic('medium');

    const updatedHand = activeHand.filter((c) => c.id !== selectedHandCard.id);
    const updatedField = field.filter((f) => f.id !== fieldCard.id);
    const newCaptures = [selectedHandCard, fieldCard];

    if (turn === 1) {
      setHandP1(updatedHand);
      setCapturedP1((prev) => [...prev, ...newCaptures]);
    } else {
      setHandP2(updatedHand);
      setCapturedP2((prev) => [...prev, ...newCaptures]);
    }

    setSelectedHandCard(null);
    setActiveStep('deck');
    setStatusMessage(`Player ${turn} captured ${selectedHandCard.name} & ${fieldCard.name}! Drawing from deck...`);

    setTimeout(() => {
      resolveDeckDraw(deck, updatedField);
    }, 800);
  };

  // Discard unmatched hand card to field
  const handleDiscardToField = () => {
    if (activeStep !== 'hand' || !selectedHandCard) return;

    playHanafudaSnapSound();
    triggerHaptic('light');

    const updatedHand = activeHand.filter((c) => c.id !== selectedHandCard.id);
    const updatedField = [...field, selectedHandCard];

    if (turn === 1) setHandP1(updatedHand);
    else setHandP2(updatedHand);

    setSelectedHandCard(null);
    setActiveStep('deck');
    setStatusMessage(`Player ${turn} placed ${selectedHandCard.name} on the field. Drawing from deck...`);

    setTimeout(() => {
      resolveDeckDraw(deck, updatedField);
    }, 800);
  };

  // Push-Your-Luck Decision
  const handleDecision = (decision: 'stop' | 'koi') => {
    triggerHaptic('success');
    if (decision === 'stop') {
      playVictorySound();
      const points = currentYaku.total;
      if (turn === 1) setP1Score((prev) => prev + points);
      else setP2Score((prev) => prev + points);

      setWinner(turn);
      setStatusMessage(`Player ${turn} called STOP and won the round with ${points} points!`);
    } else {
      // Koi-Koi
      playHanafudaSnapSound();
      setKoiKoiCalled((prev) => ({
        ...prev,
        [turn === 1 ? 'p1' : 'p2']: true,
      }));
      setStatusMessage(`Player ${turn} called KOI-KOI! Seeking higher points...`);
      setTimeout(() => {
        completeTurn();
      }, 900);
    }
  };

  const matchingFieldIds = useMemo(() => {
    return new Set(getMatchingFieldCards(selectedHandCard).map((c) => c.id));
  }, [selectedHandCard, field]);

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="hanafuda"
        gameName="Hanafuda (Koi-Koi)"
        turn={turn}
        statusText={`Player ${turn}'s Turn`}
        subStatusText={statusMessage}
      />

      {/* Main Mat Arena - Responsive scaling */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-between p-2 sm:p-3 overflow-hidden w-full max-w-4xl mx-auto">
        {/* Scoreboard & Opponent Hand Preview */}
        <div className="w-full flex items-center justify-between px-3 py-1.5 bg-black/60 border border-[#3e444c] rounded-2xl shadow-md shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-player-1" />
            <span className={`text-xs font-black ${turn === 1 ? 'text-player-1' : 'text-stone-400'}`}>
              P1: {p1Score} pts ({capturedP1.length} cards)
            </span>
            {koiKoiCalled.p1 && (
              <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-black uppercase">
                Koi-Koi!
              </span>
            )}
          </div>

          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
            Deck: {deck.length}
          </div>

          <div className="flex items-center gap-2">
            {koiKoiCalled.p2 && (
              <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-black uppercase">
                Koi-Koi!
              </span>
            )}
            <span className={`text-xs font-black ${turn === 2 ? 'text-player-2' : 'text-stone-400'}`}>
              P2: {p2Score} pts ({capturedP2.length} cards)
            </span>
            <span className="w-3 h-3 rounded-full bg-player-2" />
          </div>
        </div>

        {/* Central Field (Baize Cloth Mat) */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center py-1">
          <div className="w-full h-full max-h-[46vh] bg-[#0f3d21] rounded-3xl border-4 border-[#3e1f0c] shadow-2xl p-2.5 sm:p-3 flex flex-col justify-between relative overflow-hidden clubhouse-board-depth">
            {/* Field Header */}
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-emerald-300/80 px-1">
              <span>Center Field ({field.length} Cards)</span>
              {drawnDeckCard && (
                <span className="text-amber-300 animate-pulse">
                  Drawn: {drawnDeckCard.name} ({drawnDeckCard.month}月)
                </span>
              )}
            </div>

            {/* Field Cards Grid */}
            <div className="flex-1 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 sm:gap-2 items-center justify-items-center overflow-y-auto p-1">
              {field.map((card) => {
                const isMatched = matchingFieldIds.has(card.id);
                return (
                  <HanafudaCardView
                    key={card.id}
                    card={card}
                    isMatched={isMatched}
                    onClick={isMatched ? () => handleFieldCardClick(card) : undefined}
                  />
                );
              })}
            </div>

            {/* In-Field Action Strip */}
            {selectedHandCard && matchingFieldIds.size === 0 && activeStep === 'hand' && (
              <div className="flex justify-center mt-1 z-20">
                <button
                  type="button"
                  onClick={handleDiscardToField}
                  className="px-4 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
                >
                  Place {selectedHandCard.flower} on Field
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Koi-Koi Push-Your-Luck Decision Modal/Banner */}
        {activeStep === 'koi_decision' && (
          <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 border border-amber-300 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 my-1 animate-bounce">
            <div className="flex items-center gap-2 text-stone-950">
              <span className="text-lg">🎉</span>
              <div>
                <span className="font-black text-xs uppercase block">Yaku Achieved!</span>
                <span className="text-[11px] font-bold">
                  {currentYaku.yakus.map((y) => `${y.name} (${y.points}p)`).join(', ')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDecision('stop')}
                className="px-4 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-900 text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all"
              >
                🛑 STOP & Score ({currentYaku.total}p)
              </button>
              <button
                type="button"
                onClick={() => handleDecision('koi')}
                className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all"
              >
                🔥 KOI-KOI! (Continue)
              </button>
            </div>
          </div>
        )}

        {/* Active Player Hand */}
        <div className="w-full flex flex-col items-center shrink-0 px-1">
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-stone-300 mb-1 px-2">
            <span>
              Player {turn}'s Hand ({activeHand.length} cards)
            </span>
            {selectedHandCard && (
              <span className="text-amber-400 font-black">
                Selected: {selectedHandCard.name} ({selectedHandCard.month}月)
              </span>
            )}
          </div>

          <div className="w-full flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto py-1 px-2">
            {activeHand.map((card) => (
              <HanafudaCardView
                key={card.id}
                card={card}
                isSelected={selectedHandCard?.id === card.id}
                onClick={activeStep === 'hand' ? () => handleHandCardClick(card) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Captured Cards Overview Bar */}
        <div className="w-full flex items-center justify-between px-3 py-1 bg-black/40 rounded-xl border border-white/10 text-[10px] font-semibold text-stone-400 shrink-0 mt-1">
          <div className="flex gap-2">
            <span>P1 Brights: {capturedP1.filter((c) => c.type === 'bright').length}</span>
            <span>Animals: {capturedP1.filter((c) => c.type === 'animal').length}</span>
            <span>Ribbons: {capturedP1.filter((c) => c.type === 'ribbon').length}</span>
            <span>Chaff: {capturedP1.filter((c) => c.type === 'chaff').length}</span>
          </div>
          <div className="flex gap-2">
            <span>P2 Brights: {capturedP2.filter((c) => c.type === 'bright').length}</span>
            <span>Animals: {capturedP2.filter((c) => c.type === 'animal').length}</span>
            <span>Ribbons: {capturedP2.filter((c) => c.type === 'ribbon').length}</span>
            <span>Chaff: {capturedP2.filter((c) => c.type === 'chaff').length}</span>
          </div>
        </div>
      </main>

      {/* Victory Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Hanafuda (Koi-Koi)"
          stats={[
            { label: 'Player 1 Score', p1Value: `${p1Score} pts`, p2Value: '-' },
            { label: 'Player 2 Score', p1Value: '-', p2Value: `${p2Score} pts` },
            {
              label: 'Winning Yaku',
              p1Value: winner === 1 ? currentYaku.yakus.map((y) => y.name).join(', ') : '-',
              p2Value: winner === 2 ? currentYaku.yakus.map((y) => y.name).join(', ') : '-',
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
