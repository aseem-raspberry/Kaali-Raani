# Kaali Raani 🃏👑

**Kaali Raani** (Hindi: *काली रानी*, "Black Queen") is an entirely vibe coded real-time multiplayer trick-taking card game for 3–6 players, built with Node.js, Express, and Socket.io within Google Antigravity.

---

## Installation & Setup

### Prerequisites
- Git: https://git-scm.com/book/en/v2/Getting-Started-Installing-Git 
- [Node.js](https://nodejs.org/) v16 or higher
- npm (bundled with Node.js)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/aseem-raspberry/Kaali-Raani.git
cd Kaali-Raani

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

Then open your browser and go to:
```
http://localhost:3000
```

Share this URL with other players on your local network using your machine's IP address, e.g. `http://192.168.x.x:3000`.

---

## How to Play

### Lobby

1. Enter your name on the home screen.
2. Click **Create Room** to start a new room — you'll get a 6-character room code.
3. To join an existing room, click **Join Room** and either:
   - Select an active room directly from the **Available Rooms** dropdown.
   - Or, manually enter the 6-character room code shared by the host.
4. Once **3 or more players** have joined, the host clicks **Start Game**.

---

## Game Rules

### Objective
Win points by capturing high-value cards in tricks. The **Bid winner's team** (bid winner + secret partner) must meet or exceed their bid. The team that fails loses points.

---

### The Deck
- Standard 52-card deck.
- Low cards (2s, 3s) may be removed to make the deck divide evenly among all players.
- Cards are dealt equally to all players.

---

### Phase 1 — Bidding

Players take turns bidding the minimum number of points they believe their team can win:

- Starting bid: **60**
- Bids must be in **increments of 5** (e.g. 65, 70, 75…)
- Maximum bid: **130**
- A player may **Pass** instead of bidding
- Bidding ends when only one active bidder remains — they become the **Raja** 👑
- If everyone passes without bidding, the first player is forced to bid

---

### Phase 2 — Trump Selection

The **Raja** selects a **trump suit** (♠ ♥ ♦ ♣). Trump cards beat all other suits during play.

---

### Phase 3 — Partner Selection

The Raja names one card (e.g. *King of Hearts*). Whoever holds that card in their hand is the Raja's **secret partner** — but no one knows who it is until that card is played.

- While technically the Raja **can** select a card from their own hand, it is not recommended as they loses the help they could have got from extra partner.
- The partner's identity is hidden until the designated card is played during the game.

---

### Phase 4 — Playing Tricks

Players take turns playing one card per trick, starting with the Raja:

- **Lead**: The first player may play any card.
- **Follow suit**: All other players **must** play a card of the same suit if they have one.
- **Trump**: If you cannot follow suit, you may play any card including a trump.
- The highest trump wins the trick. If no trumps are played, the highest card of the led suit wins.
- The trick winner leads the next trick.

#### Card Point Values

| Card | Points |
|---|---|
| Queen of Spades ♠ (Kaali Raani) | **30** |
| All Aces | **10** each |
| All 10s | **10** each |
| All 5s | **5** each |
| All other cards | 0 |

> **Total points in a full game = 130**

---

### Phase 5 — Scoring

At the end of the round:

- **Raja's team wins** if their combined points ≥ the bid → Each team member earns **+bid** points to their cumulative score.
- **Raja's team loses** if their combined points < the bid → Each team member loses **−bid** points.
- **Defenders** (non-Raja, non-partner players) always score **0 points change** regardless of outcome.

Cumulative scores are tracked across multiple rounds in the **Leaderboard** (top-right corner).

---

### Early Win

If the Raja's team accumulates enough points to meet the bid **before all tricks are played**, the round ends immediately and they win.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express |
| Real-time | Socket.io |
| Frontend | Vanilla HTML/CSS/JS |
| IDs | UUID v4 |

---

## License

MIT
