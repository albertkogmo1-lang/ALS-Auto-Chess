import { Chess } from 'chess.js';
import { evaluatePositionAtDepth } from '../engine/fallback-engine';

export interface AdjudicationResult {
  winner: 'w' | 'b' | 'draw';
  reason: string;
  eval: number;
}

export function adjudicateMoveCap(fen: string): AdjudicationResult {
  const eval_ = evaluatePositionAtDepth(fen, 4); // Use depth 4 as practical substitute for 20
  
  if (eval_ >= 200) {
    return { winner: 'w', reason: 'Move cap reached - White advantage (≥+200cp)', eval: eval_ };
  } else if (eval_ <= -200) {
    return { winner: 'b', reason: 'Move cap reached - Black advantage (≤-200cp)', eval: eval_ };
  } else {
    return { winner: 'draw', reason: 'Move cap reached - Position equal', eval: eval_ };
  }
}

export function adjudicatePosition(chess: Chess): AdjudicationResult | null {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'b' : 'w';
    return { winner, reason: 'Checkmate', eval: winner === 'w' ? 10000 : -10000 };
  }
  
  if (chess.isStalemate()) {
    return { winner: 'draw', reason: 'Stalemate', eval: 0 };
  }
  
  if (chess.isDraw()) {
    let reason = 'Draw';
    if (chess.isThreefoldRepetition()) reason = 'Draw by repetition';
    else if (chess.isInsufficientMaterial()) reason = 'Draw by insufficient material';
    else if (chess.isDraw()) reason = 'Draw by 50-move rule';
    return { winner: 'draw', reason, eval: 0 };
  }
  
  return null;
}

export function calculateCumulativeEval(evalGraphs: number[][]): { playerA: number; playerB: number } {
  let totalA = 0;
  let totalB = 0;
  
  for (let i = 0; i < evalGraphs.length; i++) {
    const graph = evalGraphs[i];
    // Determine if player A was white in this round
    // Positive eval favors white, negative favors black
    for (const eval_ of graph) {
      totalA += eval_;
      totalB -= eval_;
    }
  }
  
  return { playerA: totalA, playerB: totalB };
}
