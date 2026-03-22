/**
 * Kaali Rani - Game Logic Module
 * Pure functions for card game mechanics
 */

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

/**
 * Creates a deck with cards removed to make it divisible by player count
 * @param {number} playerCount - Number of players (3-6)
 * @returns {Array} Array of card objects
 */
function createDeck(playerCount) {
  const fullDeck = [];

  // Create full 52-card deck
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      fullDeck.push({ suit, rank, id: `${rank}_${suit}` });
    }
  }

  // Calculate how many cards to remove
  const remainder = 52 % playerCount;

  if (remainder === 0) {
    return fullDeck;
  }

  // Remove lowest cards (2s first, then 3s) to make divisible
  const cardsToRemove = remainder;
  const lowRanks = ['2', '3', '4'];
  let removed = 0;

  const filteredDeck = fullDeck.filter(card => {
    if (removed >= cardsToRemove) return true;
    if (lowRanks.includes(card.rank)) {
      removed++;
      return false;
    }
    return true;
  });

  return filteredDeck;
}

/**
 * Fisher-Yates shuffle algorithm
 * @param {Array} deck - Array of cards
 * @returns {Array} Shuffled deck
 */
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deal cards equally to all players
 * @param {Array} deck - Shuffled deck
 * @param {number} playerCount - Number of players
 * @returns {Array} Array of hands (each hand is an array of cards)
 */
function dealCards(deck, playerCount) {
  const hands = Array.from({ length: playerCount }, () => []);
  const cardsPerPlayer = Math.floor(deck.length / playerCount);

  for (let i = 0; i < deck.length; i++) {
    const playerIndex = i % playerCount;
    if (hands[playerIndex].length < cardsPerPlayer) {
      hands[playerIndex].push(deck[i]);
    }
  }

  return hands;
}

/**
 * Calculate point value of a card
 * @param {Object} card - Card object with suit and rank
 * @returns {number} Point value
 */
function calculateCardPoints(card) {
  // Queen of Spades (Kaali Rani) = 30 points
  if (card.suit === 'spades' && card.rank === 'Q') {
    return 30;
  }
  // All Aces = 10 points
  if (card.rank === 'A') {
    return 10;
  }
  // All 10s = 10 points
  if (card.rank === '10') {
    return 10;
  }
  // All 5s = 5 points
  if (card.rank === '5') {
    return 5;
  }
  // All other cards = 0 points
  return 0;
}

/**
 * Calculate total points in a set of cards
 * @param {Array} cards - Array of card objects
 * @returns {number} Total points
 */
function calculateTrickPoints(cards) {
  return cards.reduce((total, card) => total + calculateCardPoints(card), 0);
}

/**
 * Check if a card play is valid (following suit rules)
 * @param {Object} card - Card being played
 * @param {Array} hand - Player's current hand
 * @param {string|null} ledSuit - Suit that was led (null if leading)
 * @returns {boolean} Whether the play is valid
 */
function isValidPlay(card, hand, ledSuit) {
  // If leading, any card is valid
  if (!ledSuit) {
    return true;
  }

  // Check if player has any cards of the led suit
  const hasLedSuit = hand.some(c => c.suit === ledSuit);

  // If player has the led suit, they must follow it
  if (hasLedSuit) {
    return card.suit === ledSuit;
  }

  // If player doesn't have led suit, they can play anything
  return true;
}

/**
 * Determine the winner of a trick
 * @param {Array} trick - Array of { playerId, card } objects in play order
 * @param {string} trumpSuit - The trump suit
 * @returns {string} Player ID of the winner
 */
function determineTrickWinner(trick, trumpSuit) {
  const ledSuit = trick[0].card.suit;

  let winner = trick[0];
  let highestValue = RANK_VALUES[trick[0].card.rank];
  let winnerIsTrump = trick[0].card.suit === trumpSuit;

  for (let i = 1; i < trick.length; i++) {
    const play = trick[i];
    const cardValue = RANK_VALUES[play.card.rank];
    const isTrump = play.card.suit === trumpSuit;

    // Trump always beats non-trump
    if (isTrump && !winnerIsTrump) {
      winner = play;
      highestValue = cardValue;
      winnerIsTrump = true;
    }
    // If both are trump, or both follow led suit, compare values
    else if (isTrump && winnerIsTrump) {
      if (cardValue > highestValue) {
        winner = play;
        highestValue = cardValue;
      }
    }
    // If neither is trump, only cards of led suit can win
    else if (!winnerIsTrump && play.card.suit === ledSuit) {
      if (cardValue > highestValue) {
        winner = play;
        highestValue = cardValue;
      }
    }
  }

  return winner.playerId;
}

/**
 * Sort cards by suit and rank for display
 * Black-Red-Black-Red order: Spades, Hearts, Clubs, Diamonds
 * @param {Array} cards - Array of card objects
 * @returns {Array} Sorted cards
 */
function sortCards(cards) {
  const suitOrder = { 'spades': 0, 'hearts': 1, 'clubs': 2, 'diamonds': 3 };

  return [...cards].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return RANK_VALUES[b.rank] - RANK_VALUES[a.rank];
  });
}

/**
 * Check if a card matches the partner card
 * @param {Object} card - Card being played
 * @param {Object} partnerCard - The selected partner card
 * @returns {boolean} Whether this is the partner card
 */
function isPartnerCard(card, partnerCard) {
  if (!partnerCard) return false;
  return card.suit === partnerCard.suit && card.rank === partnerCard.rank;
}

/**
 * Find which player holds a specific card
 * @param {Object} players - Map of player objects with hands
 * @param {Object} targetCard - Card to find
 * @returns {string|null} Player ID holding the card, or null
 */
function findCardHolder(players, targetCard) {
  for (const [playerId, player] of Object.entries(players)) {
    if (player.hand.some(c => c.suit === targetCard.suit && c.rank === targetCard.rank)) {
      return playerId;
    }
  }
  return null;
}

module.exports = {
  SUITS,
  RANKS,
  RANK_VALUES,
  createDeck,
  shuffleDeck,
  dealCards,
  calculateCardPoints,
  calculateTrickPoints,
  isValidPlay,
  determineTrickWinner,
  sortCards,
  isPartnerCard,
  findCardHolder
};
