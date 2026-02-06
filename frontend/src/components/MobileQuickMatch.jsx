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

  // Step state: 1 (players) → 2 (game type) → 3+ (set scores) → final (review)
  const [step, setStep] = useState(1);

  // Form data
  const [selectedPlayer1, setSelectedPlayer1] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [selectedGameType, setSelectedGameType] = useState('best_of_3');
  const [setScores, setSetScores] = useState([]); // [{ p1, p2 }, ...]

  // Loading states
  const [league, setLeague] = useState(null);
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

  // Find current user's roster entry
  const selfRoster = useMemo(
    () => members.find((m) => m.user_id === me?.id),
    [members, me?.id]
  );

  // Check if user can select any player
  const canSelectAnyPlayer = useMemo(() => {
    if (me?.is_admin) return true;
    const myRoster = members.find((m) => m.user_id === me?.id);
    if (myRoster?.is_admin) return true;
    return !!league?.allow_member_match_recording;
  }, [me, members, league]);

  // Get current game type metadata
  const gameType = getGameTypeById(selectedGameType);
  const totalSteps = 2 + gameType.maxSets + 1; // opponent + type + sets + review

  // Calculate stats from actual scores
  const { player1SetsWon, player2SetsWon, player1Points, player2Points } = useMemo(() => {
    return calculateWinner(setScores);
  }, [setScores]);

  // Load league data and members
  useEffect(() => {
    if (!initialLeagueId) {
      setLeague(null);
      setMembers([]);
      return;
    }

    const loadLeagueAndMembers = async () => {
      try {
        setLoadingMembers(true);

        // Load league details to get setting
        const leagueRes = await leaguesAPI.getById(initialLeagueId);
        setLeague(leagueRes.data);

        // Load members
        const membersRes = await leaguesAPI.getMembers(initialLeagueId);
        const arr = (membersRes.data.members || membersRes.data) || [];
        setMembers(arr); // Keep all members (not filtered)
      } catch (e) {
        console.error('Failed to load league/members', e);
        toast.error(t('recordMatch.failedToLoadLeagueMembers'));
      } finally {
        setLoadingMembers(false);
      }
    };
    loadLeagueAndMembers();
  }, [initialLeagueId, me?.id, t]);

  // Initialize Player 1 to current user when members load
  useEffect(() => {
    if (selfRoster?.roster_id && !selectedPlayer1) {
      setSelectedPlayer1(selfRoster.roster_id);
    }
  }, [selfRoster?.roster_id, selectedPlayer1]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const payload = {
        league_id: initialLeagueId,
        player1_roster_id: selectedPlayer1,
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
    if (step === 1) return selectedPlayer1 !== null && selectedOpponent !== null && selectedPlayer1 !== selectedOpponent;
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

  // Get player display names
  const player1Name = members.find((m) => m.roster_id === selectedPlayer1)?.display_name || 'Player 1';
  const player2Name = members.find((m) => m.roster_id === selectedOpponent)?.display_name || 'Player 2';

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
          {/* STEP 1: Player Selection */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Player 1 */}
              <div>
                <h3 className="text-base font-medium flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-blue-400" />
                  Player 1
                </h3>
                {canSelectAnyPlayer ? (
                  <Select
                    value={selectedPlayer1?.toString()}
                    onValueChange={(v) => setSelectedPlayer1(Number(v))}
                    disabled={loadingMembers}
                  >
                    <SelectTrigger className="w-full h-12 text-base">
                      <SelectValue placeholder={loadingMembers ? t('common.loading') : 'Select Player 1'} />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.roster_id} value={String(m.roster_id)} className="text-base py-2">
                          {m.display_name} {typeof m.current_elo === 'number' ? `(${m.current_elo})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="w-full h-12 px-3 flex items-center bg-gray-800/40 border border-gray-700 rounded-lg text-base">
                    {selfRoster?.display_name || me?.username || 'You'} {typeof selfRoster?.current_elo === 'number' ? `(${selfRoster.current_elo})` : ''}
                  </div>
                )}
              </div>

              {/* Player 2 */}
              <div>
                <h3 className="text-base font-medium flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-green-400" />
                  Player 2
                </h3>
                <Select
                  value={selectedOpponent?.toString()}
                  onValueChange={(v) => setSelectedOpponent(Number(v))}
                  disabled={loadingMembers}
                >
                  <SelectTrigger className="w-full h-12 text-base">
                    <SelectValue placeholder={loadingMembers ? t('common.loading') : 'Select Player 2'} />
                  </SelectTrigger>
                  <SelectContent>
                    {members.filter((m) => m.roster_id !== selectedPlayer1).map((m) => (
                      <SelectItem key={m.roster_id} value={String(m.roster_id)} className="text-base py-2">
                        {m.display_name} {typeof m.current_elo === 'number' ? `(${m.current_elo})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPlayer1 === selectedOpponent && selectedOpponent && (
                <p className="text-xs text-red-400">Player 1 and Player 2 must be different</p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 h-12 text-base"
                  onClick={handleBack}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('quickMatch.back')}
                </Button>
                <Button
                  size="lg"
                  className="flex-1 h-12 text-base"
                  disabled={!canProceed()}
                  onClick={handleNext}
                >
                  {t('quickMatch.next')} <ArrowRight className="ml-2 h-4 w-4" />
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
                    {player1Name} vs {player2Name}
                  </p>
                  <SetScoreInput
                    currentScore={setScores[setIndex]}
                    onScoreSelect={(p1, p2) => handleSetScore(setIndex, p1, p2)}
                    allowSwap={true}
                    player1Label={player1Name}
                    player2Label={player2Name}
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
                  <span className="text-muted-foreground">Player 1:</span>
                  <span className="font-medium">{player1Name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Player 2:</span>
                  <span className="font-medium">{player2Name}</span>
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
