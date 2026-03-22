/**
 * Kaali Rani - Main Server
 * Express + Socket.io server for real-time multiplayer
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const gameLogic = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state storage
const rooms = new Map();

// Game phases
const PHASES = {
    WAITING: 'waiting',
    BIDDING: 'bidding',
    TRUMP_SELECTION: 'trump_selection',
    PARTNER_SELECTION: 'partner_selection',
    PLAYING: 'playing',
    ROUND_END: 'round_end',
    GAME_OVER: 'game_over'
};

/**
 * Create a new room
 */
function createRoom(hostId, hostName) {
    const roomId = uuidv4().substring(0, 6).toUpperCase();

    const room = {
        id: roomId,
        hostId,
        players: new Map(),
        phase: PHASES.WAITING,
        currentBid: 60,
        highestBidder: null,
        passedPlayers: new Set(),
        rajaId: null,
        trumpSuit: null,
        partnerCard: null,
        partnerId: null,
        partnerRevealed: false,
        currentTrick: [],
        currentPlayerIndex: 0,
        tricksPlayed: 0,
        playerOrder: [],
        wonCards: new Map(), // playerId -> array of won cards
        cumulativeScores: new Map(), // playerId -> cumulative score across games
        gamesPlayed: 0
    };

    rooms.set(roomId, room);
    return room;
}

/**
 * Get list of available rooms
 */
function getAvailableRooms() {
    const available = [];
    for (const [roomId, room] of rooms.entries()) {
        if (room.phase === PHASES.WAITING && room.players.size < 6) {
            available.push({
                id: roomId,
                hostName: room.players.get(room.hostId)?.name || 'Unknown',
                playerCount: room.players.size
            });
        }
    }
    return available;
}

/**
 * Add player to room
 */
function addPlayerToRoom(room, playerId, playerName, socketId) {
    if (room.players.size >= 6) {
        return { success: false, error: 'Room is full (max 6 players)' };
    }

    if (room.phase !== PHASES.WAITING) {
        return { success: false, error: 'Game already in progress' };
    }

    room.players.set(playerId, {
        id: playerId,
        name: playerName,
        socketId,
        hand: [],
        connected: true
    });

    room.wonCards.set(playerId, []);

    return { success: true };
}

/**
 * Start the game - deal cards and begin bidding
 */
function startGame(room) {
    const playerCount = room.players.size;

    if (playerCount < 3) {
        return { success: false, error: 'Need at least 3 players to start' };
    }

    // Create and shuffle deck
    const deck = gameLogic.createDeck(playerCount);
    const shuffledDeck = gameLogic.shuffleDeck(deck);
    const hands = gameLogic.dealCards(shuffledDeck, playerCount);

    // Set player order and deal cards
    room.playerOrder = Array.from(room.players.keys());
    room.playerOrder.forEach((playerId, index) => {
        const player = room.players.get(playerId);
        player.hand = gameLogic.sortCards(hands[index]);
    });

    // Initialize game state
    room.phase = PHASES.BIDDING;
    room.currentBid = 60;
    room.highestBidder = null;
    room.passedPlayers = new Set();
    room.currentPlayerIndex = 0;
    room.rajaId = null;
    room.trumpSuit = null;
    room.partnerCard = null;
    room.partnerId = null;
    room.partnerRevealed = false;
    room.currentTrick = [];
    room.tricksPlayed = 0;

    // Reset won cards
    room.playerOrder.forEach(playerId => {
        room.wonCards.set(playerId, []);
    });

    return { success: true };
}

/**
 * Handle a bid
 */
