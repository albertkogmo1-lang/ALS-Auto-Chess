import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { useGameStore } from './state/store';
import { Phase, PlacedPiece, PieceType, Color, PAWN_PIECES, NON_PAWN_PIECES, RoundResult } from './state/machine';
import { Board } from './components/Board';
import { PieceTray } from './components/PieceTray';
import { PhaseTimer } from './components/PhaseTimer';
import { EvalBar } from './components/EvalBar';
import { CommanderRoster } from './components/CommanderRoster';
import { RoundTracker } from './components/RoundTracker';
import { RoundRecap } from './components/RoundRecap';
import { buildFenFromPlacement, autoPlacePieces } from './rules/validation';
import { adjudicatePosition, adjudicateMoveCap } from './rules/adjudication';
import { getEngineMove } from './engine/fallback-engine';
import { getCommanderById, COMMANDERS } from './engine/commanders';
import { evaluatePosition } from './engine/heuristic';
import { isInZone, isValidPawnSquare, isValidKingSquare } from './rules/placement';

const MOVE_CAP = 150;

// Screen blocker for hot-seat play
const ScreenBlocker: React.FC<{ message: string; subMessage?: string; onDismiss: () => void }> = ({ message, subMessage, onDismiss }) => (
  <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50 p-4">
    <div className="text-center p-8 max-w-sm">
      <div className="text-6xl mb-4">🙈</div>
      <h2 className="text-xl font-bold text-white mb-2">{message}</h2>
      {subMessage && <p className="text-gray-400 mb-6 text-sm">{subMessage}</p>}
      <button
        onClick={onDismiss}
        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors mt-4"
      >
        I'm Ready — Show Me
      </button>
    </div>
  </div>
);

