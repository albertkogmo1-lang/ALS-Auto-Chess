import React from 'react';
import { PieceType } from '../state/machine';

interface PieceTrayProps {
  pieces: PieceType[];
  onSelectPiece: (piece: PieceType) => void;
  selectedPiece: PieceType | null;
  label?: string;
}

const PIECE_UNICODE: Record<string, string> = {
  'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔',
};

const PIECE_NAMES: Record<string, string> = {
  'p': 'Pawn', 'r': 'Rook', 'n': 'Knight', 'b': 'Bishop', 'q': 'Queen', 'k': 'King',
};

export const PieceTray: React.FC<PieceTrayProps> = ({ pieces, onSelectPiece, selectedPiece, label }) => {
  // Count pieces
  const counts: Record<PieceType, number> = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };
  for (const p of pieces) counts[p]++;

  const uniquePieces = (Object.entries(counts).filter(([_, count]) => count > 0) as [PieceType, number][]);

  return (
    <div className="bg-gray-800 rounded-lg p-3 shadow-lg">
      {label && <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">{label}</div>}
      <div className="flex flex-wrap gap-2">
        {uniquePieces.map(([type, count]) => (
          <button
            key={type}
            onClick={() => onSelectPiece(type)}
            className={`
              flex flex-col items-center p-2 rounded-lg transition-all
              ${selectedPiece === type 
                ? 'bg-indigo-600 ring-2 ring-indigo-400 scale-110' 
                : 'bg-gray-700 hover:bg-gray-600'}
            `}
          >
            <span className="text-2xl">{PIECE_UNICODE[type.toUpperCase()]}</span>
            <span className="text-[10px] text-gray-300 mt-0.5">{PIECE_NAMES[type]}</span>
            {count > 1 && (
              <span className="text-[10px] text-indigo-300 font-bold">×{count}</span>
            )}
          </button>
        ))}
      </div>
      {pieces.length === 0 && (
        <div className="text-gray-500 text-sm text-center py-2">All pieces placed ✓</div>
      )}
    </div>
  );
};
