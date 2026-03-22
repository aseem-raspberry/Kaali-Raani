/**
 * Kaali Rani - Client-side Game Logic
 */

// Socket.io connection
const socket = io();

// Game state
let state = {
    playerId: null,
    roomId: null,
    isHost: false,
    phase: 'lobby',
    myHand: [],
    currentBid: 60,
    isMyTurn: false
};

// Timer for timeout warning
let turnTimer = null;
let turnStartTime = null;
const TURN_TIMEOUT = 30000; // 30 seconds

// Trick display delay
let trickDisplayTimer = null;
let pendingTrickClear = false;
let savedCompletedTrick = null; // Store the completed trick to display during delay

// DOM Elements
const lobbyView = document.getElementById('lobby-view');
const waitingView = document.getElementById('waiting-view');
const gameView = document.getElementById('game-view');
const gameOverModal = document.getElementById('game-over-modal');

// Lobby elements
const playerNameInput = document.getElementById('player-name');
const createRoomBtn = document.getElementById('create-room-btn');
const joinSectionBtn = document.getElementById('join-section-btn');
const joinSection = document.getElementById('join-section');
const nameSection = document.getElementById('name-section');
const roomCodeInput = document.getElementById('room-code');
const joinRoomBtn = document.getElementById('join-room-btn');
const backBtn = document.getElementById('back-btn');
const errorMessage = document.getElementById('error-message');
const roomSelect = document.getElementById('room-select');

// Waiting room elements
const displayRoomCode = document.getElementById('display-room-code');
const playerList = document.getElementById('player-list');
const playerCount = document.getElementById('player-count');
const startGameBtn = document.getElementById('start-game-btn');

// Game elements
const gamePhase = document.getElementById('game-phase');
const currentBidDisplay = document.getElementById('current-bid');
const trumpSuitDisplay = document.getElementById('trump-suit');
const rajaNameDisplay = document.getElementById('raja-name');
const myHandContainer = document.getElementById('my-hand');
const trickArea = document.getElementById('current-trick');
const otherPlayersContainer = document.getElementById('other-players');
const myTurnGlow = document.getElementById('my-turn-glow');

// Bidding elements
const biddingPanel = document.getElementById('bidding-panel');
const bidInput = document.getElementById('bid-input');
const bidMinusBtn = document.getElementById('bid-minus');
const bidPlusBtn = document.getElementById('bid-plus');
const placeBidBtn = document.getElementById('place-bid-btn');
const passBidBtn = document.getElementById('pass-bid-btn');
const biddingCurrent = document.getElementById('bidding-current');

// Trump/Partner elements
const trumpPanel = document.getElementById('trump-panel');
const partnerPanel = document.getElementById('partner-panel');
const partnerSuitSelect = document.getElementById('partner-suit');
const partnerRankSelect = document.getElementById('partner-rank');
const selectPartnerBtn = document.getElementById('select-partner-btn');

// Scorecard elements
const targetBidDisplay = document.getElementById('target-bid');
const tricksCountDisplay = document.getElementById('tricks-count');
const partnerInfo = document.getElementById('partner-info');
const partnerCardDisplay = document.getElementById('partner-card-display');
const allPlayersPoints = document.getElementById('all-players-points');

// Turn indicator and timeout elements
const turnIndicator = document.getElementById('turn-indicator');
const timeoutWarning = document.getElementById('timeout-warning');
const timeoutText = document.getElementById('timeout-text');

// Notification
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notification-text');

// Suit symbols
const SUIT_SYMBOLS = {
    'spades': '♠',
    'hearts': '♥',
    'diamonds': '♦',
    'clubs': '♣'
};

// ============ LOBBY HANDLERS ============

joinSectionBtn.addEventListener('click', () => {
    nameSection.classList.add('hidden');
    joinSection.classList.remove('hidden');
});

backBtn.addEventListener('click', () => {
    joinSection.classList.add('hidden');
    nameSection.classList.remove('hidden');
});

createRoomBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (!name) {
        showError('Please enter your name');
        return;
    }
    socket.emit('createRoom', { playerName: name });
});

joinRoomBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    let roomId = roomCodeInput.value.trim().toUpperCase();

    // Use dropdown value if selected and manual input is empty
    if (!roomId && roomSelect.value) {
        roomId = roomSelect.value;
    }

    if (!name) {
        showError('Please enter your name');
        return;
    }
    if (!roomId) {
        showError('Please enter a room code');
        return;
    }

    socket.emit('joinRoom', { roomId, playerName: name });
});

