import React, { useState, useEffect } from 'react';
import { multiplayer, type ConnectionStatus } from '../utils/multiplayer';
import { triggerHaptic, playTapSound, playCaptureSound } from '../utils/feedback';

interface RemoteDuelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RemoteDuelModal: React.FC<RemoteDuelModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<ConnectionStatus>(multiplayer.getStatus());
  const [roomCode, setRoomCode] = useState<string>(multiplayer.getRoomCode());
  const [inputCode, setInputCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    return multiplayer.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setRoomCode(multiplayer.getRoomCode());
      if (newStatus === 'connected') {
        playCaptureSound();
        triggerHaptic('success');
      }
    });
  }, []);

  if (!isOpen) return null;

  const handleHost = async () => {
    triggerHaptic('medium');
    playTapSound();
    setErrorMsg('');
    try {
      await multiplayer.hostRoom();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to initialize host room');
    }
  };

  const handleJoin = async () => {
    if (!inputCode.trim()) return;
    triggerHaptic('medium');
    playTapSound();
    setErrorMsg('');
    try {
      await multiplayer.joinRoom(inputCode.trim());
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to connect to room');
    }
  };

  const handleCopy = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    triggerHaptic('light');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = () => {
    triggerHaptic('medium');
    multiplayer.disconnect();
    setInputCode('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="bg-[#24170e] border-2 border-amber-500/40 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl table-lifted text-amber-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌐</span>
            <h2 className="text-base font-black tracking-wide uppercase font-serif-classic text-amber-200">
              Remote Duel
            </h2>
          </div>
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            type="button"
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-amber-200 font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Live Status Indicator */}
        <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-black/40 border border-white/5 text-xs">
          <span className="font-semibold text-stone-300">Connection Status:</span>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status === 'connected'
                  ? 'bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse'
                  : status === 'waiting'
                  ? 'bg-amber-400 ring-2 ring-amber-400/40 animate-ping'
                  : status === 'connecting'
                  ? 'bg-blue-400 animate-pulse'
                  : 'bg-stone-500'
              }`}
            />
            <span className="font-bold uppercase tracking-wider text-[11px]">
              {status === 'connected'
                ? 'Connected'
                : status === 'waiting'
                ? 'Waiting for Player 2'
                : status === 'connecting'
                ? 'Connecting...'
                : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-500/30 px-3 py-2 rounded-xl text-center">
            {errorMsg}
          </div>
        )}

        {/* Body Content based on Status */}
        {status === 'connected' ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 text-2xl animate-bounce">
              ✓
            </div>
            <div className="text-center">
              <span className="text-sm font-black text-emerald-300">Device Paired!</span>
              <p className="text-xs text-stone-300 mt-1">
                You are playing as <strong className="text-amber-300">{multiplayer.isLocalHost() ? 'Player 1 (Host)' : 'Player 2 (Guest)'}</strong>.
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              type="button"
              className="w-full py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 active:scale-95 text-white font-bold text-xs transition-all shadow-md mt-2"
            >
              Disconnect Session
            </button>
          </div>
        ) : status === 'waiting' ? (
          <div className="flex flex-col items-center gap-3 py-3">
            <span className="text-xs text-stone-300">Share this Room Code with your friend:</span>
            <div className="flex items-center gap-2">
              <div className="px-5 py-2.5 rounded-2xl bg-black/60 border-2 border-amber-400 text-amber-300 font-mono-digital text-2xl font-black tracking-widest shadow-inner">
                {roomCode}
              </div>
              <button
                onClick={handleCopy}
                type="button"
                className="px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-900 font-black text-xs transition-all shadow-md"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <span className="text-[11px] text-amber-200/60 animate-pulse mt-1">
              Waiting for Player 2 to join...
            </span>
            <button
              onClick={handleDisconnect}
              type="button"
              className="mt-2 text-xs text-stone-400 hover:text-stone-200 underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-1">
            {/* Host Section */}
            <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wide font-serif-classic">
                Option 1: Host a Game
              </span>
              <p className="text-[11px] text-stone-300">
                Generate a 4-digit room code for your opponent to join.
              </p>
              <button
                onClick={handleHost}
                disabled={status === 'connecting'}
                type="button"
                className="w-full py-2.5 mt-1 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-95 text-stone-950 font-black text-xs tracking-wider uppercase transition-all shadow-md disabled:opacity-50"
              >
                Create Room
              </button>
            </div>

            {/* Join Section */}
            <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wide font-serif-classic">
                Option 2: Join a Game
              </span>
              <p className="text-[11px] text-stone-300">
                Enter the 4-digit code provided by the host.
              </p>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 4921"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-black/60 border border-amber-500/40 rounded-xl px-3 py-2 text-center text-amber-200 font-mono-digital font-bold text-sm tracking-widest focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleJoin}
                  disabled={inputCode.length < 4 || status === 'connecting'}
                  type="button"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-xs tracking-wider uppercase transition-all shadow-md disabled:opacity-50"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
