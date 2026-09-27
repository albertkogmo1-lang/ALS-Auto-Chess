import React from 'react';
import { RoundResult } from '../state/machine';
import { getCommanderById } from '../engine/commanders';

interface RoundTrackerProps {
  currentRound: number;
  totalRounds: number;
  scores: { playerA: number; playerB: number };
  roundResults: RoundResult[];
}

export const RoundTracker: React.FC<RoundTrackerProps> = ({
  currentRound,
  totalRounds,
  scores,
  roundResults,
}) => {
  return (
    <div className="bg-gray-800/80 rounded-lg p-3 backdrop-blur">
      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Match Score</div>
      
      {/* Score display */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-center">
          <div className="text-xs text-gray-400">Player A</div>
          <div className="text-2xl font-bold text-white">{scores.playerA}</div>
        </div>
        <div className="text-gray-500 text-sm">vs</div>
        <div className="text-center">
          <div className="text-xs text-gray-400">Player B</div>
          <div className="text-2xl font-bold text-white">{scores.playerB}</div>
        </div>
      </div>

      {/* Round indicators */}
      <div className="flex gap-1 justify-center">
        {Array.from({ length: totalRounds }, (_, i) => {
          const round = i + 1;
          const result = roundResults.find(r => r.round === round);
          const isCurrent = round === currentRound;
          
          let bgClass = 'bg-gray-700';
          let textClass = 'text-gray-400';
          let icon = round.toString();
          
          if (result) {
            if (result.winner === 'w') {
              bgClass = 'bg-white/20';
              textClass = 'text-white';
              icon = 'W';
            } else if (result.winner === 'b') {
              bgClass = 'bg-gray-900';
              textClass = 'text-gray-300';
              icon = 'B';
            } else {
              bgClass = 'bg-gray-600';
              textClass = 'text-gray-300';
              icon = '½';
            }
          }
          
          if (isCurrent && !result) {
            bgClass = 'bg-indigo-600';
            textClass = 'text-white';
          }

          return (
            <div
              key={round}
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                ${bgClass} ${textClass}
                ${isCurrent ? 'ring-2 ring-indigo-400' : ''}
              `}
              title={result ? `Round ${round}: ${result.reason} (${getCommanderById(result.whiteCommanderId)?.name || '?'} vs ${getCommanderById(result.blackCommanderId)?.name || '?'})` : `Round ${round}`}
            >
              {icon}
            </div>
          );
        })}
      </div>

      {/* Round results detail */}
      {roundResults.length > 0 && (
        <div className="mt-3 space-y-1">
          {roundResults.map((result) => (
            <div key={result.round} className="text-[10px] text-gray-400 flex justify-between">
              <span>R{result.round}: {result.reason}</span>
              <span className="text-gray-500">
                {getCommanderById(result.whiteCommanderId)?.icon} vs {getCommanderById(result.blackCommanderId)?.icon}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
