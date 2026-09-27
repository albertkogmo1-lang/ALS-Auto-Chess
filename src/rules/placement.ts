import { PlacedPiece, PieceType, Color } from '../state/machine';

// Per the design spec: "each player places all 8 pawns anywhere in their own
// zone" and pieces go "into their zone's remaining empty squares".
// There are NO rank restrictions - any empty square inside the deployment
// zone is legal. (An earlier draft restricted pawn/king ranks; removed.)

export function isInZone(square: string, color: Color): boolean {
  const rank = parseInt(square[1]);
  if (color === 'w') {
    return rank >= 1 && rank <= 4;
  } else {
    return rank >= 5 && rank <= 8;
  }
}

export function validatePlacement(
  pieces: PlacedPiece[],
  color: Color,
  phase: 'pawns' | 'pieces'
): { valid: boolean; error?: string } {
  const occupiedSquares = new Set<string>();

  for (const piece of pieces) {
    // Check zone
    if (!isInZone(piece.square, color)) {
      return { valid: false, error: `${piece.square} is outside your deployment zone` };
    }

    // Check duplicate squares
    if (occupiedSquares.has(piece.square)) {
      return { valid: false, error: `Duplicate placement on ${piece.square}` };
    }
    occupiedSquares.add(piece.square);
  }

  // Check piece counts
  if (phase === 'pawns') {
    const pawnCount = pieces.filter(p => p.type === 'p').length;
    if (pawnCount > 8) {
      return { valid: false, error: 'Too many pawns (max 8)' };
    }
  } else {
    const counts: Record<PieceType, number> = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };
    for (const p of pieces) counts[p.type]++;
    if (counts.r > 2) return { valid: false, error: 'Too many rooks' };
    if (counts.n > 2) return { valid: false, error: 'Too many knights' };
    if (counts.b > 2) return { valid: false, error: 'Too many bishops' };
    if (counts.q > 1) return { valid: false, error: 'Too many queens' };
    if (counts.k > 1) return { valid: false, error: 'Too many kings' };
  }

  return { valid: true };
}

export function getAvailableSquares(
  color: Color,
  phase: 'pawns' | 'pieces',
  occupiedSquares: Set<string>
): string[] {
  const squares: string[] = [];
  const files = 'abcdefgh';

  const rankStart = color === 'w' ? 1 : 5;
  const rankEnd = color === 'w' ? 4 : 8;

  for (let rank = rankStart; rank <= rankEnd; rank++) {
    for (const file of files) {
      const sq = `${file}${rank}`;
      if (!occupiedSquares.has(sq)) {
        squares.push(sq);
      }
    }
  }

  return squares;
}
