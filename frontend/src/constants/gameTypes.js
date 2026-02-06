// Centralized game type definitions for table tennis
// Future-proof structure for adding chess, board games, etc.

export const GAME_TYPES = {
  BEST_OF_1: {
    id: 'best_of_1',
    label: 'Best of 1',
    shortLabel: 'Bo1',
    maxSets: 1,
    setsToWin: 1,
    formatMultiplier: 0.512,
    sport: 'table_tennis',
  },
  BEST_OF_3: {
    id: 'best_of_3',
    label: 'Best of 3',
    shortLabel: 'Bo3',
    maxSets: 3,
    setsToWin: 2,
    formatMultiplier: 0.64,
    sport: 'table_tennis',
  },
  BEST_OF_5: {
    id: 'best_of_5',
    label: 'Best of 5',
    shortLabel: 'Bo5',
    maxSets: 5,
    setsToWin: 3,
    formatMultiplier: 0.8,
    sport: 'table_tennis',
  },
  BEST_OF_7: {
    id: 'best_of_7',
    label: 'Best of 7',
    shortLabel: 'Bo7',
    maxSets: 7,
    setsToWin: 4,
    formatMultiplier: 1.0,
    sport: 'table_tennis',
  },
};

// Helper exports
export const GAME_TYPE_VALUES = Object.values(GAME_TYPES);
export const GAME_TYPE_IDS = GAME_TYPE_VALUES.map((gt) => gt.id);

// Get game type by ID
export const getGameTypeById = (id) => {
  return GAME_TYPE_VALUES.find((gt) => gt.id === id) || GAME_TYPES.BEST_OF_3;
};

// Legacy compatibility - max sets mapping
export const MAX_SETS_BY_TYPE = {
  best_of_1: 1,
  best_of_3: 3,
  best_of_5: 5,
  best_of_7: 7,
};

// Calculate winner based on sets
export const calculateWinner = (setScores) => {
  const player1SetsWon = setScores.filter((s) => s.p1 > s.p2).length;
  const player2SetsWon = setScores.filter((s) => s.p2 > s.p1).length;

  return {
    player1SetsWon,
    player2SetsWon,
    player1Points: setScores.reduce((sum, s) => sum + s.p1, 0),
    player2Points: setScores.reduce((sum, s) => sum + s.p2, 0),
  };
};