function placeBid(room, playerId, bidAmount) {
    if (room.phase !== PHASES.BIDDING) {
        return { success: false, error: 'Not in bidding phase' };
    }

    const currentPlayerId = room.playerOrder[room.currentPlayerIndex];
    if (playerId !== currentPlayerId) {
        return { success: false, error: 'Not your turn to bid' };
    }

    if (bidAmount <= room.currentBid) {
        return { success: false, error: 'Bid must be higher than current bid' };
    }

    if (bidAmount > 130) {
        return { success: false, error: 'Maximum bid is 130' };
    }

    if (bidAmount % 5 !== 0) {
        return { success: false, error: 'Bids must be in increments of 5' };
    }

    room.currentBid = bidAmount;
    room.highestBidder = playerId;

    // Move to next player
    advanceBiddingTurn(room);

    return { success: true };
}

/**
 * Handle a pass
 */
function passBid(room, playerId) {
    if (room.phase !== PHASES.BIDDING) {
        return { success: false, error: 'Not in bidding phase' };
    }

    const currentPlayerId = room.playerOrder[room.currentPlayerIndex];
    if (playerId !== currentPlayerId) {
        return { success: false, error: 'Not your turn' };
    }

    room.passedPlayers.add(playerId);

    // Check if bidding is complete
    const activeBidders = room.playerOrder.filter(id => !room.passedPlayers.has(id));

    if (activeBidders.length === 1 && room.highestBidder) {
        // Last person standing with a bid wins
        room.rajaId = room.highestBidder;
        room.phase = PHASES.TRUMP_SELECTION;
        return { success: true, biddingComplete: true };
    }

    if (activeBidders.length === 0) {
        // Everyone passed without bidding - first player must bid
        if (!room.highestBidder) {
            room.passedPlayers.clear();
            room.currentPlayerIndex = 0;
            return { success: true, forceBid: true };
        }
    }

    advanceBiddingTurn(room);

    return { success: true };
}

/**
 * Advance to next bidder (skip passed players)
 */
function advanceBiddingTurn(room) {
    const playerCount = room.playerOrder.length;
    let attempts = 0;

    do {
        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % playerCount;
        attempts++;
    } while (
        room.passedPlayers.has(room.playerOrder[room.currentPlayerIndex]) &&
        attempts < playerCount
    );

    // Check if only one active bidder remains
    const activeBidders = room.playerOrder.filter(id => !room.passedPlayers.has(id));
    if (activeBidders.length === 1 && room.highestBidder) {
        room.rajaId = room.highestBidder;
        room.phase = PHASES.TRUMP_SELECTION;
    }
}

/**
 * Set trump suit
 */
function selectTrump(room, playerId, suit) {
    if (room.phase !== PHASES.TRUMP_SELECTION) {
        return { success: false, error: 'Not in trump selection phase' };
    }

    if (playerId !== room.rajaId) {
        return { success: false, error: 'Only the Raja can select trump' };
    }

    if (!gameLogic.SUITS.includes(suit)) {
        return { success: false, error: 'Invalid suit' };
    }

    room.trumpSuit = suit;
    room.phase = PHASES.PARTNER_SELECTION;

    return { success: true };
}

/**
 * Set partner card
 */
function selectPartner(room, playerId, card) {
    if (room.phase !== PHASES.PARTNER_SELECTION) {
        return { success: false, error: 'Not in partner selection phase' };
    }

    if (playerId !== room.rajaId) {
        return { success: false, error: 'Only the Raja can select partner' };
    }

    // Validate card
    if (!gameLogic.SUITS.includes(card.suit) || !gameLogic.RANKS.includes(card.rank)) {
        return { success: false, error: 'Invalid card' };
    }

    // Raja cannot select a card they hold themselves
    const rajaHand = room.players.get(room.rajaId).hand;
    const rajaHasCard = rajaHand.some(c => c.suit === card.suit && c.rank === card.rank);

    if (rajaHasCard) {
        return { success: false, error: 'You cannot select a card from your own hand' };
    }

    room.partnerCard = card;

    // Find who holds the partner card (hidden from players)
    room.partnerId = gameLogic.findCardHolder(
        Object.fromEntries(room.players),
        card
    );

    // Start playing phase - Raja leads first
    room.phase = PHASES.PLAYING;
    room.currentPlayerIndex = room.playerOrder.indexOf(room.rajaId);

    return { success: true };
}

