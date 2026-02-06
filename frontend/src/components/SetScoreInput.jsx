import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeftRight } from 'lucide-react';

// Common table tennis scores
const PRESET_SCORES = [
  { p1: 11, p2: 9 },
  { p1: 11, p2: 8 },
  { p1: 11, p2: 7 },
  { p1: 11, p2: 6 },
  { p1: 11, p2: 5 },
  { p1: 11, p2: 4 },
  { p1: 11, p2: 3 },
  { p1: 11, p2: 2 },
  { p1: 11, p2: 1 },
  { p1: 11, p2: 0 },
];

// Deuce scores (extended games)
const DEUCE_SCORES = [
  { p1: 12, p2: 10 },
  { p1: 13, p2: 11 },
  { p1: 14, p2: 12 },
  { p1: 15, p2: 13 },
  { p1: 16, p2: 14 },
];

/**
 * Mobile-friendly set score input with preset buttons
 * @param {Object} props
 * @param {Function} props.onScoreSelect - Callback when score is selected (p1, p2) => void
 * @param {Object} props.currentScore - Current score { p1, p2 }
 * @param {boolean} props.allowSwap - Show swap button
 * @param {string} props.player1Label - Label for player 1 (default: "You")
 * @param {string} props.player2Label - Label for player 2 (default: "Opponent")
 */
export default function SetScoreInput({
  onScoreSelect,
  currentScore,
  allowSwap = true,
  player1Label = 'You',
  player2Label = 'Opponent',
}) {
  const [mode, setMode] = useState('presets'); // 'presets' | 'deuce' | 'manual'
  const [manualP1, setManualP1] = useState('');
  const [manualP2, setManualP2] = useState('');

  const handlePresetClick = (p1, p2) => {
    onScoreSelect(p1, p2);
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

  const handleSwap = () => {
    if (currentScore) {
      onScoreSelect(currentScore.p2, currentScore.p1);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current selection display */}
      {currentScore && (
        <div className="flex items-center justify-center gap-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
          <span className="text-sm text-gray-400">{player1Label}:</span>
          <span className="text-2xl font-bold text-green-400">{currentScore.p1}</span>
          <span className="text-xl text-gray-500">-</span>
          <span className="text-2xl font-bold text-blue-400">{currentScore.p2}</span>
          <span className="text-sm text-gray-400">:{player2Label}</span>
        </div>
      )}

      {/* Preset scores */}
      {mode === 'presets' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {PRESET_SCORES.map(({ p1, p2 }) => (
              <button
                key={`${p1}-${p2}`}
                onClick={() => handlePresetClick(p1, p2)}
                className="min-h-12 rounded-lg border-2 border-gray-700 hover:border-blue-500 hover:bg-blue-500/10 text-lg font-medium transition-all active:scale-95"
              >
                {p1}-{p2}
              </button>
            ))}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DEUCE_SCORES.map(({ p1, p2 }) => (
              <button
                key={`${p1}-${p2}`}
                onClick={() => handlePresetClick(p1, p2)}
                className="min-h-12 rounded-lg border-2 border-gray-700 hover:border-blue-500 hover:bg-blue-500/10 text-lg font-medium transition-all active:scale-95"
              >
                {p1}-{p2}
              </button>
            ))}
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

      {/* Swap button */}
      {allowSwap && currentScore && mode === 'presets' && (
        <Button
          variant="ghost"
          size="lg"
          className="w-full"
          onClick={handleSwap}
        >
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Swap: {currentScore.p2}-{currentScore.p1}
        </Button>
      )}
    </div>
  );
}
