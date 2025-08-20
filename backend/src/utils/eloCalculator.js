/**
 * ELO Calculator for Table Tennis League
 * Based on the provided formula with adjustments for match format and points
 */

/**
 * Calculate expected score for a player
 * @param {number} rating1 - Player 1's current ELO rating
 * @param {number} rating2 - Player 2's current ELO rating
 * @returns {number} Expected score for player 1 (0-1)
 */
function calculateExpectedScore(rating1, rating2) {
    return 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
}

/**
 * Calculate new ELO ratings after a match
 * @param {number} rating1 - Player 1's current ELO rating
 * @param {number} rating2 - Player 2's current ELO rating
 * @param {number} pointsWon1 - Total points won by player 1
 * @param {number} pointsWon2 - Total points won by player 2
 * @param {boolean} didPlayer1Win - Whether player 1 won the match
 * @param {number} setsWonP1 - Sets won by player 1
 * @param {number} setsWonP2 - Sets won by player 2
 * @returns {Object} Object with newRating1 and newRating2
 */
function calculateNewElos(rating1, rating2, pointsWon1, pointsWon2, didPlayer1Win, setsWonP1, setsWonP2) {
    const K = 46; // Fixed K-factor
    
    // Format multiplier based on sets needed to win
    const setsNeededToWin = Math.max(setsWonP1, setsWonP2);
    const formatMultiplier = {
        4: 1.0,    // Best of 7
        3: 0.8,    // Best of 5
        2: 0.64,   // Best of 3
        1: 0.512   // Best of 1
    }[setsNeededToWin] || 0.512;
    
    const matchFormat = {4: 7, 3: 5, 2: 3, 1: 1}[setsNeededToWin] || 1;
    
    // Calculate expected score
    const expectedScore1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
    
    // Points modifier (limited impact)
    const totalPoints = pointsWon1 + pointsWon2;
    const pointsRatio1 = totalPoints > 0 ? pointsWon1 / totalPoints : 0.5;
    const pointsFactor = 1 + (pointsRatio1 - 0.5) * 0.7; // Max ±35% impact
    
    // Symmetric rating change calculation
    const actualScore = didPlayer1Win ? 1 : 0;
    const ratingChange = K * formatMultiplier * pointsFactor * (actualScore - expectedScore1);
    
    return {
        newRating1: Math.round(rating1 + ratingChange),
        newRating2: Math.round(rating2 - ratingChange),
        ratingChange: Math.round(ratingChange),
        expectedScore1: expectedScore1,
        pointsFactor: pointsFactor,
        formatMultiplier: formatMultiplier
    };
}

/**
 * Determine game type from sets won
 * @param {number} setsWonP1 - Sets won by player 1
 * @param {number} setsWonP2 - Sets won by player 2
 * @returns {string} Game type ('best_of_1', 'best_of_3', 'best_of_5', 'best_of_7')
 */
function determineGameType(setsWonP1, setsWonP2) {
    const maxSets = Math.max(setsWonP1, setsWonP2);
    
    if (maxSets === 4) return 'best_of_7';
    if (maxSets === 3) return 'best_of_5';
    if (maxSets === 2) return 'best_of_3';
    return 'best_of_1';
}

/**
 * Validate match result
 * @param {number} setsWonP1 - Sets won by player 1
 * @param {number} setsWonP2 - Sets won by player 2
 * @param {string} gameType - Expected game type
 * @returns {Object} Validation result with isValid and error message
 */
function validateMatchResult(setsWonP1, setsWonP2, gameType) {
    const totalSets = setsWonP1 + setsWonP2;
    const maxSets = Math.max(setsWonP1, setsWonP2);
    
    // Check if someone actually won
    if (setsWonP1 === setsWonP2) {
        return { isValid: false, error: 'Match must have a winner' };
    }
    
    // Validate based on game type
    switch (gameType) {
        case 'best_of_1':
            if (maxSets !== 1) {
                return { isValid: false, error: 'Best of 1: Winner must have 1 set' };
            }
            break;
        case 'best_of_3':
            if (maxSets !== 2 || totalSets > 3) {
                return { isValid: false, error: 'Best of 3: Winner must have 2 sets, max 3 sets total' };
            }
            break;
        case 'best_of_5':
            if (maxSets !== 3 || totalSets > 5) {
                return { isValid: false, error: 'Best of 5: Winner must have 3 sets, max 5 sets total' };
            }
            break;
        case 'best_of_7':
            if (maxSets !== 4 || totalSets > 7) {
                return { isValid: false, error: 'Best of 7: Winner must have 4 sets, max 7 sets total' };
            }
            break;
        default:
            return { isValid: false, error: 'Invalid game type' };
    }
    
    return { isValid: true };
}

/**
 * Calculate ELO change preview (without applying)
 * @param {Object} matchData - Match data object
 * @returns {Object} ELO change preview
 */
function previewEloChange(matchData) {
    const {
        player1Elo,
        player2Elo,
        player1SetsWon,
        player2SetsWon,
        player1PointsTotal,
        player2PointsTotal
    } = matchData;
    
    const didPlayer1Win = player1SetsWon > player2SetsWon;
    
    return calculateNewElos(
        player1Elo,
        player2Elo,
        player1PointsTotal,
        player2PointsTotal,
        didPlayer1Win,
        player1SetsWon,
        player2SetsWon
    );
}

module.exports = {
    calculateExpectedScore,
    calculateNewElos,
    determineGameType,
    validateMatchResult,
    previewEloChange
};