// Enter key handlers
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createRoomBtn.click();
});

roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoomBtn.click();
});

// Mutual exclusion between dropdown and manual code
roomSelect.addEventListener('change', () => {
    if (roomSelect.value !== '') {
        roomCodeInput.value = '';
    }
});

roomCodeInput.addEventListener('input', () => {
    if (roomCodeInput.value.trim() !== '') {
        roomSelect.value = '';
    }
});

// ============ WAITING ROOM HANDLERS ============

startGameBtn.addEventListener('click', () => {
    socket.emit('startGame');
});

// ============ BIDDING HANDLERS ============

bidMinusBtn.addEventListener('click', () => {
    const currentVal = parseInt(bidInput.value);
    const minBid = state.currentBid + 5;
    if (currentVal > minBid) {
        bidInput.value = currentVal - 5;
    }
});

bidPlusBtn.addEventListener('click', () => {
    const currentVal = parseInt(bidInput.value);
    if (currentVal < 130) {
        bidInput.value = currentVal + 5;
    }
});

placeBidBtn.addEventListener('click', () => {
    const bidAmount = parseInt(bidInput.value);
    socket.emit('placeBid', { bidAmount });
});

passBidBtn.addEventListener('click', () => {
    socket.emit('passBid');
});

// ============ TRUMP SELECTION HANDLERS ============

document.querySelectorAll('.trump-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const suit = btn.dataset.suit;
        socket.emit('selectTrump', { suit });
    });
});

// ============ PARTNER SELECTION HANDLERS ============

selectPartnerBtn.addEventListener('click', () => {
    const suit = partnerSuitSelect.value;
    const rank = partnerRankSelect.value;
    socket.emit('selectPartner', { card: { suit, rank } });
});

// ============ NEW GAME HANDLER ============

document.getElementById('new-game-btn').addEventListener('click', () => {
    socket.emit('newGame');
});

// ============ SOCKET HANDLERS ============

socket.on('availableRoomsUpdate', (availableRooms) => {
    // Keep the default option
    roomSelect.innerHTML = '<option value="">-- Select an active room --</option>';
    
    if (availableRooms.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No active rooms found";
        option.disabled = true;
        roomSelect.appendChild(option);
        return;
    }

    availableRooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.id;
        option.textContent = `${room.hostName}'s Room (${room.playerCount}/6) - [${room.id}]`;
        roomSelect.appendChild(option);
    });
});

socket.on('roomCreated', ({ roomId, playerId, isHost }) => {
    state.playerId = playerId;
    state.roomId = roomId;
    state.isHost = isHost;

    displayRoomCode.textContent = roomId;
    showView('waiting');

    if (isHost) {
        startGameBtn.classList.remove('hidden');
    }
});

socket.on('roomJoined', ({ roomId, playerId, isHost }) => {
    state.playerId = playerId;
    state.roomId = roomId;
    state.isHost = isHost;

    displayRoomCode.textContent = roomId;
    showView('waiting');
});

socket.on('playerJoined', ({ players }) => {
    updatePlayerList(players);
});

socket.on('gameStarted', (gameState) => {
    showView('game');
    updateGameState(gameState);
    showNotification('Game started! Bidding begins.');
});

socket.on('gameStateUpdate', (gameState) => {
    updateGameState(gameState);
});

socket.on('trickComplete', ({ winnerId, winnerName, completedTrick, partnerRevealed, partnerId, partnerName, partnerCard }) => {
    if (partnerRevealed) {
        showNotification(`Partner revealed! ${partnerName} holds the ${partnerCard.rank}${SUIT_SYMBOLS[partnerCard.suit]}`);
    }

    showNotification(`${winnerName} wins the trick!`);

    // Save the completed trick and render it with all 4 cards
    savedCompletedTrick = completedTrick;
    renderTrick(completedTrick);

    // Keep cards visible for 10 seconds before clearing
    pendingTrickClear = true;
    if (trickDisplayTimer) clearTimeout(trickDisplayTimer);
    trickDisplayTimer = setTimeout(() => {
        pendingTrickClear = false;
        savedCompletedTrick = null;
        trickArea.innerHTML = '';
    }, 10000); // 10 second delay
});

socket.on('gameOver', (scores) => {
    showGameOver(scores);
});