export default function App() {
  const store = useGameStore();
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  const [showBlocker, setShowBlocker] = useState(false);
  const [blockerMsg, setBlockerMsg] = useState('');
  const [blockerSub, setBlockerSub] = useState('');
  const [selectedPiece, setSelectedPiece] = useState<PieceType | null>(null);
  const [currentEval, setCurrentEval] = useState(0);
  const [evalLabel, setEvalLabel] = useState('Your Formation');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [waitingForOther, setWaitingForOther] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const phaseHandledRef = useRef(false);

  // Start match
  const handleStartMatch = async () => {
    await store.startMatch();
    setActivePlayer('A');
    setShowBlocker(false);
    setWaitingForOther(false);
    phaseHandledRef.current = false;
    // Go to pawn placement
    store.setPhase('PAWN_PLACEMENT_30');
    store.startTimer(30);
  };

  // Handle ROUND_START transition
  useEffect(() => {
    if (store.phase === 'ROUND_START' && !phaseHandledRef.current) {
      phaseHandledRef.current = true;
      const timer = setTimeout(() => {
        setActivePlayer('A');
        setShowBlocker(false);
        setWaitingForOther(false);
        setSelectedPiece('p'); // Auto-select pawn
        store.setPhase('PAWN_PLACEMENT_30');
        store.startTimer(30);
        setEvalLabel('Your Formation');
        setCurrentEval(0);
        setLastMove(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [store.phase, store.round]);

  // Auto-select first piece when entering piece placement
  useEffect(() => {
    if (store.phase === 'PIECE_PLACEMENT_50') {
      setSelectedPiece('r'); // Auto-select rook
    }
  }, [store.phase]);

  // Get current player's color and placement
  const getCurrentColor = (): Color => activePlayer === store.whitePlayer ? 'w' : 'b';
  const getCurrentPlacement = (): PlacedPiece[] => {
    return getCurrentColor() === 'w' ? store.whitePlacement : store.blackPlacement;
  };

  // Complete pawn placement for current player
  const completePawnPlacement = useCallback(() => {
    const color = getCurrentColor();
    const placement = getCurrentPlacement();
    
    // Auto-place remaining pawns
    const pawnCount = placement.filter(p => p.type === 'p').length;
    if (pawnCount < 8) {
      const occupied = new Set(placement.map(p => p.square));
      const needed = PAWN_PIECES.slice(pawnCount);
      const autoPlaced = autoPlacePieces(needed, color, 'pawns', occupied, Date.now() + Math.random() * 1000);
      const newPlacement = [...placement, ...autoPlaced];
      if (color === 'w') store.setPlacement('w', newPlacement);
      else store.setPlacement('b', newPlacement);
    }

    if (activePlayer === 'A') {
      // Switch to player B - restart timer for their placement
      setActivePlayer('B');
      setSelectedPiece('p');
      store.startTimer(30); // Fresh 30s for player B
      setBlockerMsg("Player A's pawns are locked in!");
      setBlockerSub('Pass the device to Player B for their pawn placement.');
      setShowBlocker(true);
    } else {
      // Both done - reveal pawns
      store.setPhase('PAWN_REVEAL');
      setTimeout(() => {
        setShowBlocker(false);
        store.setPhase('PIECE_PLACEMENT_50');
        store.startTimer(50);
        setActivePlayer('A');
        setSelectedPiece('r');
        setBlockerMsg('Pawns Revealed!');
        setBlockerSub('Now place your remaining pieces. Pass to Player A.');
        setShowBlocker(true);
      }, 2000);
    }
  }, [activePlayer, store]);

  // Complete piece placement for current player
  const completePiecePlacement = useCallback(() => {
    const color = getCurrentColor();
    const placement = getCurrentColor() === 'w' ? store.whitePlacement : store.blackPlacement;
    
    // Auto-place remaining pieces
    const counts: Record<PieceType, number> = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };
    for (const p of placement) counts[p.type]++;
    const needed: PieceType[] = [];
    for (const type of NON_PAWN_PIECES) {
      const target = type === 'r' || type === 'n' || type === 'b' ? 2 : 1;
      for (let i = counts[type]; i < target; i++) needed.push(type);
    }
    
    if (needed.length > 0) {
      const occupied = new Set(placement.map(p => p.square));
      const autoPlaced = autoPlacePieces(needed, color, 'pieces', occupied, Date.now() + Math.random() * 1000);
      const newPlacement = [...placement, ...autoPlaced];
      if (color === 'w') store.setPlacement('w', newPlacement);
      else store.setPlacement('b', newPlacement);
    }

    if (activePlayer === 'A') {
      setActivePlayer('B');
      setSelectedPiece('r');
      store.startTimer(50); // Fresh 50s for player B
      setBlockerMsg("Player A's position is locked!");
      setBlockerSub('Pass the device to Player B to complete their setup.');
      setShowBlocker(true);
    } else {
      // Full reveal - immediately build and show position
      store.setPhase('FULL_REVEAL');
      setShowBlocker(false);
      
      // Build FEN
      const whiteToMove = true;
      const fen = buildFenFromPlacement(store.whitePlacement, store.blackPlacement, whiteToMove);
      store.setCurrentFen(fen);
      
      // Calculate initial eval
      try {
        const chess = new Chess(fen);
        const eval_ = evaluatePosition(chess);
        setCurrentEval(eval_);
      } catch {
        setCurrentEval(0);
      }
      setEvalLabel('Match Eval');
      
      // After reveal animation, proceed to commander draft
      setTimeout(() => {
        // Round 5 color pick check
        const state = useGameStore.getState();
        if (state.round === 5) {
          const { playerA, playerB } = state.scores;
          if (playerA !== playerB) {
            const trailing = playerA < playerB ? 'A' : 'B';
            store.setColorPicker(trailing as 'A' | 'B');
            store.setPhase('AWAIT_COLOR_PICK');
          } else {
            store.setPhase('COMMANDER_DRAFT_12');
            store.startTimer(12);
          }
        } else {
          store.setPhase('COMMANDER_DRAFT_12');
          store.startTimer(12);
        }
      }, 2500);
    }
  }, [activePlayer, store]);

  // Handle piece placement
  const handlePlacePiece = useCallback((piece: PieceType, square: string) => {
    const color = getCurrentColor();
    const placement = getCurrentPlacement();
    
    if (!isInZone(square, color)) return;
    if (placement.some(p => p.square === square)) return;
    if (piece === 'p' && !isValidPawnSquare(square, color)) return;
    if (piece === 'k' && !isValidKingSquare(square, color)) return;
    
    const counts: Record<PieceType, number> = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };
    for (const p of placement) counts[p.type]++;
    const maxCounts: Record<PieceType, number> = { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 };
    if (counts[piece] >= maxCounts[piece]) return;
    
    const newPiece: PlacedPiece = { type: piece, square, color };
    const newPlacement = [...placement, newPiece];
    
    if (color === 'w') store.setPlacement('w', newPlacement);
    else store.setPlacement('b', newPlacement);
    
    // Update formation eval
    setEvalLabel('Your Formation');
    const pieceValues: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    let eval_ = 0;
    for (const p of newPlacement) {
      eval_ += color === 'w' ? (pieceValues[p.type] || 0) : -(pieceValues[p.type] || 0);
    }
    setCurrentEval(eval_);
  }, [activePlayer, store]);

  // Refs for auto-play
  const chessRef = useRef<Chess | null>(null);
  const whiteCmdRef = useRef<ReturnType<typeof getCommanderById> | null>(null);
  const blackCmdRef = useRef<ReturnType<typeof getCommanderById> | null>(null);
  const movesRef = useRef<{ from: string; to: string; san: string; fen: string; eval: number }[]>([]);
  const evalHistoryRef = useRef<number[]>([]);
  const isGeneratingRef = useRef(false);
  const genTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start auto-play - generate moves in background
  const startAutoPlay = useCallback(() => {
    setShowBlocker(false);
    setWaitingForOther(false);
    store.setPhase('AUTO_PLAY');
    setEvalLabel('Match Eval');
    
    const whiteCmdId = store.whiteCommanderPick || 'novice';
    const blackCmdId = store.blackCommanderPick || 'novice';
    const whiteCmd = getCommanderById(whiteCmdId);
    const blackCmd = getCommanderById(blackCmdId);
    
    if (!whiteCmd || !blackCmd) return;
    
    // Mark commanders as used
    const whitePlayerKey = store.whitePlayer === 'A' ? 'playerA' : 'playerB';
    const blackPlayerKey = store.whitePlayer === 'A' ? 'playerB' : 'playerA';
    
    const newUsed = { ...store.usedCommanders };
    newUsed[whitePlayerKey] = [...newUsed[whitePlayerKey], whiteCmdId];
    newUsed[blackPlayerKey] = [...newUsed[blackPlayerKey], blackCmdId];
    store.setState({ usedCommanders: newUsed });
    
    const fen = store.currentFen;
    if (!fen) return;
    
    // Initialize chess game
    const chess = new Chess(fen);
    chessRef.current = chess;
    whiteCmdRef.current = whiteCmd;
    blackCmdRef.current = blackCmd;
    
    // Initialize refs
    movesRef.current = [];
    evalHistoryRef.current = [evaluatePosition(chess)];
    isGeneratingRef.current = true;
    setIsGenerating(true);
    
    // Clear store
    store.setAutoPlayMoves([]);
    store.setEvalHistory([evaluatePosition(chess)]);
    store.setAutoPlayIndex(0);
    store.setIsAutoPlaying(true);
    
    // Generate moves one at a time with yielding
    const generateNextMove = () => {
      if (!chessRef.current || !whiteCmdRef.current || !blackCmdRef.current) {
        isGeneratingRef.current = false;
        return;
      }
      
      const chess = chessRef.current;
      
      // Check termination
      if (chess.isGameOver() || movesRef.current.length >= MOVE_CAP) {
        isGeneratingRef.current = false;
        setIsGenerating(false);
        // Final update
        store.setAutoPlayMoves([...movesRef.current]);
        store.setEvalHistory([...evalHistoryRef.current]);
        return;
      }
      
      // Generate one move
      const currentCmd = chess.turn() === 'w' ? whiteCmdRef.current : blackCmdRef.current;
      try {
        const result = getEngineMove(chess.fen(), currentCmd, movesRef.current.length);
        const move = chess.move(result.move.san);
        if (move) {
          movesRef.current.push({
            from: move.from,
            to: move.to,
            san: move.san,
            fen: chess.fen(),
            eval: result.eval,
          });
          evalHistoryRef.current.push(result.eval);
          
          // Update store immediately
          store.setAutoPlayMoves([...movesRef.current]);
          store.setEvalHistory([...evalHistoryRef.current]);
          
          // Schedule next move with delay to yield to UI
          genTimerRef.current = setTimeout(generateNextMove, 100);
        } else {
          isGeneratingRef.current = false;
          setIsGenerating(false);
          store.setAutoPlayMoves([...movesRef.current]);
          store.setEvalHistory([...evalHistoryRef.current]);
        }
      } catch (e) {
        console.error('Error generating move:', e);
        isGeneratingRef.current = false;
        setIsGenerating(false);
        store.setAutoPlayMoves([...movesRef.current]);
        store.setEvalHistory([...evalHistoryRef.current]);
      }
    };
    
    // Start generation after a brief delay
    genTimerRef.current = setTimeout(generateNextMove, 300);
  }, [store]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (genTimerRef.current) {
        clearTimeout(genTimerRef.current);
      }
    };
  }, []);

  // Animate moves as they become available
  useEffect(() => {
    if (!store.isAutoPlaying) return;
    
    // Check if we've played all available moves
    if (store.autoPlayIndex >= store.autoPlayMoves.length) {
      // If generation is complete, finish the round
      if (!isGeneratingRef.current && store.autoPlayMoves.length > 0) {
        const chess = chessRef.current;
        if (chess) {
          let result: RoundResult;
          const adjudication = adjudicatePosition(chess);
          if (adjudication) {
            result = {
              round: store.round,
              winner: adjudication.winner,
              reason: adjudication.reason,
              whiteCommanderId: store.whiteCommanderPick || 'novice',
              blackCommanderId: store.blackCommanderPick || 'novice',
              evalGraph: store.evalHistory,
              finalEval: adjudication.eval,
            };
          } else {
            const capResult = adjudicateMoveCap(chess.fen());
            result = {
              round: store.round,
              winner: capResult.winner,
              reason: capResult.reason,
              whiteCommanderId: store.whiteCommanderPick || 'novice',
              blackCommanderId: store.blackCommanderPick || 'novice',
              evalGraph: store.evalHistory,
              finalEval: capResult.eval,
            };
          }
          store.addRoundResult(result);
          store.setPhase('ROUND_RESULT');
        }
      }
      return;
    }

    // Play next move
    const move = store.autoPlayMoves[store.autoPlayIndex];
    const timer = setTimeout(() => {
      store.setCurrentFen(move.fen);
      setCurrentEval(move.eval);
      setLastMove({ from: move.from, to: move.to });
      store.setAutoPlayIndex(store.autoPlayIndex + 1);
    }, 500);

    return () => clearTimeout(timer);
  }, [store.isAutoPlaying, store.autoPlayIndex, store.autoPlayMoves.length]);

  // Handle commander pick
  const handleCommanderPick = useCallback((commanderId: string, player: 'A' | 'B') => {
    const playerColor: Color = player === store.whitePlayer ? 'w' : 'b';
    store.setCommanderPick(playerColor, commanderId);
    
    if (store.draftSequence === 'sequential') {
      // Round 5: White picks first, then Black
      if (playerColor === 'w') {
        // White picked, show blocker for Black
        setBlockerMsg('White has chosen their Commander!');
        setBlockerSub('Pass to the other player to choose Black\'s Commander.');
        setShowBlocker(true);
      } else {
        // Black picked - both done
        startAutoPlay();
      }
    } else {
      // Rounds 1-4: simultaneous in theory, but hot-seat means sequential
      // After first pick, show blocker for second player
      const state = useGameStore.getState();
      if (state.whiteCommanderPick && state.blackCommanderPick) {
        startAutoPlay();
      } else if (!state.whiteCommanderPick || !state.blackCommanderPick) {
        // One picked, waiting for other
        setBlockerMsg('Commander locked in!');
        setBlockerSub('Pass to the other player to choose their Commander.');
        setShowBlocker(true);
      }
    }
  }, [store, startAutoPlay]);

  // Commander timeout - auto pick for whoever hasn't picked
  const handleCommanderTimeout = useCallback(() => {
    const state = useGameStore.getState();
    
    // Auto-pick for player A if they haven't picked
    if (!state.whiteCommanderPick && !state.blackCommanderPick) {
      // Neither picked - auto-pick for both
      const whitePlayerKey = state.whitePlayer === 'A' ? 'playerA' : 'playerB';
      const blackPlayerKey = state.whitePlayer === 'A' ? 'playerB' : 'playerA';
      const availA = COMMANDERS.filter(c => !state.usedCommanders[whitePlayerKey].includes(c.id));
      const availB = COMMANDERS.filter(c => !state.usedCommanders[blackPlayerKey].includes(c.id));
      if (availA.length > 0) store.setCommanderPick('w', availA[0].id);
      if (availB.length > 0) store.setCommanderPick('b', availB.length > 1 ? availB[1].id : availB[0].id);
    } else if (state.whiteCommanderPick && !state.blackCommanderPick) {
      const blackPlayerKey = state.whitePlayer === 'A' ? 'playerB' : 'playerA';
      const avail = COMMANDERS.filter(c => !state.usedCommanders[blackPlayerKey].includes(c.id));
      if (avail.length > 0) store.setCommanderPick('b', avail[0].id);
    } else if (!state.whiteCommanderPick && state.blackCommanderPick) {
      const whitePlayerKey = state.whitePlayer === 'A' ? 'playerA' : 'playerB';
      const avail = COMMANDERS.filter(c => !state.usedCommanders[whitePlayerKey].includes(c.id));
      if (avail.length > 0) store.setCommanderPick('w', avail[0].id);
    }
    
    // Start auto-play after a brief delay
    setTimeout(() => {
      const finalState = useGameStore.getState();
      if (finalState.whiteCommanderPick && finalState.blackCommanderPick) {
        startAutoPlay();
      }
    }, 500);
  }, [store, startAutoPlay]);

  // Handle continue after round result
  const handleContinue = () => {
    if (store.round >= 5) {
      if (store.scores.playerA === store.scores.playerB) {
        store.setPhase('TIEBREAK');
      } else {
        store.setPhase('MATCH_RESULT');
      }
    } else {
      phaseHandledRef.current = false;
      store.nextRound();
    }
  };

  // Handle color pick (round 5)
  const handleColorPick = (color: Color) => {
    if (color === 'w') {
      store.setWhitePlayer(store.colorPicker!);
    } else {
      store.setWhitePlayer(store.colorPicker === 'A' ? 'B' : 'A');
    }
    store.setColorPicker(null);
    store.setPhase('COMMANDER_DRAFT_12');
    store.startTimer(12);
  };

  // Get remaining pieces for tray
  const getRemainingPieces = (): PieceType[] => {
    const placement = getCurrentPlacement();
    const phase = store.phase;
    
    if (phase === 'PAWN_PLACEMENT_30') {
      const pawnCount = placement.filter(p => p.type === 'p').length;
      return PAWN_PIECES.slice(pawnCount);
    } else if (phase === 'PIECE_PLACEMENT_50') {
      const counts: Record<PieceType, number> = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };
      for (const p of placement) counts[p.type]++;
      const remaining: PieceType[] = [];
      for (const type of NON_PAWN_PIECES) {
        const target = type === 'r' || type === 'n' || type === 'b' ? 2 : 1;
        for (let i = counts[type]; i < target; i++) remaining.push(type);
      }
      return remaining;
    }
    return [];
  };

  const isPlacingPhase = store.phase === 'PAWN_PLACEMENT_30' || store.phase === 'PIECE_PLACEMENT_50';
  const currentColor = getCurrentColor();
  const placementPhase = store.phase === 'PAWN_PLACEMENT_30' ? 'pawns' as const : 'pieces' as const;
  const canConfirmPawns = store.phase === 'PAWN_PLACEMENT_30' && getCurrentPlacement().filter(p => p.type === 'p').length === 8;
  const canConfirmPieces = store.phase === 'PIECE_PLACEMENT_50' && getCurrentPlacement().length === 16;

  // ===== LOBBY =====
  if (store.phase === 'LOBBY') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="text-center max-w-lg">
          <div className="text-7xl mb-4">♟</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">Roster Draft</h1>
          <h2 className="text-xl text-indigo-400 font-medium mb-6">Autochess</h2>
          <p className="text-gray-400 mb-8">A 5-round chess variant with blind placement & commander drafting</p>
          
          <div className="bg-gray-800/60 rounded-xl p-5 mb-6 text-left border border-gray-700">
            <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-wide">How to Play</h3>
            <ul className="text-gray-300 text-sm space-y-2">
              <li>👥 <strong>2 players, same device</strong> — pass & play with screen obscuring</li>
              <li>🙈 <strong>Blind Placement</strong> — place pieces in your zone without seeing opponent's setup</li>
              <li>⚔ <strong>Commander Draft</strong> — pick from 5 unique AI personas each round (single-use!)</li>
              <li>🤖 <strong>Auto-Play</strong> — your commanders battle, you just spectate!</li>
              <li>🏆 <strong>Best of 5</strong> — most round wins takes the match</li>
            </ul>
          </div>

          <div className="bg-gray-800/40 rounded-xl p-4 mb-8 text-left border border-gray-700/50">
            <h4 className="text-gray-300 font-medium mb-2 text-sm">Your Commanders:</h4>
            <div className="grid grid-cols-1 gap-1.5">
              {COMMANDERS.map(cmd => (
                <div key={cmd.id} className="flex items-center gap-2 text-xs">
                  <span className="text-lg w-6 text-center">{cmd.icon}</span>
                  <span className="text-gray-200 font-medium w-32">{cmd.name}</span>
                  <span className="text-gray-500 flex-1 truncate">{cmd.flavor.slice(0, 45)}…</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartMatch}
            className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-bold rounded-xl transition-all hover:scale-105 shadow-lg shadow-indigo-500/30"
          >
            Start Match
          </button>
        </div>
      </div>
    );
  }

  // ===== MATCH RESULT =====
  if (store.phase === 'MATCH_RESULT') {
    const winner = store.scores.playerA > store.scores.playerB ? 'Player A' : 'Player B';
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md w-full">
          <div className="text-7xl mb-4">🏆</div>
          <h1 className="text-4xl font-bold text-white mb-2">Match Over!</h1>
          <p className="text-3xl text-indigo-400 font-bold mb-2">{winner} Wins!</p>
          <div className="text-2xl text-gray-300 mb-6">
            {store.scores.playerA} — {store.scores.playerB}
          </div>
          <div className="bg-gray-800/60 rounded-lg p-4 mb-6 text-left border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Match Seed (for audit):</div>
            <code className="text-[10px] text-gray-300 break-all font-mono">{store.matchSeed}</code>
          </div>
          <div className="mb-6">
            <RoundTracker currentRound={store.round} totalRounds={5} scores={store.scores} roundResults={store.roundResults} />
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors"
          >
            New Match
          </button>
        </div>
      </div>
    );
  }

  // ===== TIEBREAK =====
  if (store.phase === 'TIEBREAK') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-7xl mb-4">⚡</div>
          <h1 className="text-3xl font-bold text-white mb-2">Sudden Death!</h1>
          <p className="text-gray-400 mb-6">Match is tied after 5 rounds. One final round to decide the winner!</p>
          <button
            onClick={() => {
              phaseHandledRef.current = false;
              store.setState({ round: 6 });
              store.setPhase('ROUND_START');
            }}
            className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
          >
            Begin Sudden Death
          </button>
        </div>
      </div>
    );
  }

  // ===== MAIN GAME VIEW =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 p-2 sm:p-4">
      {/* Screen blocker */}
      {showBlocker && (
        <ScreenBlocker message={blockerMsg} subMessage={blockerSub} onDismiss={() => setShowBlocker(false)} />
      )}

      {/* Waiting for other player */}
      {waitingForOther && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40">
          <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700">
            <div className="text-3xl mb-2 animate-pulse">⏳</div>
            <p className="text-white font-medium">Waiting for other player's Commander pick...</p>
          </div>
        </div>
      )}

      {/* Round result recap */}
      {store.phase === 'ROUND_RESULT' && store.currentRoundResult && (
        <RoundRecap result={store.currentRoundResult} onContinue={handleContinue} />
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base sm:text-lg font-bold text-white">♟ Roster Draft Autochess</h1>
          <div className="text-xs sm:text-sm text-gray-400">
            Round {store.round}{store.round > 5 ? ' (SD)' : ''} of 5
          </div>
        </div>

        {/* Color pick for round 5 */}
        {store.phase === 'AWAIT_COLOR_PICK' && store.colorPicker && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-4 text-center">
            <p className="text-yellow-300 font-medium mb-3">
              Player {store.colorPicker} is trailing — choose your color for Round 5:
            </p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => handleColorPick('w')} className="px-6 py-2 bg-white text-gray-900 font-bold rounded-lg hover:bg-gray-200 transition-colors">
                ♔ White (First)
              </button>
              <button onClick={() => handleColorPick('b')} className="px-6 py-2 bg-gray-900 text-white font-bold rounded-lg border border-gray-600 hover:bg-gray-800 transition-colors">
                ♚ Black
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-3">
          {/* Left - Commander Rosters */}
          <div className="lg:w-52 space-y-3 order-2 lg:order-1">
            <CommanderRoster
              usedCommanders={store.usedCommanders.playerA}
              selectedCommander={store.whitePlayer === 'A' ? store.whiteCommanderPick : store.blackCommanderPick}
              onPick={(id) => handleCommanderPick(id, 'A')}
              label={`Player A (${store.whitePlayer === 'A' ? 'White' : 'Black'})`}
              color={store.whitePlayer === 'A' ? 'white' : 'black'}
              disabled={store.phase !== 'COMMANDER_DRAFT_12'}
            />
            <CommanderRoster
              usedCommanders={store.usedCommanders.playerB}
              selectedCommander={store.whitePlayer === 'B' ? store.whiteCommanderPick : store.blackCommanderPick}
              onPick={(id) => handleCommanderPick(id, 'B')}
              label={`Player B (${store.whitePlayer === 'B' ? 'White' : 'Black'})`}
              color={store.whitePlayer === 'B' ? 'white' : 'black'}
              disabled={store.phase !== 'COMMANDER_DRAFT_12'}
            />
          </div>

          {/* Center - Board */}
          <div className="flex-1 flex flex-col items-center order-1 lg:order-2">
            {/* Timer */}
            {(store.phase === 'PAWN_PLACEMENT_30' || store.phase === 'PIECE_PLACEMENT_50' || store.phase === 'COMMANDER_DRAFT_12') && (
              <div className="w-full max-w-md mb-3">
                <PhaseTimer
                  key={store.timerKey}
                  duration={store.phase === 'PAWN_PLACEMENT_30' ? 30 : store.phase === 'PIECE_PLACEMENT_50' ? 50 : 12}
                  startTime={store.phaseStartTime || Date.now()}
                  label={
                    store.phase === 'PAWN_PLACEMENT_30' ? '⏱ Pawn Placement' :
                    store.phase === 'PIECE_PLACEMENT_50' ? '⏱ Piece Placement' :
                    '⏱ Commander Draft'
                  }
                  onComplete={() => {
                    if (store.phase === 'PAWN_PLACEMENT_30') completePawnPlacement();
                    else if (store.phase === 'PIECE_PLACEMENT_50') completePiecePlacement();
                    else if (store.phase === 'COMMANDER_DRAFT_12') handleCommanderTimeout();
                  }}
                  color={store.phase === 'COMMANDER_DRAFT_12' ? 'green' : 'amber'}
                />
              </div>
            )}

            {/* Board with eval bar */}
            <div className="flex gap-2 items-stretch">
              <EvalBar eval={currentEval} label={evalLabel} />
              <div className="flex flex-col items-center">
                {/* Phase info */}
                <div className="mb-2 text-center min-h-[24px]">
                  {isPlacingPhase && (
                    <div className="text-xs sm:text-sm text-gray-300">
                      <span className="font-bold text-indigo-400">Player {activePlayer}</span>
                      {' placing '}
                      <span className="font-bold text-yellow-400">
                        {store.phase === 'PAWN_PLACEMENT_30' ? 'Pawns' : 'Pieces'}
                      </span>
                      {' as '}
                      <span className={currentColor === 'w' ? 'text-white font-bold' : 'text-gray-400 font-bold'}>
                        {currentColor === 'w' ? 'White ♔' : 'Black ♚'}
                      </span>
                    </div>
                  )}
                  {store.phase === 'COMMANDER_DRAFT_12' && (
                    <div className="text-sm text-green-400 font-medium">⚔ Draft your Commander!</div>
                  )}
                  {store.phase === 'AUTO_PLAY' && (
                    <div className="text-xs sm:text-sm text-blue-400 font-medium">
                      {isGenerating ? (
                        <>⚙️ Preparing battle... ({store.autoPlayMoves.length} moves computed)</>
                      ) : (
                        <>🤖 Move {Math.min(store.autoPlayIndex + 1, store.autoPlayMoves.length)} of {store.autoPlayMoves.length}</>
                      )}
                    </div>
                  )}
                  {(store.phase === 'FULL_REVEAL' || store.phase === 'PAWN_REVEAL') && (
                    <div className="text-sm text-yellow-400 font-medium animate-pulse">👀 Revealing positions...</div>
                  )}
                  {store.phase === 'ROUND_START' && (
                    <div className="text-sm text-gray-400">Starting Round {store.round}...</div>
                  )}
                </div>

                <Board
                  fen={store.currentFen || undefined}
                  placement={isPlacingPhase ? getCurrentPlacement() : undefined}
                  placementColor={isPlacingPhase ? currentColor : undefined}
                  placementPhase={isPlacingPhase ? placementPhase : undefined}
                  onPlacePiece={isPlacingPhase ? handlePlacePiece : undefined}
                  selectedPiece={isPlacingPhase ? selectedPiece : undefined}
                  highlightZone={isPlacingPhase ? currentColor : undefined}
                  occupiedSquares={isPlacingPhase ? new Set(getCurrentPlacement().map(p => p.square)) : undefined}
                  lastMove={lastMove}
                  flipped={currentColor === 'b' && isPlacingPhase}
                  interactive={isPlacingPhase}
                />

                {/* Piece tray */}
                {isPlacingPhase && (
                  <div className="mt-3 w-full max-w-md">
                    {!selectedPiece && getRemainingPieces().length > 0 && (
                      <div className="text-xs text-yellow-400 text-center mb-2 animate-pulse">
                        ↑ Select a piece from the tray, then click a square to place it
                      </div>
                    )}
                    <PieceTray
                      pieces={getRemainingPieces()}
                      onSelectPiece={setSelectedPiece}
                      selectedPiece={selectedPiece}
                      label={`Remaining ${store.phase === 'PAWN_PLACEMENT_30' ? 'Pawns' : 'Pieces'}`}
                    />
                  </div>
                )}

                {/* Confirm buttons */}
                {isPlacingPhase && (canConfirmPawns || canConfirmPieces) && (
                  <button
                    onClick={() => {
                      if (store.phase === 'PAWN_PLACEMENT_30') completePawnPlacement();
                      else completePiecePlacement();
                    }}
                    className="mt-3 px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm transition-colors"
                  >
                    ✓ Confirm & Lock In
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right - Round tracker */}
          <div className="lg:w-52 order-3">
            <RoundTracker
              currentRound={store.round}
              totalRounds={5}
              scores={store.scores}
              roundResults={store.roundResults}
            />
            
            {/* Piloting info during auto-play */}
            {store.phase === 'AUTO_PLAY' && (
              <div className="mt-3 bg-gray-800/80 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Piloting</div>
                <div className="flex justify-between items-center">
                  <div className="text-center">
                    <div className="text-xl">{getCommanderById(store.whiteCommanderPick || '')?.icon}</div>
                    <div className="text-[10px] text-gray-300 mt-0.5">{getCommanderById(store.whiteCommanderPick || '')?.name}</div>
                    <div className="text-[9px] text-gray-500">(White)</div>
                  </div>
                  <div className="text-gray-500 text-xs">vs</div>
                  <div className="text-center">
                    <div className="text-xl">{getCommanderById(store.blackCommanderPick || '')?.icon}</div>
                    <div className="text-[10px] text-gray-300 mt-0.5">{getCommanderById(store.blackCommanderPick || '')?.name}</div>
                    <div className="text-[9px] text-gray-500">(Black)</div>
                  </div>
                </div>
              </div>
            )}

            {/* Move log during auto-play */}
            {store.phase === 'AUTO_PLAY' && store.autoPlayMoves.length > 0 && (
              <div className="mt-3 bg-gray-800/80 rounded-lg p-3 border border-gray-700 max-h-48 overflow-y-auto">
                <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Moves</div>
                <div className="text-[10px] text-gray-300 font-mono space-y-0.5">
                  {store.autoPlayMoves.slice(0, store.autoPlayIndex).map((m, i) => (
                    <div key={i} className={i === store.autoPlayIndex - 1 ? 'text-indigo-400 font-bold' : ''}>
                      {i % 2 === 0 ? `${Math.floor(i/2) + 1}.` : ''} {m.san}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
