import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { MainMenu } from './components/MainMenu';
import { Mancala } from './games/Mancala';
import { ConnectFour } from './games/ConnectFour';
import { DotsAndBoxes } from './games/DotsAndBoxes';
import { Renegade } from './games/Renegade';
import { YachtDice } from './games/YachtDice';
import { Speed } from './games/Speed';
import { AirHockey } from './games/AirHockey';
import { ToyTennis } from './games/ToyTennis';
import { Carrom } from './games/Carrom';
import { Gomoku } from './games/Gomoku';
import { Checkers } from './games/Checkers';
import { Backgammon } from './games/Backgammon';
import { Billiards } from './games/Billiards';
import { Darts } from './games/Darts';
import { Bowling } from './games/Bowling';
import { MiniShogi } from './games/MiniShogi';
import { ToyCurling } from './games/ToyCurling';
import { Hex } from './games/Hex';
import { Matching } from './games/Matching';
import { NineMensMorris } from './games/NineMensMorris';
import { HareAndHounds } from './games/HareAndHounds';
import { HitAndBlow } from './games/HitAndBlow';
import { Hanafuda } from './games/Hanafuda';
import { President } from './games/President';
import { LastCard } from './games/LastCard';
import { RiichiMahjong } from './games/RiichiMahjong';
import { TouchRippleOverlay } from './components/TouchRippleOverlay';

const AppContent: React.FC = () => {
  const { activeGame } = useGame();

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
    <div className="relative w-screen h-screen overflow-hidden wood-table-bg flex flex-col justify-between select-none">
      <TouchRippleOverlay />
      {/* Screen slide transition wrapper */}
      <div key={activeGame || 'menu'} className="w-full h-full animate-fade-in flex flex-col justify-between">
        {renderActiveGame()}
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
