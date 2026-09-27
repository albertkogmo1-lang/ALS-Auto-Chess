import { Chess } from 'chess.js';

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0
};

const MOBILITY_WEIGHTS: Record<string, number> = {
  q: 8,
  r: 6,
  b: 5,
  n: 3,
  k: 1,
  p: 0
};

export function evaluateMaterial(chess: Chess): number {
  const board = chess.board();
  let material = 0;
  for (const row of board) {
    for (const sq of row) {
      if (sq) {
        const val = PIECE_VALUES[sq.type] || 0;
        material += sq.color === 'w' ? val : -val;
      }
    }
  }
  return material;
}

export function evaluateMobility(chess: Chess): number {
  const moves = chess.moves({ verbose: true });
  let whiteMobility = 0;
  let blackMobility = 0;
  
  for (const move of moves) {
    const weight = MOBILITY_WEIGHTS[move.piece] || 0;
    if (move.color === 'w') {
      whiteMobility += weight;
    } else {
      blackMobility += weight;
    }
  }
  
  return 2 * (whiteMobility - blackMobility);
}

export function evaluatePosition(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -10000 : 10000;
  }
  if (chess.isDraw()) return 0;
  
  const material = evaluateMaterial(chess);
  const mobility = evaluateMobility(chess);
  return material + mobility;
}

export function evaluatePlacement(pieces: { type: string; color: string }[]): number {
  let score = 0;
  for (const p of pieces) {
    score += PIECE_VALUES[p.type] || 0;
  }
  return score;
}

export function formatEval(cp: number): string {
  if (Math.abs(cp) >= 9000) {
    const movesToMate = Math.ceil((10000 - Math.abs(cp)) / 1);
    return cp > 0 ? `M${movesToMate}` : `-M${movesToMate}`;
  }
  const pawns = cp / 100;
  return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}