socket.on('gameOver', (scores) => {
    showGameOver(scores);
});

socket.on('newRoundStarted', ({ gameState, gamesPlayed, cumulativeScores }) => {
    gameOverModal.classList.add('hidden');
    updateGameState(gameState);
    showNotification(`Round ${gamesPlayed + 1} started! Bidding begins.`);
});

socket.on('playerDisconnected', ({ playerName }) => {
    showNotification(`${playerName} disconnected`);
});

socket.on('error', ({ message }) => {
    showError(message);
});

// ============ VIEW FUNCTIONS ============

function showView(view) {
    lobbyView.classList.add('hidden');
    waitingView.classList.add('hidden');
    gameView.classList.add('hidden');

    if (view === 'lobby') lobbyView.classList.remove('hidden');
    if (view === 'waiting') waitingView.classList.remove('hidden');
    if (view === 'game') gameView.classList.remove('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 3000);
}

function showNotification(message) {
    notificationText.textContent = message;
    notification.classList.remove('hidden');
    notification.classList.add('notification-show');

    setTimeout(() => {
        notification.classList.add('hidden');
        notification.classList.remove('notification-show');
    }, 3000);
}

// ============ UPDATE FUNCTIONS ============

function updatePlayerList(players) {
    playerCount.textContent = players.length;
    playerList.innerHTML = '';

    players.forEach(player => {
        const div = document.createElement('div');
        div.className = `player-item ${player.isHost ? 'host' : ''}`;
        div.innerHTML = `
      <div class="avatar">${player.name.charAt(0).toUpperCase()}</div>
      <div class="flex-1">
        <div class="font-semibold">${escapeHtml(player.name)}</div>
        ${player.isHost ? '<div class="text-xs text-gold">Host</div>' : ''}
      </div>
      ${player.id === state.playerId ? '<span class="text-xs text-purple-400">(You)</span>' : ''}
    `;
        playerList.appendChild(div);
    });

    // Show/hide start button based on player count
    if (state.isHost && players.length >= 3) {
        startGameBtn.classList.remove('hidden');
    }
}

function updateGameState(gameState) {
    state.myHand = gameState.myHand;
    state.currentBid = gameState.currentBid;
    state.isMyTurn = gameState.currentPlayerId === state.playerId;

    // Update phase display
    const phaseNames = {
        'bidding': 'Bidding',
        'trump_selection': 'Trump Selection',
        'partner_selection': 'Partner Selection',
        'playing': 'Playing',
        'game_over': 'Game Over'
    };
    gamePhase.textContent = phaseNames[gameState.phase] || gameState.phase;

    // Update game info
    currentBidDisplay.textContent = gameState.currentBid;
    targetBidDisplay.textContent = gameState.currentBid;

    if (gameState.trumpSuit) {
        trumpSuitDisplay.innerHTML = `<span class="${gameState.trumpSuit === 'hearts' || gameState.trumpSuit === 'diamonds' ? 'text-red-500' : ''}">${SUIT_SYMBOLS[gameState.trumpSuit]}</span>`;
    } else {
        trumpSuitDisplay.textContent = '-';
    }

    rajaNameDisplay.textContent = gameState.rajaName || '-';

    // Update scorecard (Leaderboard) (Top Right)
    tricksCountDisplay.textContent = gameState.tricksPlayed;
    updateLeaderboard(gameState);

    // Partner card display - visible to everyone once announced
    if (gameState.partnerCard) {
        partnerInfo.classList.remove('hidden');
        const isRed = gameState.partnerCard.suit === 'hearts' || gameState.partnerCard.suit === 'diamonds';
        partnerCardDisplay.innerHTML = `<span class="${isRed ? 'text-red-500' : ''}">${gameState.partnerCard.rank}${SUIT_SYMBOLS[gameState.partnerCard.suit]}</span>`;
        if (gameState.partnerRevealed && gameState.partnerName) {
            partnerCardDisplay.innerHTML += ` <span class="text-emerald text-xs">(${gameState.partnerName})</span>`;
        }
    } else {
        partnerInfo.classList.add('hidden');
    }

    // Handle turn indicator and timeout
    handleTurnIndicator(gameState);

    // Render hand
    renderHand(gameState);

    // Render my score on table (near hand)
    renderMyScore(gameState);

    // Render other players (with their scores)
    renderOtherPlayers(gameState);

    // Render current trick
    // If a new trick has started (currentTrick has cards), cancel the delay from previous trick immediately
    if (gameState.currentTrick && gameState.currentTrick.length > 0) {
        if (pendingTrickClear) {
            pendingTrickClear = false;
            savedCompletedTrick = null;
            if (trickDisplayTimer) {
                clearTimeout(trickDisplayTimer);
                trickDisplayTimer = null;
            }
        }
        renderTrick(gameState.currentTrick);
    }
    // If waiting for delay and no new trick started, keep showing the completed trick
    else if (pendingTrickClear && savedCompletedTrick) {
        // Don't re-render - keep showing the completed trick
    }
    // Otherwise render current trick (which is likely empty)
    else {
        renderTrick(gameState.currentTrick);
    }

    // Show/hide phase-specific panels
    updatePanels(gameState);
}

// Handle turn indicator and timeout warning
function handleTurnIndicator(gameState) {
    const currentPlayerName = gameState.playerOrder[gameState.currentPlayerIndex]?.name || 'Unknown';

    // Clear existing timer
    if (turnTimer) {
        clearInterval(turnTimer);
        turnTimer = null;
    }

    // Reset timeout warning
    timeoutWarning.classList.add('hidden');

    if (['playing', 'bidding', 'trump_selection', 'partner_selection'].includes(gameState.phase)) {
        if (state.isMyTurn) {
            // Show persistent glowing table indicator
            myTurnGlow.classList.remove('hidden');

            // Show brief popup turn indicator
            turnIndicator.classList.remove('hidden');
            setTimeout(() => {
                turnIndicator.classList.add('hidden');
            }, 2000);
        } else {
            myTurnGlow.classList.add('hidden');
            turnIndicator.classList.add('hidden');

            // Start timeout timer for other player
            turnStartTime = Date.now();
            turnTimer = setInterval(() => {
                const elapsed = Date.now() - turnStartTime;
                if (elapsed >= TURN_TIMEOUT) {
                    timeoutWarning.classList.remove('hidden');
                    timeoutText.textContent = `⏰ ${currentPlayerName}, please make your move!`;
                }
            }, 1000);
        }
    } else {
        myTurnGlow.classList.add('hidden');
        turnIndicator.classList.add('hidden');
    }
}

// Update all players' points display
// Update leaderboard (cumulative scores) in top right
function updateLeaderboard(gameState) {
    if (!gameState.cumulativeScores) return;

    // Change label title
    const label = allPlayersPoints.previousElementSibling;
    if (label && label.classList.contains('text-purple-400')) {
        label.textContent = 'Leaderboard:';
    }

    allPlayersPoints.innerHTML = '';

    const sorted = Object.entries(gameState.cumulativeScores)
        .sort((a, b) => b[1].score - a[1].score);

    for (const [playerId, data] of sorted) {
        const isMe = playerId === state.playerId;
        const div = document.createElement('div');
        div.className = `flex justify-between items-center ${isMe ? 'text-purple-300 font-bold' : 'text-slate-300'}`;

        const scoreColor = data.score >= 0 ? 'text-emerald-400' : 'text-red-400';

        div.innerHTML = `
            <span class="truncate flex-1">${escapeHtml(data.name)}${isMe ? ' (You)' : ''}</span>
            <span class="font-bold ml-2 ${scoreColor}">${data.score > 0 ? '+' : ''}${data.score}</span>
        `;
        allPlayersPoints.appendChild(div);
    }
}

function renderHand(gameState) {
    myHandContainer.innerHTML = '';

    const ledSuit = gameState.currentTrick.length > 0 ? gameState.currentTrick[0].card.suit : null;
    const hasLedSuit = ledSuit && state.myHand.some(c => c.suit === ledSuit);

    state.myHand.forEach((card, index) => {
        const cardEl = createCardElement(card);

        // Disable cards that can't be played
        if (gameState.phase === 'playing' && !state.isMyTurn) {
            cardEl.classList.add('disabled');
        } else if (gameState.phase === 'playing' && state.isMyTurn && hasLedSuit && card.suit !== ledSuit) {
            cardEl.classList.add('disabled');
        } else if (gameState.phase !== 'playing') {
            cardEl.classList.add('disabled');
        }

        // Add dealing animation
        cardEl.classList.add('dealing');
        cardEl.style.animationDelay = `${index * 0.05}s`;

        // Click handler for playing cards
        cardEl.addEventListener('click', () => {
            if (!cardEl.classList.contains('disabled')) {
                socket.emit('playCard', { card });
            }
        });

        myHandContainer.appendChild(cardEl);
    });
}

function renderOtherPlayers(gameState) {
    otherPlayersContainer.innerHTML = '';

    const playerOrder = gameState.playerOrder;
    const myIndex = playerOrder.findIndex(p => p.id === state.playerId);
    const otherCount = playerOrder.length - 1;

    // Position other players around the table
    let positionIndex = 0;
    playerOrder.forEach((player, index) => {
        if (player.id === state.playerId) return;

        const relativeIndex = (index - myIndex - 1 + playerOrder.length) % playerOrder.length;
        const angle = getPlayerAngle(relativeIndex, otherCount);

        const otherPlayer = gameState.otherPlayers.find(p => p.id === player.id);
        if (!otherPlayer) return;

        const playerEl = document.createElement('div');
        playerEl.className = 'player-position';

        // Add special classes
        if (gameState.currentPlayerId === player.id) {
            playerEl.classList.add('current-turn');
        }
        if (gameState.rajaId === player.id) {
            playerEl.classList.add('raja');
        }
        if (gameState.partnerRevealed && gameState.partnerId === player.id) {
            playerEl.classList.add('partner');
        }

        // Position around the table
        const radius = 42; // percentage from center
        const x = 50 + radius * Math.sin(angle);
        const y = 50 - radius * Math.cos(angle);

        playerEl.style.left = `${x}%`;
        playerEl.style.top = `${y}%`;
        playerEl.style.transform = 'translate(-50%, -50%)';

        playerEl.innerHTML = `
      <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
      <div class="player-name">${escapeHtml(player.name)}</div>
      <div class="text-xs font-bold ${gameState.rajaId === player.id || (gameState.partnerRevealed && gameState.partnerId === player.id) ? 'text-purple-400' : 'text-emerald-400'}">
        ${gameState.allPlayersPoints[player.id]?.points || 0} pts
      </div>
      <div class="player-card-count">${otherPlayer.cardCount} cards</div>
      ${otherPlayer.hasPassed && gameState.phase === 'bidding' ? '<span class="passed-badge">PASS</span>' : ''}
      ${gameState.rajaId === player.id ? '<span class="points-badge">👑 Raja</span>' : ''}
    `;

        // Show their played card in current trick (or completed trick during delay if no new trick)
        let trickSource = gameState.currentTrick;
        if (pendingTrickClear && savedCompletedTrick && (!gameState.currentTrick || gameState.currentTrick.length === 0)) {
            trickSource = savedCompletedTrick;
        }

        const playedCard = trickSource.find(t => t.playerId === player.id);
        if (playedCard) {
            const cardEl = createCardElement(playedCard.card);
            cardEl.classList.add('trick-card', 'player-played-card');
            playerEl.appendChild(cardEl);
        }

        otherPlayersContainer.appendChild(playerEl);
        positionIndex++;
    });
}

function getPlayerAngle(index, totalOthers) {
    // Distribute players evenly around the top half of the table
    const spread = Math.PI; // 180 degrees
    const startAngle = -spread / 2;

    if (totalOthers === 1) return 0; // Top center

    return startAngle + (index / (totalOthers - 1)) * spread;
}

function renderTrick(trick) {
    trickArea.innerHTML = '';

    trick.forEach(play => {
        const cardEl = createCardElement(play.card);
        cardEl.classList.add('trick-card');

        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-center';
        wrapper.innerHTML = `<span class="text-xs text-slate-400 mb-1">${escapeHtml(play.playerName)}</span>`;
        wrapper.appendChild(cardEl);

        trickArea.appendChild(wrapper);
    });
}

function createCardElement(card) {
    const el = document.createElement('div');
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    const isKaaliRani = card.suit === 'spades' && card.rank === 'Q';

    el.className = `card ${card.suit}${isKaaliRani ? ' kaali-rani' : ''}`;
    el.innerHTML = `
    <span class="rank">${card.rank}</span>
    <span class="suit">${SUIT_SYMBOLS[card.suit]}</span>
  `;

    return el;
}

function updatePanels(gameState) {
    // Hide all panels first
    biddingPanel.classList.add('hidden');
    trumpPanel.classList.add('hidden');
    partnerPanel.classList.add('hidden');

    // Show appropriate panel based on phase and turn
    if (gameState.phase === 'bidding' && state.isMyTurn) {
        biddingPanel.classList.remove('hidden');
        biddingCurrent.textContent = gameState.currentBid;
        const minBid = gameState.currentBid + 5;
        bidInput.value = Math.max(minBid, parseInt(bidInput.value));
        bidInput.min = minBid;
    }

    if (gameState.phase === 'trump_selection' && gameState.isRaja) {
        trumpPanel.classList.remove('hidden');
    }

    if (gameState.phase === 'partner_selection' && gameState.isRaja) {
        partnerPanel.classList.remove('hidden');
    }
}

function showGameOver(scores) {
    const finalScores = document.getElementById('final-scores');

// Build cumulative leaderboard
let cumulativeHtml = '';
if (scores.cumulativeScores) {
    const sorted = Object.entries(scores.cumulativeScores)
        .sort((a, b) => b[1].score - a[1].score);

    cumulativeHtml = `
        <hr class="border-slate-600">
        <div class="text-sm text-purple-300 font-semibold mb-2">Leaderboard (${scores.gamesPlayed} game${scores.gamesPlayed > 1 ? 's' : ''}):</div>
        ${sorted.map(([id, data], i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
        const isMe = id === state.playerId;
        const scoreColor = data.score >= 0 ? 'text-emerald-400' : 'text-red-400';
        return `<div class="flex justify-between text-sm ${isMe ? 'text-purple-300 font-bold' : 'text-slate-300'}">
                <span>${medal} ${data.name}${isMe ? ' (You)' : ''}</span>
                <span class="${scoreColor}">${data.score > 0 ? '+' : ''}${data.score}</span>
            </div>`;
    }).join('')}
        `;
}

finalScores.innerHTML = `
    <div class="bg-purple-600/30 rounded-lg p-3">
      <div class="text-sm text-purple-300 mb-1">Raja Team</div>
      <div class="text-2xl font-bold text-purple-400">${scores.rajaTeamPoints} pts</div>
      <div class="text-xs text-slate-400">Target: ${scores.targetBid}</div>
    </div>
    <div class="bg-emerald-600/30 rounded-lg p-3">
      <div class="text-sm text-emerald-300 mb-1">Defenders</div>
      <div class="text-2xl font-bold text-emerald-400">${scores.defenderPoints} pts</div>
    </div>
    <hr class="border-slate-600">
    <div class="text-sm text-slate-400">
      <div>Raja: <span class="text-purple-400">${scores.individual[scores.rajaId] || 0} pts</span></div>
      ${scores.partnerId ? `<div>Partner: <span class="text-emerald-400">${scores.individual[scores.partnerId] || 0} pts</span></div>` : ''}
    </div>
    ${cumulativeHtml}
  `;

// Update button text based on host status
const newGameBtn = document.getElementById('new-game-btn');
if (state.isHost) {
    newGameBtn.textContent = 'Next Round';
    newGameBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    newGameBtn.disabled = false;
} else {
    newGameBtn.textContent = 'Waiting for host to start next round...';
    newGameBtn.classList.add('opacity-50', 'cursor-not-allowed');
    newGameBtn.disabled = true;
}

gameOverModal.classList.remove('hidden');
}

function renderMyScore(gameState) {
    // Check if score badge exists
    let scoreBadge = document.getElementById('my-score-badge');
    if (!scoreBadge) {
        scoreBadge = document.createElement('div');
        scoreBadge.id = 'my-score-badge';
        scoreBadge.className = 'absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800/80 px-3 py-1 rounded-full text-sm font-bold border border-purple-500/30';
        myHandContainer.parentElement.appendChild(scoreBadge);
        // Make parent relative if needed, but it is fixed so absolute positioning works relative to screen unless contained
        // Wait, myHandContainer parent is fixed bottom-0 left-0 right-0.
        // So absolute bottom-full puts it above the container.
    }

    const myPoints = gameState.myPoints || 0;
    const isRaja = gameState.isRaja;
    const isPartner = gameState.isPartner && gameState.partnerRevealed;

    scoreBadge.className = `absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800/80 px-3 py-1 rounded-full text-sm font-bold border border-purple-500/30 ${isRaja || isPartner ? 'text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'text-emerald-400'}`;
    scoreBadge.innerHTML = `${isRaja ? '👑 ' : (isPartner ? '🤝 ' : '')}You: ${myPoints} pts`;
}

// ============ UTILITY FUNCTIONS ============

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
