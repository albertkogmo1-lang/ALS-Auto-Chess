import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import * as Peer from './net/peer';
import { useGameStore } from './state/store';
import { PlacedPiece, PieceType, Color, PAWN_PIECES, NON_PAWN_PIECES, RoundResult } from './state/machine';
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

export default function App() {
  const store = useGameStore();
  const [myRole, setMyRole] = useState<'host' | 'guest' | null>(null);
  const [myColor, setMyColor] = useState<'w' | 'b'>('w');
  const [roomId, setRoomId] = useState<string>('');
  const [joinCode, setJoinCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'waiting' | 'connected' | 'error'>('idle');
  const [selectedPiece, setSelectedPiece] = useState<PieceType | null>(null);
  const [currentEval, setCurrentEval] = useState(0);
  const [evalLabel, setEvalLabel] = useState('Your Formation');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const chessRef = useRef<Chess | null>(null);
  const movesRef = useRef<any[]>([]);
  const genTimerRef = useRef<any>(null);

  // Setup peer messaging
  useEffect(() => {
    Peer.onMessage((msg) => {
      handleMessage(msg);
    });

    Peer.onConnection(() => {
      setConnectionStatus('connected');
    });

    Peer.onDisconnect(() => {
      setConnectionStatus('error');
    });

    return () => {
      Peer.disconnect();
    };
  }, []);

  // Handle incoming messages
  const handleMessage = (msg: Peer.PeerMessage) => {
    console.log('Received message:', msg.type);
    
    switch (msg.type) {
      case 'request-state':
        // Guest requesting state (host only)
        if (myRole === 'host') {
          sendToPeer('game-state', {
            ...store,
            guestColor: 'b',
          });
        }
        break;
      
      case 'game-state':
        // Full state sync from host (guest receives this)
        if (myRole === 'guest') {
          store.setState(msg.data);
          if (msg.data.guestColor) {
            setMyColor(msg.data.guestColor);
          }
        }
        break;
      
      case 'placement':
        // Opponent's placement (for reveal)
        if (msg.data.color === 'w') {
          store.setPlacement('w', msg.data.pieces);
        } else {
          store.setPlacement('b', msg.data.pieces);
        }
        break;
      
      case 'commander-pick':
        if (msg.data.color === 'w') {
          store.setCommanderPick('w', msg.data.commanderId);
        } else {
          store.setCommanderPick('b', msg.data.commanderId);
        }
        break;
      
      case 'phase-change':
        store.setPhase(msg.data.phase);
        if (msg.data.timer) {
          store.startTimer(msg.data.timer);
        }
        break;
      
      case 'reveal':
        // Show opponent's pieces
        if (msg.data.whitePlacement) store.setPlacement('w', msg.data.whitePlacement);
        if (msg.data.blackPlacement) store.setPlacement('b', msg.data.blackPlacement);
        if (msg.data.fen) {
          store.setCurrentFen(msg.data.fen);
          try {
            const chess = new Chess(msg.data.fen);
            setCurrentEval(evaluatePosition(chess));
          } catch {}
        }
        setEvalLabel('Match Eval');
        break;
      
      case 'move':
        store.setCurrentFen(msg.data.fen);
        setCurrentEval(msg.data.eval);
        setLastMove({ from: msg.data.from, to: msg.data.to });
        store.setAutoPlayMoves([...store.autoPlayMoves, msg.data]);
        store.setEvalHistory([...store.evalHistory, msg.data.eval]);
        store.setAutoPlayIndex(store.autoPlayIndex + 1);
        break;
      
      case 'round-result':
        store.addRoundResult(msg.data);
        store.setPhase('ROUND_RESULT');
        break;
      
      case 'match-result':
        store.setPhase('MATCH_RESULT');
        break;
    }
  };

  // Send message to peer
  const sendToPeer = (type: string, data: any) => {
    Peer.sendMessage({ type, data });
  };

  // Create room (host)
  const handleCreateRoom = async () => {
    try {
      const id = await Peer.createRoom();
      setRoomId(id);
      setMyRole('host');
      setConnectionStatus('waiting');
    } catch (err) {
      console.error('Failed to create room:', err);
      setConnectionStatus('error');
    }
  };

  // Join room (guest)
  const handleJoinRoom = async () => {
    try {
      await Peer.joinRoom(joinCode);
      setMyRole('guest');
      setMyColor('b'); // Guest is always Black initially
      setConnectionStatus('connected');
      
      // Request game state from host
      sendToPeer('request-state', {});
    } catch (err) {
      console.error('Failed to join room:', err);
      setConnectionStatus('error');
    }
  };

  // Start match (host only)
  const handleStartMatch = async () => {
    if (myRole !== 'host') return;
    
    await store.startMatch();
    
    // Assign colors: host is always White in round 1
    setMyColor('w');
    store.setWhitePlayer('A'); // Host is player A
    
    // Send game state to guest
    sendToPeer('game-state', {
      ...store,
      guestColor: 'b', // Guest is Black
    });
    
    store.setPhase('PAWN_PLACEMENT_30');
    store.startTimer(30);
    sendToPeer('phase-change', { phase: 'PAWN_PLACEMENT_30', timer: 30 });
  };

  // Handle timer expiry (host only)
  useEffect(() => {
    if (myRole !== 'host') return;
    if (!store.phaseStartTime) return;
    
    const checkTimer = () => {
      const elapsed = (Date.now() - store.phaseStartTime) / 1000;
      const remaining = store.phaseDuration - elapsed;
      
      if (remaining <= 0) {
        // Timer expired
        if (store.phase === 'PAWN_PLACEMENT_30') {
          handlePawnTimeout();
        } else if (store.phase === 'PIECE_PLACEMENT_50') {
          handlePieceTimeout();
        } else if (store.phase === 'COMMANDER_DRAFT_12') {
          handleCommanderTimeout();
        }
      }
    };
    
    const interval = setInterval(checkTimer, 100);
    return () => clearInterval(interval);
  }, [store.phase, store.phaseStartTime, myRole]);

  // Handle pawn placement timeout (host only)
  const handlePawnTimeout = () => {
    if (myRole !== 'host') return;
    
    // Auto-place remaining pawns for both players
    const whitePawns = store.whitePlacement.filter(p => p.type === 'p');
    if (whitePawns.length < 8) {
      const occupied = new Set(store.whitePlacement.map(p => p.square));
      const needed = PAWN_PIECES.slice(whitePawns.length);
      const autoPlaced = autoPlacePieces(needed, 'w', 'pawns', occupied, Date.now());
      store.setPlacement('w', [...store.whitePlacement, ...autoPlaced]);
    }
    
    const blackPawns = store.blackPlacement.filter(p => p.type === 'p');
    if (blackPawns.length < 8) {
      const occupied = new Set(store.blackPlacement.map(p => p.square));
      const needed = PAWN_PIECES.slice(blackPawns.length);
      const autoPlaced = autoPlacePieces(needed, 'b', 'pawns', occupied, Date.now() + 1000);
      store.setPlacement('b', [...store.blackPlacement, ...autoPlaced]);
    }
    
    // Reveal pawns
    store.setPhase('PAWN_REVEAL');
    sendToPeer('reveal', {
      whitePlacement: store.whitePlacement,
      blackPlacement: store.blackPlacement,
    });
    
    setTimeout(() => {
      store.setPhase('PIECE_PLACEMENT_50');
      store.startTimer(50);
      sendToPeer('phase-change', { phase: 'PIECE_PLACEMENT_50', timer: 50 });
    }, 2000);
  };

  // Handle piece placement timeout (host only)
  const handlePieceTimeout = () => {
    if (myRole !== 'host') return;
    
    // Auto-place remaining pieces for both players
    const whiteCounts: Record<PieceType, number> = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };
    for (const p of store.whitePlacement) whiteCounts[p.type]++;
    const whiteNeeded: PieceType[] = [];
    for (const type of NON_PAWN_PIECES) {
      const target = type === 'r' || type === 'n' || type === 'b' ? 2 : 1;
      for (let i = whiteCounts[type]; i < target; i++) whiteNeeded.push(type);
    }
    if (whiteNeeded.length > 0) {
      const occupied = new Set(store.whitePlacement.map(p => p.square));
      const autoPlaced = autoPlacePieces(whiteNeeded, 'w', 'pieces', occupied, Date.now());
      store.setPlacement('w', [...store.whitePlacement, ...autoPlaced]);
    }
    
    const blackCounts: Record<PieceType, number> = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };
    for (const p of store.blackPlacement) blackCounts[p.type]++;
    const blackNeeded: PieceType[] = [];
    for (const type of NON_PAWN_PIECES) {
      const target = type === 'r' || type === 'n' || type === 'b' ? 2 : 1;
      for (let i = blackCounts[type]; i < target; i++) blackNeeded.push(type);
    }
    if (blackNeeded.length > 0) {
      const occupied = new Set(store.blackPlacement.map(p => p.square));
      const autoPlaced = autoPlacePieces(blackNeeded, 'b', 'pieces', occupied, Date.now() + 1000);
      store.setPlacement('b', [...store.blackPlacement, ...autoPlaced]);
    }
    
    // Full reveal
    store.setPhase('FULL_REVEAL');
    const fen = buildFenFromPlacement(store.whitePlacement, store.blackPlacement, true);
    store.setCurrentFen(fen);
    
    sendToPeer('reveal', {
      whitePlacement: store.whitePlacement,
      blackPlacement: store.blackPlacement,
      fen,
    });
    
    try {
      const chess = new Chess(fen);
      setCurrentEval(evaluatePosition(chess));
    } catch {}
    setEvalLabel('Match Eval');
    
    setTimeout(() => {
      store.setPhase('COMMANDER_DRAFT_12');
      store.startTimer(12);
      sendToPeer('phase-change', { phase: 'COMMANDER_DRAFT_12', timer: 12 });
    }, 2500);
  };

  // Handle commander draft timeout (host only)
  const handleCommanderTimeout = () => {
    if (myRole !== 'host') return;
    
    // Auto-pick for whoever hasn't picked
    if (!store.whiteCommanderPick) {
      const usedCmds = store.whitePlayer === 'A' ? store.usedCommanders.playerA : store.usedCommanders.playerB;
      const available = COMMANDERS.filter(c => !usedCmds.includes(c.id));
      if (available.length > 0) {
        store.setCommanderPick('w', available[0].id);
        sendToPeer('commander-pick', { color: 'w', commanderId: available[0].id });
      }
    }
    
    if (!store.blackCommanderPick) {
      const usedCmds = store.whitePlayer === 'A' ? store.usedCommanders.playerB : store.usedCommanders.playerA;
      const available = COMMANDERS.filter(c => !usedCmds.includes(c.id));
      if (available.length > 0) {
        store.setCommanderPick('b', available[0].id);
        sendToPeer('commander-pick', { color: 'b', commanderId: available[0].id });
      }
    }
    
    // Start auto-play
    setTimeout(() => {
      const state = useGameStore.getState();
      if (state.whiteCommanderPick && state.blackCommanderPick) {
        startAutoPlay();
      }
    }, 500);
  };

  // Handle piece placement
  const handlePlacePiece = (piece: PieceType, square: string) => {
    const placement = myColor === 'w' ? store.whitePlacement : store.blackPlacement;
    
    if (!isInZone(square, myColor)) return;
    if (placement.some(p => p.square === square)) return;
    if (piece === 'p' && !isValidPawnSquare(square, myColor)) return;
    if (piece === 'k' && !isValidKingSquare(square, myColor)) return;
    
    const counts: Record<PieceType, number> = { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 };
    for (const p of placement) counts[p.type]++;
    const maxCounts: Record<PieceType, number> = { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 };
    if (counts[piece] >= maxCounts[piece]) return;
    
    const newPiece: PlacedPiece = { type: piece, square, color: myColor };
    const newPlacement = [...placement, newPiece];
    
    if (myColor === 'w') store.setPlacement('w', newPlacement);
    else store.setPlacement('b', newPlacement);
    
    // Send to peer
    sendToPeer('placement', { color: myColor, pieces: newPlacement });
    
    // Update eval
    setEvalLabel('Your Formation');
    const pieceValues: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    let eval_ = 0;
    for (const p of newPlacement) {
      eval_ += myColor === 'w' ? (pieceValues[p.type] || 0) : -(pieceValues[p.type] || 0);
    }
    setCurrentEval(eval_);
  };

  // Handle commander pick
  const handleCommanderPick = (commanderId: string) => {
    store.setCommanderPick(myColor, commanderId);
    sendToPeer('commander-pick', { color: myColor, commanderId });
    
    // Check if both picked
    const state = useGameStore.getState();
    if (state.whiteCommanderPick && state.blackCommanderPick) {
      startAutoPlay();
    }
  };

  // Start auto-play (host only)
  const startAutoPlay = () => {
    if (myRole !== 'host') return;
    
    store.setPhase('AUTO_PLAY');
    setEvalLabel('Match Eval');
    sendToPeer('phase-change', { phase: 'AUTO_PLAY' });
    
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
    
    const chess = new Chess(fen);
    chessRef.current = chess;
    movesRef.current = [];
    setIsGenerating(true);
    
    store.setAutoPlayMoves([]);
    store.setEvalHistory([evaluatePosition(chess)]);
    store.setAutoPlayIndex(0);
    store.setIsAutoPlaying(true);
    
    // Generate moves
    const generateNextMove = () => {
      if (!chessRef.current || !whiteCmd || !blackCmd) {
        setIsGenerating(false);
        return;
      }
      
      if (chess.isGameOver() || movesRef.current.length >= MOVE_CAP) {
        setIsGenerating(false);
        finishRound();
        return;
      }
      
      const currentCmd = chess.turn() === 'w' ? whiteCmd : blackCmd;
      try {
        const result = getEngineMove(chess.fen(), currentCmd, movesRef.current.length);
        const move = chess.move(result.move.san);
        if (move) {
          const moveData = {
            from: move.from,
            to: move.to,
            san: move.san,
            fen: chess.fen(),
            eval: result.eval,
          };
          movesRef.current.push(moveData);
          
          // Send move to guest
          sendToPeer('move', moveData);
          
          // Update local state
          store.setCurrentFen(chess.fen());
          setCurrentEval(result.eval);
          setLastMove({ from: move.from, to: move.to });
          store.setAutoPlayMoves([...movesRef.current]);
          store.setEvalHistory([...store.evalHistory, result.eval]);
          store.setAutoPlayIndex(store.autoPlayIndex + 1);
          
          genTimerRef.current = setTimeout(generateNextMove, 800);
        } else {
          setIsGenerating(false);
          finishRound();
        }
      } catch (e) {
        console.error('Engine error:', e);
        setIsGenerating(false);
        finishRound();
      }
    };
    
    genTimerRef.current = setTimeout(generateNextMove, 500);
  };

  // Finish round (host only)
  const finishRound = () => {
    if (myRole !== 'host') return;
    
    const chess = chessRef.current;
    if (!chess) return;
    
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
    sendToPeer('round-result', result);
  };

  // Continue to next round (host only)
  const handleContinue = () => {
    if (myRole !== 'host') return;
    
    if (store.round >= 5) {
      if (store.scores.playerA === store.scores.playerB) {
        store.setPhase('TIEBREAK');
      } else {
        store.setPhase('MATCH_RESULT');
        sendToPeer('match-result', {});
      }
    } else {
      store.nextRound();
      sendToPeer('game-state', store);
    }
  };

  // Get remaining pieces
  const getRemainingPieces = (): PieceType[] => {
    const placement = myColor === 'w' ? store.whitePlacement : store.blackPlacement;
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

  // ===== LOBBY =====
  if (!myRole || connectionStatus === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md w-full">
          <div className="text-7xl mb-4">♟</div>
          <h1 className="text-4xl font-bold text-white mb-2">Roster Draft</h1>
          <h2 className="text-xl text-indigo-400 font-medium mb-8">Autochess</h2>
          
          {connectionStatus === 'idle' && (
            <>
              <div className="space-y-4 mb-6">
                <button
                  onClick={handleCreateRoom}
                  className="w-full px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-bold rounded-xl transition-all"
                >
                  Create Room
                </button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 text-gray-500 bg-gray-900">or</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter room code"
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    maxLength={6}
                  />
                  <button
                    onClick={handleJoinRoom}
                    disabled={joinCode.length !== 6}
                    className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                  >
                    Join
                  </button>
                </div>
              </div>
              
              <div className="bg-gray-800/60 rounded-xl p-5 text-left border border-gray-700">
                <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-wide">How to Play</h3>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>🌐 <strong>Online multiplayer</strong> — create a room and share the code</li>
                  <li>🙈 <strong>Blind placement</strong> — place pieces without seeing opponent</li>
                  <li>⚔ <strong>Commander draft</strong> — pick AI personas to pilot your army</li>
                  <li>🤖 <strong>Auto-play</strong> — spectate as commanders battle</li>
                  <li>🏆 <strong>Best of 5</strong> — most round wins takes the match</li>
                </ul>
              </div>
            </>
          )}
          
          {connectionStatus === 'waiting' && myRole === 'host' && (
            <div className="bg-gray-800/60 rounded-xl p-6 border border-gray-700">
              <div className="text-5xl mb-4 animate-pulse">⏳</div>
              <h3 className="text-xl text-white font-bold mb-2">Waiting for opponent...</h3>
              <p className="text-gray-400 mb-4">Share this room code:</p>
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <code className="text-3xl font-mono text-indigo-400 font-bold tracking-widest">
                  {roomId.replace('roster-', '')}
                </code>
              </div>
              <p className="text-sm text-gray-500">Or share the full ID: <code className="text-xs break-all">{roomId}</code></p>
            </div>
          )}
          
          {connectionStatus === 'connected' && myRole === 'host' && store.phase === 'LOBBY' && (
            <div className="bg-gray-800/60 rounded-xl p-6 border border-green-700">
              <div className="text-5xl mb-4">✓</div>
              <h3 className="text-xl text-white font-bold mb-2">Opponent Connected!</h3>
              <p className="text-gray-400 mb-6">Ready to start the match?</p>
              <button
                onClick={handleStartMatch}
                className="w-full px-8 py-4 bg-green-600 hover:bg-green-500 text-white text-lg font-bold rounded-xl transition-all"
              >
                Start Match
              </button>
            </div>
          )}
          
          {connectionStatus === 'connected' && myRole === 'guest' && store.phase === 'LOBBY' && (
            <div className="bg-gray-800/60 rounded-xl p-6 border border-blue-700">
              <div className="text-5xl mb-4 animate-pulse">⏳</div>
              <h3 className="text-xl text-white font-bold mb-2">Connected!</h3>
              <p className="text-gray-400">Waiting for host to start the match...</p>
            </div>
          )}
          
          {connectionStatus === 'error' && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-6">
              <div className="text-5xl mb-4">❌</div>
              <h3 className="text-xl text-red-400 font-bold mb-2">Connection Error</h3>
              <p className="text-gray-400 mb-4">Failed to connect. Please try again.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== MATCH RESULT =====
  if (store.phase === 'MATCH_RESULT') {
    const winner = store.scores.playerA > store.scores.playerB ? 'Player A' : 'Player B';
    const iWon = (myRole === 'host' && store.scores.playerA > store.scores.playerB) ||
                 (myRole === 'guest' && store.scores.playerB > store.scores.playerA);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md w-full">
          <div className="text-7xl mb-4">{iWon ? '🏆' : '😔'}</div>
          <h1 className="text-4xl font-bold text-white mb-2">
            {iWon ? 'Victory!' : 'Defeat'}
          </h1>
          <div className="text-2xl text-gray-300 mb-6">
            {store.scores.playerA} — {store.scores.playerB}
          </div>
          <RoundTracker currentRound={store.round} totalRounds={5} scores={store.scores} roundResults={store.roundResults} />
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg"
          >
            New Match
          </button>
        </div>
      </div>
    );
  }

  // ===== MAIN GAME =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white">♟ Roster Draft Autochess</h1>
            <div className="text-xs text-gray-400">
              You are {myColor === 'w' ? 'White ♔' : 'Black ♚'} • Round {store.round}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Room: {roomId.replace('roster-', '')}</div>
            <div className="text-xs text-green-400">✓ Connected</div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          {/* Left - Commander Roster */}
          <div className="lg:w-52 order-2 lg:order-1">
            <CommanderRoster
              usedCommanders={myRole === 'host' ? store.usedCommanders.playerA : store.usedCommanders.playerB}
              selectedCommander={myColor === 'w' ? store.whiteCommanderPick : store.blackCommanderPick}
              onPick={store.phase === 'COMMANDER_DRAFT_12' ? handleCommanderPick : undefined}
              label={`Your Commanders`}
              color={myColor === 'w' ? 'white' : 'black'}
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
                  color={store.phase === 'COMMANDER_DRAFT_12' ? 'green' : 'amber'}
                />
              </div>
            )}

            {/* Phase info */}
            <div className="mb-2 text-center min-h-[24px]">
              {isPlacingPhase && (
                <div className="text-xs sm:text-sm text-gray-300">
                  Place your <span className="font-bold text-yellow-400">
                    {store.phase === 'PAWN_PLACEMENT_30' ? 'Pawns' : 'Pieces'}
                  </span>
                </div>
              )}
              {store.phase === 'COMMANDER_DRAFT_12' && (
                <div className="text-sm text-green-400 font-medium">⚔ Draft your Commander!</div>
              )}
              {store.phase === 'AUTO_PLAY' && (
                <div className="text-xs sm:text-sm text-blue-400 font-medium">
                  {isGenerating ? (
                    <>⚙️ Preparing battle... ({store.autoPlayMoves.length} moves)</>
                  ) : (
                    <>🤖 Move {store.autoPlayIndex} of {store.autoPlayMoves.length}</>
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

            {/* Board with eval bar */}
            <div className="flex gap-2 items-stretch">
              <EvalBar eval={currentEval} label={evalLabel} />
              <div className="flex flex-col items-center">
                <Board
                  fen={store.currentFen || undefined}
                  placement={isPlacingPhase ? (myColor === 'w' ? store.whitePlacement : store.blackPlacement) : undefined}
                  placementColor={isPlacingPhase ? myColor : undefined}
                  placementPhase={isPlacingPhase ? (store.phase === 'PAWN_PLACEMENT_30' ? 'pawns' : 'pieces') : undefined}
                  onPlacePiece={isPlacingPhase ? handlePlacePiece : undefined}
                  selectedPiece={isPlacingPhase ? selectedPiece : undefined}
                  highlightZone={isPlacingPhase ? myColor : undefined}
                  occupiedSquares={isPlacingPhase ? new Set((myColor === 'w' ? store.whitePlacement : store.blackPlacement).map(p => p.square)) : undefined}
                  lastMove={lastMove}
                  flipped={myColor === 'b'}
                  interactive={isPlacingPhase}
                />

                {/* Piece tray */}
                {isPlacingPhase && (
                  <div className="mt-3 w-full max-w-md">
                    {!selectedPiece && getRemainingPieces().length > 0 && (
                      <div className="text-xs text-yellow-400 text-center mb-2 animate-pulse">
                        ↑ Select a piece, then click a square
                      </div>
                    )}
                    <PieceTray
                      pieces={getRemainingPieces()}
                      onSelectPiece={setSelectedPiece}
                      selectedPiece={selectedPiece}
                      label={`Your ${store.phase === 'PAWN_PLACEMENT_30' ? 'Pawns' : 'Pieces'}`}
                    />
                  </div>
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
          </div>
        </div>
      </div>

      {/* Round result recap - both see it, only host can continue */}
      {store.phase === 'ROUND_RESULT' && store.currentRoundResult && (
        <RoundRecap 
          result={store.currentRoundResult} 
          onContinue={myRole === 'host' ? handleContinue : () => {}}
          showContinue={myRole === 'host'}
        />
      )}
    </div>
  );
}
