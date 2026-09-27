# Online Multiplayer Implementation - Summary

## What Was Fixed

The original implementation was a **hot-seat game** (both players on the same device), but the design called for **online multiplayer**. This has been completely rewritten to support true peer-to-peer online play.

## How It Works Now

### Connection Flow

1. **Host creates a room:**
   - PeerJS generates a unique peer ID
   - Host sees a 6-character room code
   - Host shares the code with their opponent

2. **Guest joins:**
   - Guest enters the room code
   - PeerJS establishes a WebRTC connection
   - Both players are now connected peer-to-peer

3. **Game starts:**
   - Host clicks "Start Match"
   - Host is assigned White, Guest is Black
   - Game state syncs between both browsers

### Architecture

**Host (Authority):**
- Creates the PeerJS peer
- Owns all timers
- Handles RNG for auto-placement
- Triggers reveals at timer expiry
- Runs the chess engine for auto-play
- Streams moves to guest in real-time

**Guest:**
- Connects to host's peer ID
- Sends their placements and commander picks
- Receives state updates from host
- Renders the same game from their perspective

### Message Protocol

All communication happens via WebRTC data channels:

```typescript
// Host → Guest
'game-state'      // Full state sync
'phase-change'    // Timer/phase updates
'reveal'          // Position reveal
'move'            // Auto-play move
'round-result'    // Round outcome
'match-result'    // Match outcome

// Guest → Host
'request-state'   // Request initial state
'placement'       // Piece placement
'commander-pick'  // Commander selection
```

### Key Features

✅ **True online multiplayer** — No server needed, peer-to-peer via WebRTC  
✅ **Each player sees only their own board** during blind placement  
✅ **Host acts as authority** — Timers, RNG, reveals, engine  
✅ **Real-time sync** — Moves stream as they're generated  
✅ **Color alternation** — Rounds 1-4 alternate, Round 5 trailing player chooses  
✅ **Sequential draft in Round 5** — White reveals first to offset first-move advantage  

### Technical Details

- **PeerJS** handles WebRTC signaling and connection management
- **Host authority** prevents most cheating (but not all — a dedicated server would be needed for full security)
- **Lazy move generation** — Engine generates moves one at a time with 100ms delays to avoid freezing
- **Depth scaling** — Engine depth varies by commander skill (1-3) for performance
- **State sync** — Full game state sent on connection, then incremental updates

## How to Test

1. Open the game in two browser tabs (or two different browsers/devices)
2. Tab 1: Click "Create Room" → copy the room code
3. Tab 2: Enter the room code → Click "Join"
4. Tab 1: Click "Start Match"
5. Both tabs now show the game — each player sees their own perspective
6. Play through all 5 rounds!

## Files Changed

- `src/net/peer.ts` — **NEW** — PeerJS wrapper for WebRTC connections
- `src/App.tsx` — **COMPLETE REWRITE** — Online multiplayer logic
- `src/components/RoundRecap.tsx` — Added `showContinue` prop for guest/host distinction
- `README.md` — **COMPLETE REWRITE** — Online multiplayer documentation

## What Players Experience

### Host Perspective
1. Create room → See room code
2. Wait for guest to connect
3. Click "Start Match"
4. Play as White (Round 1)
5. Host controls all timers and reveals

### Guest Perspective
1. Enter room code → Join
2. See "Waiting for host..." screen
3. Game starts automatically when host clicks "Start Match"
4. Play as Black (Round 1)
5. Receive all state updates from host

## Limitations

- **Host authority** — The host could theoretically cheat by modifying their client. A dedicated server would prevent this.
- **No reconnection** — If a peer disconnects, the match ends.
- **Browser compatibility** — WebRTC requires modern browsers (Chrome, Firefox, Safari, Edge).
- **NAT traversal** — PeerJS uses public STUN servers, but some restrictive networks may block connections.

## Future Improvements

- Dedicated server for full authority
- Reconnection logic
- Spectator mode
- Move animations
- Sound effects
- Mobile-optimized layout
