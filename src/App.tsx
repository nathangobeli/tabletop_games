import React, { Suspense } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { MainMenu } from './components/MainMenu';
import { TouchRippleOverlay } from './components/TouchRippleOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';

// Dynamic Code-Splitting: Lazy-load individual tabletop titles on-demand
const Mancala = React.lazy(() => import('./games/Mancala').then((m) => ({ default: m.Mancala })));
const ConnectFour = React.lazy(() => import('./games/ConnectFour').then((m) => ({ default: m.ConnectFour })));
const DotsAndBoxes = React.lazy(() => import('./games/DotsAndBoxes').then((m) => ({ default: m.DotsAndBoxes })));
const Renegade = React.lazy(() => import('./games/Renegade').then((m) => ({ default: m.Renegade })));
const YachtDice = React.lazy(() => import('./games/YachtDice').then((m) => ({ default: m.YachtDice })));
const Speed = React.lazy(() => import('./games/Speed').then((m) => ({ default: m.Speed })));
const AirHockey = React.lazy(() => import('./games/AirHockey').then((m) => ({ default: m.AirHockey })));
const ToyTennis = React.lazy(() => import('./games/ToyTennis').then((m) => ({ default: m.ToyTennis })));
const Carrom = React.lazy(() => import('./games/Carrom').then((m) => ({ default: m.Carrom })));
const Gomoku = React.lazy(() => import('./games/Gomoku').then((m) => ({ default: m.Gomoku })));
const Checkers = React.lazy(() => import('./games/Checkers').then((m) => ({ default: m.Checkers })));
const Backgammon = React.lazy(() => import('./games/Backgammon').then((m) => ({ default: m.Backgammon })));
const Billiards = React.lazy(() => import('./games/Billiards').then((m) => ({ default: m.Billiards })));
const Darts = React.lazy(() => import('./games/Darts').then((m) => ({ default: m.Darts })));
const Bowling = React.lazy(() => import('./games/Bowling').then((m) => ({ default: m.Bowling })));
const MiniShogi = React.lazy(() => import('./games/MiniShogi').then((m) => ({ default: m.MiniShogi })));
const ToyCurling = React.lazy(() => import('./games/ToyCurling').then((m) => ({ default: m.ToyCurling })));
const Hex = React.lazy(() => import('./games/Hex').then((m) => ({ default: m.Hex })));
const Matching = React.lazy(() => import('./games/Matching').then((m) => ({ default: m.Matching })));
const NineMensMorris = React.lazy(() => import('./games/NineMensMorris').then((m) => ({ default: m.NineMensMorris })));
const HareAndHounds = React.lazy(() => import('./games/HareAndHounds').then((m) => ({ default: m.HareAndHounds })));
const HitAndBlow = React.lazy(() => import('./games/HitAndBlow').then((m) => ({ default: m.HitAndBlow })));
const Hanafuda = React.lazy(() => import('./games/Hanafuda').then((m) => ({ default: m.Hanafuda })));
const President = React.lazy(() => import('./games/President').then((m) => ({ default: m.President })));
const LastCard = React.lazy(() => import('./games/LastCard').then((m) => ({ default: m.LastCard })));
const RiichiMahjong = React.lazy(() => import('./games/RiichiMahjong').then((m) => ({ default: m.RiichiMahjong })));

/**
 * Tactile procedural loading fallback matching clubhouse wood aesthetic
 */
const GameLoadingFallback: React.FC = () => (
  <div className="w-full h-full flex flex-col items-center justify-center p-6 select-none">
    <div className="bg-[#2a1a0e]/85 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 flex flex-col items-center gap-4 shadow-2xl table-lifted backdrop-blur-sm animate-pulse">
      <div className="relative w-14 h-14 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
        <div className="w-7 h-7 rounded-lg bg-amber-500/30 flex items-center justify-center text-amber-200 text-xs font-black shadow-inner">
          🎲
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-amber-100 font-bold tracking-wide text-sm sm:text-base">Setting Up Table...</span>
        <span className="text-amber-300/70 text-xs">Loading game assets</span>
      </div>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const { activeGame, theme, resetToMenu } = useGame();

  const renderActiveGame = () => {
    switch (activeGame) {
      case 'mancala':
        return <Mancala />;
      case 'connect-four':
        return <ConnectFour />;
      case 'dots-and-boxes':
        return <DotsAndBoxes />;
      case 'renegade':
        return <Renegade />;
      case 'yacht-dice':
        return <YachtDice />;
      case 'speed':
        return <Speed />;
      case 'air-hockey':
        return <AirHockey />;
      case 'toy-tennis':
        return <ToyTennis />;
      case 'carrom':
        return <Carrom />;
      case 'gomoku':
        return <Gomoku />;
      case 'checkers':
        return <Checkers />;
      case 'backgammon':
        return <Backgammon />;
      case 'billiards':
        return <Billiards />;
      case 'darts':
        return <Darts />;
      case 'bowling':
        return <Bowling />;
      case 'mini-shogi':
        return <MiniShogi />;
      case 'toy-curling':
        return <ToyCurling />;
      case 'hex':
        return <Hex />;
      case 'matching':
        return <Matching />;
      case 'nine-mens-morris':
        return <NineMensMorris />;
      case 'hare-and-hounds':
        return <HareAndHounds />;
      case 'hit-and-blow':
        return <HitAndBlow />;
      case 'hanafuda':
        return <Hanafuda />;
      case 'president':
        return <President />;
      case 'last-card':
        return <LastCard />;
      case 'riichi-mahjong':
        return <RiichiMahjong />;
      default:
        return <MainMenu />;
    }
  };

  return (
    <div className={`relative w-screen h-dvh min-h-dvh overflow-hidden theme-${theme} flex flex-col select-none transition-colors duration-300 bg-primary-bg`}>
      <TouchRippleOverlay />
      {/* Screen slide transition wrapper with dynamic Suspense fallback and Error Boundary */}
      <div key={activeGame || 'menu'} className="w-full h-full min-h-0 flex-1 flex flex-col overflow-hidden">
        <ErrorBoundary onReset={resetToMenu}>
          <Suspense fallback={<GameLoadingFallback />}>
            {renderActiveGame()}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
};

export function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