/**
 * Play a card
 */
function playCard(room, playerId, card) {
    if (room.phase !== PHASES.PLAYING) {
        return { success: false, error: 'Not in playing phase' };
    }

    const currentPlayerId = room.playerOrder[room.currentPlayerIndex];
    if (playerId !== currentPlayerId) {
        return { success: false, error: 'Not your turn' };
    }

    const player = room.players.get(playerId);
    const cardIndex = player.hand.findIndex(
        c => c.suit === card.suit && c.rank === card.rank
    );

    if (cardIndex === -1) {
        return { success: false, error: 'Card not in hand' };
    }

    // Validate play (follow suit if possible)
    const ledSuit = room.currentTrick.length > 0 ? room.currentTrick[0].card.suit : null;

    if (!gameLogic.isValidPlay(card, player.hand, ledSuit)) {
        return { success: false, error: 'You must follow the led suit' };
    }

    // Remove card from hand
    player.hand.splice(cardIndex, 1);

    // Add to current trick
    room.currentTrick.push({ playerId, card });

    // Check if partner is revealed
    let partnerJustRevealed = false;
    if (!room.partnerRevealed && gameLogic.isPartnerCard(card, room.partnerCard)) {
        room.partnerRevealed = true;
        partnerJustRevealed = true;
    }

    // Check if trick is complete
    if (room.currentTrick.length === room.players.size) {
        // Determine winner
        const winnerId = gameLogic.determineTrickWinner(room.currentTrick, room.trumpSuit);

        // Give cards to winner
        const wonCards = room.currentTrick.map(t => t.card);
        room.wonCards.get(winnerId).push(...wonCards);

        // Clear trick and set next leader
        // Create completed trick with player names
        const completedTrick = room.currentTrick.map(t => ({
            playerId: t.playerId,
            playerName: room.players.get(t.playerId).name,
            card: t.card
        }));
        room.currentTrick = [];
        room.tricksPlayed++;
        room.currentPlayerIndex = room.playerOrder.indexOf(winnerId);

        // Calculate current Raja team points
        const rajaTeamPoints = calculateRajaTeamPoints(room);

        // Check if Raja team has reached the bid (early win condition)
        if (rajaTeamPoints >= room.currentBid) {
            room.phase = PHASES.GAME_OVER;
            return {
                success: true,
                trickComplete: true,
                winnerId,
                completedTrick,
                partnerJustRevealed,
                gameOver: true,
                earlyWin: true,
                scores: calculateFinalScores(room)
            };
        }

        // Check if game is over (no cards remaining)
        const cardsRemaining = Array.from(room.players.values()).some(p => p.hand.length > 0);

        if (!cardsRemaining) {
            room.phase = PHASES.GAME_OVER;
            return {
                success: true,
                trickComplete: true,
                winnerId,
                completedTrick,
                partnerJustRevealed,
                gameOver: true,
                scores: calculateFinalScores(room)
            };
        }

        return {
            success: true,
            trickComplete: true,
            winnerId,
            completedTrick,
            partnerJustRevealed
        };
    }

    // Move to next player
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.playerOrder.length;

    return { success: true, partnerJustRevealed };
}

/**
 * Calculate current Raja team points (for early win check)
 */
function calculateRajaTeamPoints(room) {
    let rajaTeamPoints = 0;

    for (const [playerId, cards] of room.wonCards) {
        if (playerId === room.rajaId || playerId === room.partnerId) {
            rajaTeamPoints += gameLogic.calculateTrickPoints(cards);
        }
    }

    return rajaTeamPoints;
}

/**
 * Calculate final scores
 */
