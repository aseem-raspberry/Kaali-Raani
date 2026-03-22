# Kaali Rani - Architecture Documentation

A real-time multiplayer card game built with Node.js, Express, and Socket.io.

---

## System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        B1[Browser 1<br/>Player 1]
        B2[Browser 2<br/>Player 2]
        B3[Browser 3<br/>Player 3]
        BN[Browser N<br/>Player N]
    end
    
    subgraph "Server Layer"
        S[Express Server<br/>Port 3000]
        SI[Socket.io Server]
        GL[Game Logic Module]
    end
    
    subgraph "Data Layer"
        RM[Rooms Map]
        PS[Player Sessions]
    end
    
    B1 <-->|WebSocket| SI
    B2 <-->|WebSocket| SI
    B3 <-->|WebSocket| SI
    BN <-->|WebSocket| SI
    
    S --> SI
    SI --> GL
    GL --> RM
    GL --> PS
```

---

## Project Structure

```
Kaali Raani/
├── server.js        # Express + Socket.io server, game orchestration
├── gameLogic.js     # Pure game logic functions (deck, scoring, rules)
├── package.json     # Dependencies
└── public/
    ├── index.html   # UI with Tailwind CSS
    ├── game.js      # Client-side Socket.io handling
    └── styles.css   # Custom card and table styles
```

---

## Game Flow State Machine

```mermaid
stateDiagram-v2
    [*] --> WAITING: Create/Join Room
    WAITING --> BIDDING: Host clicks Start (3-6 players)
    BIDDING --> TRUMP_SELECTION: One bidder remains
    TRUMP_SELECTION --> PARTNER_SELECTION: Raja selects suit
    PARTNER_SELECTION --> PLAYING: Raja selects partner card
    PLAYING --> PLAYING: Trick complete, cards remain
    PLAYING --> GAME_OVER: Raja team reaches bid OR All cards played
    GAME_OVER --> WAITING: New Game
```

---

## Socket.io Message Flow

### Room Creation & Joining

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant R as Room Storage
    
    C->>S: createRoom {playerName}
    S->>R: Create room with UUID
    S->>C: roomCreated {roomId, playerId, isHost}
    S->>C: playerJoined {players[]}
    
    Note over C,S: Other players join...
    
    C->>S: joinRoom {roomId, playerName}
    S->>R: Add player to room
    S->>C: roomJoined {roomId, playerId, isHost}
    S-->>All: playerJoined {players[]}
```

### Game Start & Bidding

```mermaid
sequenceDiagram
    participant H as Host
    participant S as Server
    participant All as All Players
    
    H->>S: startGame
    S->>S: createDeck(), shuffleDeck(), dealCards()
    S-->>All: gameStarted {gameState}
    
    loop Bidding Phase
        S-->>All: gameStateUpdate {currentPlayerId, currentBid}
        alt Player Bids
            All->>S: placeBid {bidAmount}
        else Player Passes
            All->>S: passBid
        end
    end
    
    Note over S: Last bidder becomes Raja
```

### Trump & Partner Selection

```mermaid
sequenceDiagram
    participant Raja as Raja
    participant S as Server
    participant All as All Players
    
    S-->>All: gameStateUpdate {phase: trump_selection}
    Raja->>S: selectTrump {suit}
    S-->>All: gameStateUpdate {trumpSuit, phase: partner_selection}
    Raja->>S: selectPartner {card}
    S->>S: Find partner (hidden)
    S-->>All: gameStateUpdate {partnerCard, phase: playing}
```

### Playing Phase

```mermaid
sequenceDiagram
    participant P as Current Player
    participant S as Server
    participant All as All Players
    
    loop Until game over
        P->>S: playCard {card}
        S->>S: Validate play, check partner reveal
        S-->>All: gameStateUpdate {currentTrick}
        
        alt Trick Complete (N cards played)
            S->>S: determineTrickWinner()
            S-->>All: trickComplete {winnerId, completedTrick}
            
            alt Raja team reached bid
                S-->>All: gameOver {scores}
            end
        end
    end
```

---

## Key Server Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `createRoom` | C→S | `{playerName}` | Create new game room |
| `roomCreated` | S→C | `{roomId, playerId, isHost}` | Room created confirmation |
| `joinRoom` | C→S | `{roomId, playerName}` | Join existing room |
| `roomJoined` | S→C | `{roomId, playerId, isHost}` | Join confirmation |
| `playerJoined` | S→All | `{players[]}` | Player list update |
| `startGame` | C→S | - | Host starts game |
| `gameStarted` | S→All | `{gameState}` | Game begins, cards dealt |
| `placeBid` | C→S | `{bidAmount}` | Place a bid |
| `passBid` | C→S | - | Pass on bidding |
| `selectTrump` | C→S | `{suit}` | Raja selects trump |
| `selectPartner` | C→S | `{card}` | Raja selects partner card |
| `playCard` | C→S | `{card}` | Play a card |
| `gameStateUpdate` | S→All | `{gameState}` | State sync after actions |
| `trickComplete` | S→All | `{winnerId, completedTrick}` | Trick ended |
| `gameOver` | S→All | `{scores}` | Game finished |

---

## Game State Object

```javascript
{
  roomId: "ABC123",
  phase: "playing",
  myHand: [{suit, rank}, ...],        // Player's cards
  otherPlayers: [{id, name, cardCount}, ...],
  playerOrder: [{id, name}, ...],
  currentPlayerId: "uuid",            // Whose turn
  currentBid: 75,
  rajaId: "uuid",
  trumpSuit: "spades",
  partnerCard: {suit: "hearts", rank: "A"},
  partnerRevealed: false,
  currentTrick: [{playerId, playerName, card}, ...],
  allPlayersPoints: {playerId: {name, points}, ...}
}
```

---

## Scoring System

| Card | Points |
|------|--------|
| Ace | 10 |
| 10 | 10 |
| 5 | 5 |
| Queen of Spades (Kaali Rani) | 30 |
| Others | 0 |

**Win Condition**: Raja team must reach their bid. Game ends early if they do.

---

## Client-Side Features

- **Turn Indicator**: 2-second popup when it's your turn
- **Timeout Warning**: After 30 seconds, reminder flashes
- **Trick Delay**: Cards visible for 10 seconds after trick ends
- **Card Sorting**: Black-Red-Black-Red (♠, ♥, ♣, ♦)
- **Live Scorecard**: All players' points visible in real-time
