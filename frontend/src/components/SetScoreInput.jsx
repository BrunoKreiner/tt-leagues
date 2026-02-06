import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trophy } from 'lucide-react';

// Common table tennis winning scores (winner gets 11 points)
const PRESET_WINNING_SCORES = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

// Deuce scores (winner scores, loser scores)
const DEUCE_WINNING_SCORES = [
  { winner: 12, loser: 10 },
  { winner: 13, loser: 11 },
  { winner: 14, loser: 12 },
  { winner: 15, loser: 13 },
  { winner: 16, loser: 14 },
];

/**
 * Mobile-friendly set score input with preset buttons
 * Features "Who won?" toggle for clear winner selection
 *
 * @param {Object} props
 * @param {Function} props.onScoreSelect - Callback when score is selected (p1, p2) => void
 * @param {Object} props.currentScore - Current score { p1, p2 }
 * @param {boolean} props.allowSwap - Show swap button (deprecated - now uses winner toggle)
 * @param {string} props.player1Label - Label for player 1 (default: "Player 1")
 * @param {string} props.player2Label - Label for player 2 (default: "Player 2")
 */
export default function SetScoreInput({
  onScoreSelect,
  currentScore,
  allowSwap = true,
  player1Label = 'Player 1',
  player2Label = 'Player 2',
}) {
  const [mode, setMode] = useState('presets'); // 'presets' | 'deuce' | 'manual'
  const [winner, setWinner] = useState('p1'); // 'p1' | 'p2' - who won this set
  const [manualP1, setManualP1] = useState('');
  const [manualP2, setManualP2] = useState('');

  const handlePresetClick = (loserScore) => {
    // Winner always gets 11, loser gets the selected score
    if (winner === 'p1') {
      onScoreSelect(11, loserScore);
    } else {
      onScoreSelect(loserScore, 11);
    }
  };

  const handleDeuceClick = (winnerScore, loserScore) => {
    if (winner === 'p1') {
      onScoreSelect(winnerScore, loserScore);
    } else {
      onScoreSelect(loserScore, winnerScore);
    }
  };

  const handleManualSubmit = () => {
    const p1 = parseInt(manualP1);
    const p2 = parseInt(manualP2);

    if (Number.isFinite(p1) && Number.isFinite(p2) && p1 >= 0 && p2 >= 0) {
      onScoreSelect(p1, p2);
      setManualP1('');
      setManualP2('');
      setMode('presets');
    }
  };

  return (
    <div className="space-y-4">
      {/* Current selection display */}
      {currentScore && (
        <div className="flex items-center justify-center gap-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
          <span className="text-sm text-gray-400">{player1Label}:</span>
          <span className={`text-2xl font-bold ${currentScore.p1 > currentScore.p2 ? 'text-green-400' : 'text-gray-400'}`}>
            {currentScore.p1}
          </span>
          <span className="text-xl text-gray-500">-</span>
          <span className={`text-2xl font-bold ${currentScore.p2 > currentScore.p1 ? 'text-blue-400' : 'text-gray-400'}`}>
            {currentScore.p2}
          </span>
          <span className="text-sm text-gray-400">:{player2Label}</span>
        </div>
      )}

      {/* Winner toggle - only show in preset mode */}
      {mode === 'presets' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300 block text-center">Who won this set?</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setWinner('p1')}
              className={`h-12 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2 ${
                winner === 'p1'
                  ? 'border-green-500 bg-green-500/20 text-green-400'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {winner === 'p1' && <Trophy className="h-4 w-4" />}
              {player1Label}
            </button>
            <button
              onClick={() => setWinner('p2')}
              className={`h-12 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2 ${
                winner === 'p2'
                  ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {winner === 'p2' && <Trophy className="h-4 w-4" />}
              {player2Label}
            </button>
          </div>
        </div>
      )}

      {/* Preset scores */}
      {mode === 'presets' && (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-2 text-center">
              Select loser's score ({winner === 'p1' ? player2Label : player1Label}):
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {PRESET_WINNING_SCORES.map((loserScore) => {
                const displayScore = winner === 'p1' ? `11-${loserScore}` : `${loserScore}-11`;
                return (
                  <button
                    key={loserScore}
                    onClick={() => handlePresetClick(loserScore)}
                    className="min-h-12 rounded-lg border-2 border-gray-700 hover:border-blue-500 hover:bg-blue-500/10 text-lg font-medium transition-all active:scale-95"
                  >
                    {displayScore}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={() => setMode('deuce')}>
              Deuce...
            </Button>
            <Button variant="outline" size="lg" onClick={() => setMode('manual')}>
              Manual Entry
            </Button>
          </div>
        </div>
      )}

      {/* Deuce scores */}
      {mode === 'deuce' && (
        <div className="space-y-3">
          {/* Winner toggle in deuce mode */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 block text-center">Who won this set?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setWinner('p1')}
                className={`h-12 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2 ${
                  winner === 'p1'
                    ? 'border-green-500 bg-green-500/20 text-green-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {winner === 'p1' && <Trophy className="h-4 w-4" />}
                {player1Label}
              </button>
              <button
                onClick={() => setWinner('p2')}
                className={`h-12 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2 ${
                  winner === 'p2'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {winner === 'p2' && <Trophy className="h-4 w-4" />}
                {player2Label}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2 text-center">
              Select deuce score:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEUCE_WINNING_SCORES.map(({ winner: winScore, loser: loseScore }) => {
                const displayScore = winner === 'p1' ? `${winScore}-${loseScore}` : `${loseScore}-${winScore}`;
                return (
                  <button
                    key={`${winScore}-${loseScore}`}
                    onClick={() => handleDeuceClick(winScore, loseScore)}
                    className="min-h-12 rounded-lg border-2 border-gray-700 hover:border-blue-500 hover:bg-blue-500/10 text-lg font-medium transition-all active:scale-95"
                  >
                    {displayScore}
                  </button>
                );
              })}
            </div>
          </div>

          <Button variant="outline" size="lg" className="w-full" onClick={() => setMode('presets')}>
            ← Back to Presets
          </Button>
        </div>
      )}

      {/* Manual input */}
      {mode === 'manual' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">{player1Label}</label>
              <Input
                type="number"
                min="0"
                value={manualP1}
                onChange={(e) => setManualP1(e.target.value)}
                placeholder="11"
                className="h-14 text-lg text-center"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">{player2Label}</label>
              <Input
                type="number"
                min="0"
                value={manualP2}
                onChange={(e) => setManualP2(e.target.value)}
                placeholder="9"
                className="h-14 text-lg text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={() => setMode('presets')}>
              Cancel
            </Button>
            <Button
              size="lg"
              onClick={handleManualSubmit}
              disabled={!manualP1 || !manualP2}
            >
              Confirm
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