function calculateFinalScores(room) {
    const scores = {};
    let rajaTeamPoints = 0;
    let defenderPoints = 0;

    for (const [playerId, cards] of room.wonCards) {
        const points = gameLogic.calculateTrickPoints(cards);
        scores[playerId] = points;

        if (playerId === room.rajaId || playerId === room.partnerId) {
            rajaTeamPoints += points;
        } else {
            defenderPoints += points;
        }
    }

    const rajaTeamWins = rajaTeamPoints >= room.currentBid;

    // Update cumulative scores: 
    // - Raja/Partner get +/- Bid
    // - Defenders get 0 points change
    const bidValue = room.currentBid;
    for (const [playerId] of room.players) {
        const prev = room.cumulativeScores.get(playerId) || 0;
        const isRajaTeam = (playerId === room.rajaId || playerId === room.partnerId);

        if (isRajaTeam) {
            if (rajaTeamWins) {
                room.cumulativeScores.set(playerId, prev + bidValue);
            } else {
                room.cumulativeScores.set(playerId, prev - bidValue);
            }
        } else {
            // Defenders get 0 points change (as requested)
            room.cumulativeScores.set(playerId, prev);
        }
    }
    room.gamesPlayed++;

    // Build cumulative scores object for response
    const cumulative = {};
    for (const [playerId, score] of room.cumulativeScores) {
        const player = room.players.get(playerId);
        cumulative[playerId] = {
            name: player ? player.name : 'Unknown',
            score
        };
    }

    return {
        individual: scores,
        rajaTeamPoints,
        defenderPoints,
        targetBid: room.currentBid,
        rajaTeamWins,
        rajaId: room.rajaId,
        partnerId: room.partnerId,
        cumulativeScores: cumulative,
        gamesPlayed: room.gamesPlayed
    };
}

/**
 * Get game state for a specific player (hides sensitive info)
 */
