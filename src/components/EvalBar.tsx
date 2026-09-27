import React from 'react';
import { formatEval } from '../engine/heuristic';

interface EvalBarProps {
  eval: number; // centipawns from white's perspective
  label: string;
  locked?: boolean;
}

export const EvalBar: React.FC<EvalBarProps> = ({ eval: evalCp, label, locked = false }) => {
  // Convert eval to percentage (clamp between 0 and 100)
  const normalized = Math.max(-1000, Math.min(1000, evalCp));
  const whitePercent = locked ? 50 : 50 + (normalized / 1000) * 45; // 50/50 when locked

  if (locked) {
    return (
      <div className="flex flex-col items-center h-full">
        <div className="text-[10px] text-gray-500 mb-1 text-center font-medium uppercase tracking-wider">
          {label}
        </div>
        <div className="relative w-6 flex-1 bg-gray-800 rounded-full overflow-hidden border border-gray-600">
          {/* Show neutral 50/50 bar when locked */}
          <div className="absolute bottom-0 w-full bg-gray-900" style={{ height: '50%' }} />
          <div className="absolute top-0 w-full bg-white/50" style={{ height: '50%' }} />
          <div className="absolute top-1/2 w-full h-px bg-gray-500" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-[9px] text-gray-400">🔒</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center h-full">
      <div className="text-[10px] text-gray-400 mb-1 text-center font-medium uppercase tracking-wider">
        {label}
      </div>
      <div className="relative w-6 flex-1 bg-gray-800 rounded-full overflow-hidden border border-gray-600">
        {/* Black portion (bottom) */}
        <div className="absolute bottom-0 w-full bg-gray-900" style={{ height: `${100 - whitePercent}%` }} />
        {/* White portion (top) */}
        <div 
          className="absolute top-0 w-full bg-white transition-all duration-500 ease-out"
          style={{ height: `${whitePercent}%` }}
        />
        {/* Center line */}
        <div className="absolute top-1/2 w-full h-px bg-gray-500" />
        {/* Eval number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[9px] font-bold px-0.5 rounded ${
            evalCp > 50 ? 'text-gray-800 bg-white/80' : 
            evalCp < -50 ? 'text-white bg-gray-900/80' : 
            'text-gray-300'
          }`}>
            {formatEval(evalCp)}
          </span>
        </div>
      </div>
    </div>
  );
};
