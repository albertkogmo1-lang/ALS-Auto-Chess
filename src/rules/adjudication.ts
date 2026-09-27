import { Chess } from 'chess.js';
import { RoundResult } from '../state/machine';
import { evaluatePositionAtDepth } from '../engine/fallback-engine';

export interface AdjudicationResult {
  winner: 'w' | 'b' | 'draw';
  reason: string;
  eval: number;
}

export function adjudicateMoveCap(fen: string): AdjudicationResult {
  const eval_ = evaluatePositionAtDepth(fen, 4); // Use depth 4 as practical substitute for 20

  if (eval_ >= 200) {
    return { winner: 'w', reason: 'Move cap reached - White advantage (>=+200cp)', eval: eval_ };
  } else if (eval_ <= -200) {
    return { winner: 'b', reason: 'Move cap reached - Black advantage (<=-200cp)', eval: eval_ };
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
    else reason = 'Draw by 50-move rule';
    return { winner: 'draw', reason, eval: 0 };
  }

  return null;
}

// Spec tiebreak: "compare cumulative area under the eval curve across all
// rounds". Eval graph points are from White's perspective, so credit each
// point to whichever player was White that round (odd rounds: A, even: B).
export function calculateCumulativeEval(roundResults: RoundResult[]): { playerA: number; playerB: number } {
  let totalA = 0;
  let totalB = 0;

  for (const result of roundResults) {
    const whiteIsA = result.round % 2 === 1; // rounds 1,3,5: A is White; 2,4: B is White
    for (const evalPoint of result.evalGraph) {
      if (whiteIsA) {
        totalA += evalPoint;
        totalB -= evalPoint;
      } else {
        totalA -= evalPoint;
        totalB += evalPoint;
      }
    }
  }

  return { playerA: totalA, playerB: totalB };
}
