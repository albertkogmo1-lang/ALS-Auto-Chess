import React, { useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import { PlacedPiece, Color, PieceType } from '../state/machine';
import { isInZone } from '../rules/placement';

interface BoardProps {
  fen?: string;
  placement?: PlacedPiece[];
  placementColor?: Color;
  placementPhase?: 'pawns' | 'pieces';
  onPlacePiece?: (piece: PieceType, square: string) => void;
  selectedPiece?: PieceType | null;
  highlightZone?: Color;
  occupiedSquares?: Set<string>;
  lastMove?: { from: string; to: string } | null;
  flipped?: boolean;
  interactive?: boolean;
}

const PIECE_UNICODE: Record<string, string> = {
  'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
  'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟',
};

function coordsToSquare(row: number, col: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + col) + (8 - row);
}

export const Board: React.FC<BoardProps> = ({
  fen,
  placement,
  placementColor,
  onPlacePiece,
  selectedPiece,
  highlightZone,
  occupiedSquares,
  lastMove,
  flipped = false,
  interactive = false,
}) => {
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null);

  // Build piece map
  const pieceMap = new Map<string, string>();

  if (fen) {
    try {
      const chess = new Chess(fen);
      const board = chess.board();
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const sq = board[row][col];
          if (sq) {
            const square = coordsToSquare(row, col);
            pieceMap.set(square, sq.color === 'w' ? sq.type.toUpperCase() : sq.type.toLowerCase());
          }
        }
      }
    } catch { /* ignore */ }
  }

  if (placement) {
    for (const p of placement) {
      const key = p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
      pieceMap.set(p.square, key);
    }
  }

  const isLegalPlacement = useCallback((square: string): boolean => {
    if (!placementColor || !interactive || !selectedPiece) return false;
    if (!isInZone(square, placementColor)) return false;
    if (occupiedSquares?.has(square)) return false;
    return true;
  }, [placementColor, interactive, selectedPiece, occupiedSquares]);

  const handleSquareClick = (square: string) => {
    if (!interactive || !onPlacePiece || !selectedPiece) return;
    if (isLegalPlacement(square)) {
      onPlacePiece(selectedPiece, square);
    }
  };

  const renderSquare = (row: number, col: number) => {
    const actualRow = flipped ? 7 - row : row;
    const actualCol = flipped ? 7 - col : col;
    const square = coordsToSquare(actualRow, actualCol);
    const isLight = (actualRow + actualCol) % 2 === 0;
    const piece = pieceMap.get(square);
    const isHighlighted = lastMove && (lastMove.from === square || lastMove.to === square);
    const isHovered = hoveredSquare === square;
    const isLegal = interactive && selectedPiece && isLegalPlacement(square);
    const isZone = highlightZone && isInZone(square, highlightZone) && !fen;

    let bgClass = '';
    if (isZone && !fen) {
      bgClass = isLight ? 'bg-emerald-200' : 'bg-emerald-700';
    } else {
      bgClass = isLight ? 'bg-amber-100' : 'bg-amber-800';
    }
    
    if (isHighlighted) {
      bgClass = isLight ? 'bg-yellow-300' : 'bg-yellow-600';
    }

    return (
      <div
        key={`${row}-${col}`}
        className={`${bgClass} relative flex items-center justify-center aspect-square transition-colors duration-150 ${
          isLegal ? 'cursor-pointer hover:brightness-110' : ''
        }`}
        onClick={() => handleSquareClick(square)}
        onMouseEnter={() => setHoveredSquare(square)}
        onMouseLeave={() => setHoveredSquare(null)}
      >
        {piece && (
          <span 
            className={`text-2xl sm:text-3xl md:text-4xl select-none transition-transform duration-100 ${
              isHighlighted ? 'scale-110' : ''
            }`}
            style={{ 
              filter: piece[0] === 'w' 
                ? 'drop-shadow(1px 1px 1px rgba(0,0,0,0.3))' 
                : 'drop-shadow(1px 1px 1px rgba(0,0,0,0.5))',
            }}
          >
            {PIECE_UNICODE[piece]}
          </span>
        )}
        {isLegal && isHovered && !piece && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-400/30">
            <div className="w-4 h-4 rounded-full bg-green-400/60 border-2 border-green-300" />
          </div>
        )}
        {/* Coordinate labels */}
        {col === 0 && (
          <span className={`absolute top-0.5 left-0.5 text-[8px] sm:text-[9px] font-bold leading-none ${
            isLight ? 'text-amber-800/60' : 'text-amber-100/60'
          }`}>
            {8 - actualRow}
          </span>
        )}
        {row === 7 && (
          <span className={`absolute bottom-0 right-0.5 text-[8px] sm:text-[9px] font-bold leading-none ${
            isLight ? 'text-amber-800/60' : 'text-amber-100/60'
          }`}>
            {String.fromCharCode('a'.charCodeAt(0) + actualCol)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div 
      className="grid grid-cols-8 border-2 border-amber-950 rounded-lg shadow-2xl overflow-hidden"
      style={{ maxWidth: 'min(480px, calc(100vw - 100px))', width: '100%' }}
    >
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => renderSquare(row, col))
      )}
    </div>
  );
};
