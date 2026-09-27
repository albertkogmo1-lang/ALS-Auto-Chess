import React from 'react';
import { RoundResult } from '../state/machine';
import { getCommanderById } from '../engine/commanders';
import { formatEval } from '../engine/heuristic';

interface RoundRecapProps {
  result: RoundResult;
  onContinue: () => void;
}

export const RoundRecap: React.FC<RoundRecapProps> = ({ result, onContinue }) => {
  const whiteCmd = getCommanderById(result.whiteCommanderId);
  const blackCmd = getCommanderById(result.blackCommanderId);
  
  const winnerText = result.winner === 'w' ? 'White Wins!' : result.winner === 'b' ? 'Black Wins!' : 'Draw';
  const winnerColor = result.winner === 'w' ? 'text-white' : result.winner === 'b' ? 'text-gray-400' : 'text-yellow-400';

  // Simple eval graph
  const maxEval = Math.max(100, ...result.evalGraph.map(Math.abs));
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-700">
        <h2 className={`text-2xl font-bold text-center mb-4 ${winnerColor}`}>
          {winnerText}
        </h2>
        
        <div className="text-center text-gray-400 text-sm mb-4">
          {result.reason}
        </div>

        {/* Commanders */}
        <div className="flex justify-between mb-4">
          <div className="text-center">
            <div className="text-2xl mb-1">{whiteCmd?.icon}</div>
            <div className="text-xs text-gray-300">{whiteCmd?.name}</div>
            <div className="text-[10px] text-gray-500">(White)</div>
          </div>
          <div className="text-gray-500 self-center">vs</div>
          <div className="text-center">
            <div className="text-2xl mb-1">{blackCmd?.icon}</div>
            <div className="text-xs text-gray-300">{blackCmd?.name}</div>
            <div className="text-[10px] text-gray-500">(Black)</div>
          </div>
        </div>

        {/* Eval Graph */}
        <div className="bg-gray-900 rounded-lg p-3 mb-4">
          <div className="text-[10px] text-gray-500 mb-1">Evaluation Over Time</div>
          <div className="h-16 flex items-end gap-px">
            {result.evalGraph.slice(0, 60).map((eval_, i) => {
              const height = Math.abs(eval_) / maxEval * 100;
              const isPositive = eval_ >= 0;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t-sm ${isPositive ? 'bg-white/60' : 'bg-gray-500/60'}`}
                  style={{ height: `${Math.max(2, height)}%` }}
                  title={`Move ${i + 1}: ${formatEval(eval_)}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-gray-500">Start</span>
            <span className="text-[9px] text-gray-500">Final: {formatEval(result.finalEval)}</span>
          </div>
        </div>

        <button
          onClick={onContinue}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  );
};