function getGameStateForPlayer(room, playerId) {
    const player = room.players.get(playerId);

    const otherPlayers = [];
    for (const [id, p] of room.players) {
        if (id !== playerId) {
            otherPlayers.push({
                id: p.id,
                name: p.name,
                cardCount: p.hand.length,
                connected: p.connected,
                hasPassed: room.passedPlayers.has(id)
            });
        }
    }

    // Calculate all players' points
    const allPlayersPoints = {};
    for (const [id, cards] of room.wonCards) {
        const playerInfo = room.players.get(id);
        allPlayersPoints[id] = {
            name: playerInfo ? playerInfo.name : 'Unknown',
            points: gameLogic.calculateTrickPoints(cards)
        };
    }

    const state = {
        roomId: room.id,
        phase: room.phase,
        myHand: player ? player.hand : [],
        otherPlayers,
        playerOrder: room.playerOrder.map(id => ({
            id,
            name: room.players.get(id).name
        })),
        currentPlayerIndex: room.currentPlayerIndex,
        currentPlayerId: room.playerOrder[room.currentPlayerIndex],
        currentBid: room.currentBid,
        highestBidder: room.highestBidder,
        highestBidderName: room.highestBidder ? room.players.get(room.highestBidder).name : null,
        rajaId: room.rajaId,
        rajaName: room.rajaId ? room.players.get(room.rajaId).name : null,
        trumpSuit: room.trumpSuit,
        currentTrick: room.currentTrick.map(t => ({
            playerId: t.playerId,
            playerName: room.players.get(t.playerId).name,
            card: t.card
        })),
        tricksPlayed: room.tricksPlayed,
        partnerRevealed: room.partnerRevealed,
        partnerCard: room.partnerCard, // Show partner card to everyone
        partnerId: room.partnerRevealed ? room.partnerId : null,
        partnerName: room.partnerRevealed && room.partnerId ? room.players.get(room.partnerId).name : null,
        isRaja: playerId === room.rajaId,
        isPartner: playerId === room.partnerId,
        myWonCards: room.wonCards.get(playerId) || [],
        myPoints: gameLogic.calculateTrickPoints(room.wonCards.get(playerId) || []),
        allPlayersPoints, // Current game points
        cumulativeScores: Object.fromEntries( // Total scores across games
            Array.from(room.cumulativeScores.entries()).map(([id, score]) => [
                id,
                { name: room.players.get(id)?.name || 'Unknown', score }
            ])
        )
    };

    return state;
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send initial list of available rooms
    socket.emit('availableRoomsUpdate', getAvailableRooms());

    let currentRoom = null;
    let currentPlayerId = null;

    // Create a new room
    socket.on('createRoom', ({ playerName }) => {
        currentPlayerId = uuidv4();
        const room = createRoom(currentPlayerId, playerName);
        currentRoom = room.id;

        const result = addPlayerToRoom(room, currentPlayerId, playerName, socket.id);

        if (result.success) {
            socket.join(room.id);
            socket.emit('roomCreated', {
                roomId: room.id,
                playerId: currentPlayerId,
                isHost: true
            });
            io.to(room.id).emit('playerJoined', {
                players: Array.from(room.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    isHost: p.id === room.hostId
                }))
            });
            // Update all lobby clients
            io.emit('availableRoomsUpdate', getAvailableRooms());
        } else {
            socket.emit('error', { message: result.error });
        }
    });

    // Join existing room
    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = rooms.get(roomId.toUpperCase());

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        currentPlayerId = uuidv4();
        currentRoom = room.id;

        const result = addPlayerToRoom(room, currentPlayerId, playerName, socket.id);

        if (result.success) {
            socket.join(room.id);
            socket.emit('roomJoined', {
                roomId: room.id,
                playerId: currentPlayerId,
                isHost: false
            });
            io.to(room.id).emit('playerJoined', {
                players: Array.from(room.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    isHost: p.id === room.hostId
                }))
            });
            // Update all lobby clients
            io.emit('availableRoomsUpdate', getAvailableRooms());
        } else {
            socket.emit('error', { message: result.error });
        }
    });

    // Start game
    socket.on('startGame', () => {
        const room = rooms.get(currentRoom);
        if (!room) return;

        if (currentPlayerId !== room.hostId) {
            socket.emit('error', { message: 'Only the host can start the game' });
            return;
        }

        const result = startGame(room);

        if (result.success) {
            // Send game state to each player with their own cards
            for (const [playerId, player] of room.players) {
                io.to(player.socketId).emit('gameStarted', getGameStateForPlayer(room, playerId));
            }
            // Update all clients since room is no longer waiting
            io.emit('availableRoomsUpdate', getAvailableRooms());
        } else {
            socket.emit('error', { message: result.error });
        }
    });

    // Place bid
    socket.on('placeBid', ({ bidAmount }) => {
        const room = rooms.get(currentRoom);
        if (!room) return;

        const result = placeBid(room, currentPlayerId, bidAmount);

        if (result.success) {
            for (const [playerId, player] of room.players) {
                io.to(player.socketId).emit('gameStateUpdate', getGameStateForPlayer(room, playerId));
            }
        } else {
            socket.emit('error', { message: result.error });
        }
    });

    // Pass bid
    socket.on('passBid', () => {
        const room = rooms.get(currentRoom);
        if (!room) return;

        const result = passBid(room, currentPlayerId);

        if (result.success) {
            for (const [playerId, player] of room.players) {
                io.to(player.socketId).emit('gameStateUpdate', getGameStateForPlayer(room, playerId));
            }
        } else {
            socket.emit('error', { message: result.error });
        }
    });

    // Select trump
    socket.on('selectTrump', ({ suit }) => {
        const room = rooms.get(currentRoom);
        if (!room) return;

        const result = selectTrump(room, currentPlayerId, suit);

        if (result.success) {
            for (const [playerId, player] of room.players) {
                io.to(player.socketId).emit('gameStateUpdate', getGameStateForPlayer(room, playerId));
            }
        } else {
            socket.emit('error', { message: result.error });
        }
    });

    // Select partner
    socket.on('selectPartner', ({ card }) => {
        const room = rooms.get(currentRoom);
        if (!room) return;

        const result = selectPartner(room, currentPlayerId, card);

        if (result.success) {
            for (const [playerId, player] of room.players) {
                io.to(player.socketId).emit('gameStateUpdate', getGameStateForPlayer(room, playerId));
            }
        } else {
            socket.emit('error', { message: result.error });
        }
    });

    // Play card
    socket.on('playCard', ({ card }) => {
        const room = rooms.get(currentRoom);
        if (!room) return;

        const result = playCard(room, currentPlayerId, card);

        if (result.success) {
            // Emit special events for trick completion
            if (result.trickComplete) {
                io.to(room.id).emit('trickComplete', {
                    winnerId: result.winnerId,
                    winnerName: room.players.get(result.winnerId).name,
                    completedTrick: result.completedTrick,
                    partnerRevealed: result.partnerJustRevealed,
                    partnerId: result.partnerJustRevealed ? room.partnerId : null,
                    partnerName: result.partnerJustRevealed ? room.players.get(room.partnerId).name : null,
                    partnerCard: result.partnerJustRevealed ? room.partnerCard : null
                });

                if (result.gameOver) {
                    io.to(room.id).emit('gameOver', result.scores);
                }
            }

            // Send updated state
            for (const [playerId, player] of room.players) {
                io.to(player.socketId).emit('gameStateUpdate', getGameStateForPlayer(room, playerId));
            }
        } else {
            socket.emit('error', { message: result.error });
        }
    });

    // New game request - re-deal within same room
    socket.on('newGame', () => {
        const room = rooms.get(currentRoom);
        if (!room) return;

        if (currentPlayerId !== room.hostId) {
            socket.emit('error', { message: 'Only the host can start a new game' });
            return;
        }

        // Initialize cumulative scores for any new players
        for (const [playerId] of room.players) {
            if (!room.cumulativeScores.has(playerId)) {
                room.cumulativeScores.set(playerId, 0);
            }
        }

        // Re-deal and start new game directly
        const result = startGame(room);

        if (result.success) {
            for (const [playerId, player] of room.players) {
                io.to(player.socketId).emit('newRoundStarted', {
                    gameState: getGameStateForPlayer(room, playerId),
                    gamesPlayed: room.gamesPlayed,
                    cumulativeScores: Object.fromEntries(
                        Array.from(room.cumulativeScores.entries()).map(([id, score]) => [
                            id,
                            { name: room.players.get(id)?.name || 'Unknown', score }
                        ])
                    )
                });
            }
        } else {
            socket.emit('error', { message: result.error });
        }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);

        if (currentRoom && currentPlayerId) {
            const room = rooms.get(currentRoom);
            if (room) {
                const player = room.players.get(currentPlayerId);
                if (player) {
                    player.connected = false;

                    // Notify other players
                    io.to(room.id).emit('playerDisconnected', {
                        playerId: currentPlayerId,
                        playerName: player.name
                    });

                    // Remove player from lobby count if room is still waiting
                    if (room.phase === PHASES.WAITING) {
                        room.players.delete(currentPlayerId);
                        
                        // If room is empty, remove it
                        if (room.players.size === 0) {
                            rooms.delete(currentRoom);
                        } else if (currentPlayerId === room.hostId) {
                            // If host leaves, make next player the host
                            const nextHostId = Array.from(room.players.keys())[0];
                            room.hostId = nextHostId;
                            io.to(room.id).emit('playerJoined', {
                                players: Array.from(room.players.values()).map(p => ({
                                    id: p.id,
                                    name: p.name,
                                    isHost: p.id === room.hostId
                                }))
                            });
                        }
                        
                        // Update all clients
                        io.emit('availableRoomsUpdate', getAvailableRooms());
                    }
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Kaali Rani server running on http://localhost:${PORT}`);
});
