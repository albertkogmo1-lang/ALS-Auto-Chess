import React from 'react';
import { Commander, COMMANDERS } from '../engine/commanders';

interface CommanderRosterProps {
  usedCommanders: string[];
  selectedCommander?: string | null;
  onPick?: (id: string) => void;
  label: string;
  color: 'white' | 'black';
  disabled?: boolean;
  showStats?: boolean;
}

export const CommanderRoster: React.FC<CommanderRosterProps> = ({
  usedCommanders,
  selectedCommander,
  onPick,
  label,
  color,
  disabled = false,
  showStats = true,
}) => {
  return (
    <div className="bg-gray-800/80 rounded-lg p-3 backdrop-blur">
      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${color === 'white' ? 'bg-white' : 'bg-gray-500'}`} />
        {label}
      </div>
      <div className="space-y-1.5">
        {COMMANDERS.map((cmd) => {
          const isUsed = usedCommanders.includes(cmd.id);
          const isSelected = selectedCommander === cmd.id;
          const isAvailable = !isUsed && !disabled;

          return (
            <button
              key={cmd.id}
              onClick={() => isAvailable && onPick?.(cmd.id)}
              disabled={!isAvailable}
              className={`
                w-full text-left p-2 rounded-lg transition-all text-sm
                ${isSelected 
                  ? 'bg-indigo-600/80 ring-2 ring-indigo-400 shadow-lg shadow-indigo-500/20' 
                  : isUsed 
                    ? 'bg-gray-900/50 opacity-40 cursor-not-allowed' 
                    : isAvailable
                      ? 'bg-gray-700/60 hover:bg-gray-600/80 cursor-pointer'
                      : 'bg-gray-900/50 opacity-50 cursor-not-allowed'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-xs truncate">{cmd.name}</div>
                  {showStats && (
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-[9px] text-gray-400">
                        Depth:{cmd.depth}
                      </span>
                      <span className="text-[9px] text-gray-400">
                        Blunder:{Math.round(cmd.blunderRate * 100)}%
                      </span>
                      <span className="text-[9px] text-gray-400">
                        Agg:{Math.round(cmd.aggression * 100)}%
                      </span>
                    </div>
                  )}
                  {isSelected && (
                    <div className="text-[9px] text-indigo-200 mt-0.5 italic truncate">
                      {cmd.flavor}
                    </div>
                  )}
                </div>
                {isUsed && <span className="text-[10px] text-red-400">USED</span>}
                {isSelected && <span className="text-[10px] text-indigo-300">✓</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
