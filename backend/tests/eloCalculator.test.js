const { calculateNewElos, calculateExpectedScore } = require('../src/utils/eloCalculator');

describe('ELO Calculator', () => {
  test('expected score symmetry', () => {
    const a = calculateExpectedScore(1200, 1200);
    expect(a).toBeCloseTo(0.5, 3);
  });

  test('player 1 win increases rating (best of 3)', () => {
    const res = calculateNewElos(1200, 1200, 33, 31, true, 2, 1);
    expect(res.newRating1).toBeGreaterThan(1200);
    expect(res.newRating2).toBeLessThan(1200);
  });

  test('player 1 loss decreases rating (best of 5)', () => {
    const res = calculateNewElos(1300, 1250, 45, 55, false, 2, 3);
    expect(res.newRating1).toBeLessThan(1300);
    expect(res.newRating2).toBeGreaterThan(1250);
  });
});


