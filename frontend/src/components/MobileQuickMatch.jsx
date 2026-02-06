import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { leaguesAPI, matchesAPI } from '@/services/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft, Check, Trophy, User } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import SetScoreInput from '@/components/SetScoreInput';

import { GAME_TYPE_VALUES, getGameTypeById, calculateWinner } from '@/constants/gameTypes';

/**
 * Mobile-optimized match recording wizard
 * Captures actual set scores (not simplified) for accurate ELO calculation
 *
 * @param {Object} props
 * @param {number} props.initialLeagueId - Pre-filled league ID from league page
 * @param {Function} props.onSuccess - Callback after successful submission
 * @param {Function} props.onCancel - Callback to close modal
 */
export default function MobileQuickMatch({ initialLeagueId, onSuccess, onCancel }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Step state: 1 (opponent) → 2 (game type) → 3+ (set scores) → final (review)
  const [step, setStep] = useState(1);

  // Form data
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [selectedGameType, setSelectedGameType] = useState('best_of_3');
  const [setScores, setSetScores] = useState([]); // [{ p1, p2 }, ...]

  // Loading states
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const me = useMemo(() => {
    if (user) return user;
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, [user]);

  // Get current game type metadata
  const gameType = getGameTypeById(selectedGameType);
  const totalSteps = 2 + gameType.maxSets + 1; // opponent + type + sets + review

  // Calculate stats from actual scores
  const { player1SetsWon, player2SetsWon, player1Points, player2Points } = useMemo(() => {
    return calculateWinner(setScores);
  }, [setScores]);

  // Load league members
  useEffect(() => {
    if (!initialLeagueId) {
      setMembers([]);
      return;
    }

    const loadMembers = async () => {
      try {
        setLoadingMembers(true);
        const { data } = await leaguesAPI.getMembers(initialLeagueId);
        const arr = (data.members || data) || [];
        const filtered = arr.filter((m) => m.user_id !== me?.id);
        setMembers(filtered);
      } catch (e) {
        console.error('Failed to load members', e);
        toast.error(t('recordMatch.failedToLoadLeagueMembers'));
      } finally {
        setLoadingMembers(false);
      }
    };
    loadMembers();
  }, [initialLeagueId, me?.id, t]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const payload = {
        league_id: initialLeagueId,
        player2_roster_id: selectedOpponent,
        player1_sets_won: player1SetsWon,
        player2_sets_won: player2SetsWon,
        player1_points_total: player1Points,
        player2_points_total: player2Points,
        game_type: selectedGameType,
        sets: setScores.map((s, idx) => ({
          set_number: idx + 1,
          player1_score: s.p1,
          player2_score: s.p2,
        })),
      };
      await matchesAPI.create(payload);
      toast.success(t('recordMatch.matchRecordedSuccess'));
      if (onSuccess) onSuccess();
    } catch (err) {
      const msg = err.response?.data?.error || t('recordMatch.failedToRecordMatch');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetScore = (setIndex, p1, p2) => {
    setSetScores((prev) => {
      const next = [...prev];
      next[setIndex] = { p1, p2 };
      return next;
    });

    // Check if match is decided (winner has enough sets)
    const tempScores = [...setScores];
    tempScores[setIndex] = { p1, p2 };
    const { player1SetsWon: p1Sets, player2SetsWon: p2Sets } = calculateWinner(tempScores);

    // Auto-advance if winner is decided
    if (p1Sets >= gameType.setsToWin || p2Sets >= gameType.setsToWin) {
      setStep(totalSteps); // Jump to review
    } else {
      // Otherwise move to next set
      setStep(step + 1);
    }
  };

  const canProceed = () => {
    if (step === 1) return selectedOpponent !== null;
    if (step === 2) return selectedGameType !== null;
    if (step >= 3 && step < totalSteps) {
      // On set entry steps, check if current set is entered
      const setIndex = step - 3;
      return setScores[setIndex] !== undefined;
    }
    if (step === totalSteps) {
      // On review step, check if match has valid winner
      return player1SetsWon !== player2SetsWon &&
             (player1SetsWon >= gameType.setsToWin || player2SetsWon >= gameType.setsToWin);
    }
    return false;
  };

  const handleBack = () => {
    if (step === 1) {
      if (onCancel) onCancel();
    } else {
      setStep(step - 1);
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  // Get opponent display name
  const opponentName = members.find((m) => m.roster_id === selectedOpponent)?.display_name || '';

  return (
    <div className="px-4 py-6 mx-auto w-full max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">{t('nav.quickMatch')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('quickMatch.subtitle')}
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <div
            key={idx}
            className={`h-2 flex-1 rounded-full transition-colors ${
              idx + 1 <= step ? 'bg-blue-500' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* STEP 1: Opponent Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-blue-400" />
                  {t('quickMatch.selectOpponent')}
                </h3>
                <Select
                  value={selectedOpponent?.toString()}
                  onValueChange={(v) => setSelectedOpponent(Number(v))}
                  disabled={loadingMembers}
                >
                  <SelectTrigger className="w-full h-14 text-lg">
                    <SelectValue
                      placeholder={
                        loadingMembers ? t('common.loading') : t('recordMatch.selectOpponent')
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.roster_id} value={String(m.roster_id)} className="text-lg py-3">
                        {m.display_name} {typeof m.current_elo === 'number' ? `(${m.current_elo})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 h-14 text-lg"
                  onClick={handleBack}
                >
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  {t('quickMatch.back')}
                </Button>
                <Button
                  size="lg"
                  className="flex-1 h-14 text-lg"
                  disabled={!canProceed()}
                  onClick={handleNext}
                >
                  {t('quickMatch.next')} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Game Type Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  {t('matchDetail.gameType')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {GAME_TYPE_VALUES.map((gt) => (
                    <button
                      key={gt.id}
                      onClick={() => setSelectedGameType(gt.id)}
                      className={`h-16 rounded-lg border-2 text-lg font-medium transition-all ${
                        selectedGameType === gt.id
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {gt.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 h-14 text-lg"
                  onClick={handleBack}
                >
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  {t('quickMatch.back')}
                </Button>
                <Button
                  size="lg"
                  className="flex-1 h-14 text-lg"
                  disabled={!canProceed()}
                  onClick={handleNext}
                >
                  {t('quickMatch.next')} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3+: Set Score Entry (one per set) */}
          {step >= 3 && step < totalSteps && (() => {
            const setIndex = step - 3;
            const setNumber = setIndex + 1;

            return (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">
                    Set {setNumber} of {gameType.maxSets}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {me?.username || 'You'} vs {opponentName}
                  </p>
                  <SetScoreInput
                    currentScore={setScores[setIndex]}
                    onScoreSelect={(p1, p2) => handleSetScore(setIndex, p1, p2)}
                    allowSwap={true}
                    player1Label={me?.username || 'You'}
                    player2Label={opponentName}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1 h-14 text-lg"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="mr-2 h-5 w-5" />
                    {t('quickMatch.back')}
                  </Button>
                  <Button
                    size="lg"
                    className="flex-1 h-14 text-lg"
                    disabled={!canProceed()}
                    onClick={handleNext}
                  >
                    {t('quickMatch.next')} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* FINAL STEP: Review & Submit */}
          {step === totalSteps && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium">{t('quickMatch.reviewAndSubmit')}</h3>

              <div className="space-y-3 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('recordMatch.opponentLabel')}:</span>
                  <span className="font-medium">{opponentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('matchDetail.gameType')}:</span>
                  <span className="font-medium">{gameType.label}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('quickMatch.score')}:</span>
                  <span className="text-2xl font-bold">
                    <span className={player1SetsWon > player2SetsWon ? 'text-green-400' : 'text-gray-400'}>
                      {player1SetsWon}
                    </span>
                    <span className="mx-2 text-gray-500">-</span>
                    <span className={player2SetsWon > player1SetsWon ? 'text-green-400' : 'text-gray-400'}>
                      {player2SetsWon}
                    </span>
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Points:</span>
                  <span>{player1Points} - {player2Points}</span>
                </div>
              </div>

              {/* Set-by-set breakdown */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Set Scores:</h4>
                {setScores.map((s, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-800/20 rounded">
                    <span className="text-sm">Set {idx + 1}</span>
                    <span className="font-medium">
                      <span className={s.p1 > s.p2 ? 'text-green-400' : 'text-gray-400'}>{s.p1}</span>
                      <span className="mx-2">-</span>
                      <span className={s.p2 > s.p1 ? 'text-green-400' : 'text-gray-400'}>{s.p2}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 h-14 text-lg"
                  onClick={handleBack}
                  disabled={submitting}
                >
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  {t('quickMatch.back')}
                </Button>
                <Button
                  size="lg"
                  className="flex-1 h-14 text-lg"
                  onClick={handleSubmit}
                  disabled={submitting || !canProceed()}
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner className="mr-2 h-5 w-5" />
                      {t('common.submitting')}
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-5 w-5" />
                      {t('quickMatch.submit')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
