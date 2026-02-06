import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { leaguesAPI, matchesAPI } from '@/services/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Zap, Trophy, User, ArrowRight, Check } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import SetScoreInput from '@/components/SetScoreInput';

import { GAME_TYPE_VALUES, getGameTypeById, calculateWinner } from '@/constants/gameTypes';

export default function QuickMatchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Step state (1-4)
  const [step, setStep] = useState(1);

  // Form data
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedPlayer1, setSelectedPlayer1] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [selectedGameType, setSelectedGameType] = useState('best_of_3');
  const [setScores, setSetScores] = useState([]); // [{ p1, p2 }, ...]

  // Loading states
  const [leagues, setLeagues] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
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

  // Check if user can select any player (admin or league setting enabled)
  const canSelectAnyPlayer = useMemo(() => {
    // Site admin or league admin can always select any player
    if (me?.is_admin) return true;
    const myRoster = members.find((m) => m.user_id === me?.id);
    if (myRoster?.is_admin) return true;

    // Check league setting
    const selectedLeagueData = leagues.find((l) => l.id === selectedLeague);
    return !!selectedLeagueData?.allow_member_match_recording;
  }, [me, members, leagues, selectedLeague]);

  // Calculate stats from actual scores
  const { player1SetsWon, player2SetsWon, player1Points, player2Points } = useMemo(() => {
    return calculateWinner(setScores);
  }, [setScores]);

  // Get current game type metadata
  const gameType = getGameTypeById(selectedGameType);
  const totalSteps = 3 + gameType.maxSets + 1; // league + opponent + type + sets (up to maxSets) + review

  // Load leagues
  useEffect(() => {
    const loadLeagues = async () => {
      try {
        setLoadingLeagues(true);
        const { data } = await leaguesAPI.getAll({ page: 1, limit: 100 });
        const items = data.leagues || data.items || [];
        const mine = items.filter((l) => l.is_member);
        setLeagues(mine);
      } catch (e) {
        console.error('Failed to load leagues', e);
        toast.error(t('recordMatch.failedToLoadLeagues'));
      } finally {
        setLoadingLeagues(false);
      }
    };
    loadLeagues();
  }, [t]);

  // Load members when league changes
  useEffect(() => {
    if (!selectedLeague) {
      setMembers([]);
      setSelectedPlayer1(null);
      setSelectedOpponent(null);
      return;
    }

    const loadMembers = async () => {
      try {
        setLoadingMembers(true);
        const { data } = await leaguesAPI.getMembers(selectedLeague);
        const arr = (data.members || data) || [];
        setMembers(arr); // Keep all members (not filtered)
      } catch (e) {
        console.error('Failed to load members', e);
        toast.error(t('recordMatch.failedToLoadLeagueMembers'));
      } finally {
        setLoadingMembers(false);
      }
    };
    loadMembers();
  }, [selectedLeague, me?.id, t]);

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
        league_id: selectedLeague,
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
      navigate('/app/matches');
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

    // Auto-advance to review if winner is decided
    if (p1Sets >= gameType.setsToWin || p2Sets >= gameType.setsToWin) {
      setStep(totalSteps); // Jump to review
    }
  };

  const canProceed = () => {
    if (step === 1) return selectedLeague !== null;
    if (step === 2) return selectedPlayer1 !== null && selectedOpponent !== null && selectedPlayer1 !== selectedOpponent;
    if (step === 3) return selectedGameType !== null;
    if (step >= 4 && step < totalSteps) {
      // On set entry steps, check if current set is entered
      const setIndex = step - 4;
      return setScores[setIndex] !== undefined;
    }
    if (step === totalSteps) {
      // On review step, check if match has valid winner
      return player1SetsWon !== player2SetsWon &&
             (player1SetsWon >= gameType.setsToWin || player2SetsWon >= gameType.setsToWin);
    }
    return false;
  };

  if (loadingLeagues) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 mx-auto w-full max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-6 w-6 text-yellow-400" />
          <h1 className="text-2xl font-semibold">{t('nav.quickMatch')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('quickMatch.subtitle')}</p>
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
          {/* STEP 1: League Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  {t('quickMatch.selectLeague')}
                </h2>
                <Select
                  value={selectedLeague?.toString()}
                  onValueChange={(v) => setSelectedLeague(Number(v))}
                >
                  <SelectTrigger className="w-full h-14 text-lg">
                    <SelectValue placeholder={t('recordMatch.selectLeague')} />
                  </SelectTrigger>
                  <SelectContent>
                    {leagues.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)} className="text-lg py-3">
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="lg"
                className="w-full h-14 text-lg"
                disabled={!canProceed()}
                onClick={() => setStep(2)}
              >
                {t('quickMatch.next')} <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* STEP 2: Player Selection */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Player 1 */}
              <div>
                <h2 className="text-lg font-medium flex items-center gap-2 mb-2">
                  <User className="h-5 w-5 text-blue-400" />
                  Player 1
                </h2>
                {canSelectAnyPlayer ? (
                  <Select
                    value={selectedPlayer1?.toString()}
                    onValueChange={(v) => setSelectedPlayer1(Number(v))}
                    disabled={loadingMembers}
                  >
                    <SelectTrigger className="w-full h-14 text-lg">
                      <SelectValue
                        placeholder={loadingMembers ? t('common.loading') : 'Select Player 1'}
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
                ) : (
                  <div className="w-full h-14 px-4 flex items-center bg-gray-800/40 border border-gray-700 rounded-lg text-lg">
                    {selfRoster?.display_name || me?.username || 'You'} {typeof selfRoster?.current_elo === 'number' ? `(${selfRoster.current_elo})` : ''}
                  </div>
                )}
              </div>

              {/* Player 2 */}
              <div>
                <h2 className="text-lg font-medium flex items-center gap-2 mb-2">
                  <User className="h-5 w-5 text-green-400" />
                  Player 2
                </h2>
                <Select
                  value={selectedOpponent?.toString()}
                  onValueChange={(v) => setSelectedOpponent(Number(v))}
                  disabled={loadingMembers}
                >
                  <SelectTrigger className="w-full h-14 text-lg">
                    <SelectValue
                      placeholder={
                        loadingMembers ? t('common.loading') : 'Select Player 2'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {members.filter((m) => m.roster_id !== selectedPlayer1).map((m) => (
                      <SelectItem key={m.roster_id} value={String(m.roster_id)} className="text-lg py-3">
                        {m.display_name} {typeof m.current_elo === 'number' ? `(${m.current_elo})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPlayer1 === selectedOpponent && selectedOpponent && (
                <p className="text-sm text-red-400">Player 1 and Player 2 must be different</p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 h-14 text-lg"
                  onClick={() => setStep(1)}
                >
                  {t('quickMatch.back')}
                </Button>
                <Button
                  size="lg"
                  className="flex-1 h-14 text-lg"
                  disabled={!canProceed()}
                  onClick={() => setStep(3)}
                >
                  {t('quickMatch.next')} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Game Type Selection */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  {t('matchDetail.gameType')}
                </h2>
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
                  onClick={() => setStep(2)}
                >
                  {t('quickMatch.back')}
                </Button>
                <Button
                  size="lg"
                  className="flex-1 h-14 text-lg"
                  disabled={!canProceed()}
                  onClick={() => setStep(4)}
                >
                  {t('quickMatch.next')} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4+: Set Score Entry (one per set) */}
          {step >= 4 && step < totalSteps && (() => {
            const setIndex = step - 4;
            const setNumber = setIndex + 1;
            const player1Name = members.find((m) => m.roster_id === selectedPlayer1)?.display_name || 'Player 1';
            const player2Name = members.find((m) => m.roster_id === selectedOpponent)?.display_name || 'Player 2';

            return (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-medium mb-2">
                    Set {setNumber}
                  </h2>
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
                    onClick={() => setStep(step - 1)}
                  >
                    {t('quickMatch.back')}
                  </Button>
                  {setScores[setIndex] && (
                    <Button
                      size="lg"
                      className="flex-1 h-14 text-lg"
                      onClick={() => {
                        // Check if match is decided
                        const { player1SetsWon: p1Sets, player2SetsWon: p2Sets } = calculateWinner(setScores.slice(0, setIndex + 1));
                        if (p1Sets >= gameType.setsToWin || p2Sets >= gameType.setsToWin) {
                          setStep(totalSteps);
                        } else {
                          setStep(step + 1);
                        }
                      }}
                    >
                      {t('quickMatch.next')} <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* FINAL STEP: Review & Submit */}
          {step === totalSteps && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium">{t('quickMatch.reviewAndSubmit')}</h2>

              <div className="space-y-3 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('recordMatch.leagueLabel')}:</span>
                  <span className="font-medium">{leagues.find((l) => l.id === selectedLeague)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('recordMatch.opponentLabel')}:</span>
                  <span className="font-medium">
                    {members.find((m) => m.roster_id === selectedOpponent)?.display_name}
                  </span>
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
                <h3 className="text-sm font-medium text-muted-foreground">Set Scores:</h3>
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
                  onClick={() => setStep(step - 1)}
                  disabled={submitting}
                >
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
