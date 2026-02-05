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

const GAME_TYPES = [
  { value: 'best_of_1', label: 'Bo1', maxSets: 1 },
  { value: 'best_of_3', label: 'Bo3', maxSets: 2 },
  { value: 'best_of_5', label: 'Bo5', maxSets: 3 },
  { value: 'best_of_7', label: 'Bo7', maxSets: 4 },
];

const SCORE_PRESETS = [
  { p1: 2, p2: 0, label: '2-0' },
  { p1: 2, p2: 1, label: '2-1' },
  { p1: 1, p2: 2, label: '1-2' },
  { p1: 0, p2: 2, label: '0-2' },
  { p1: 3, p2: 0, label: '3-0' },
  { p1: 3, p2: 1, label: '3-1' },
  { p1: 3, p2: 2, label: '3-2' },
  { p1: 2, p2: 3, label: '2-3' },
  { p1: 1, p2: 3, label: '1-3' },
  { p1: 0, p2: 3, label: '0-3' },
  { p1: 4, p2: 0, label: '4-0' },
  { p1: 4, p2: 1, label: '4-1' },
  { p1: 4, p2: 2, label: '4-2' },
  { p1: 4, p2: 3, label: '4-3' },
  { p1: 3, p2: 4, label: '3-4' },
  { p1: 2, p2: 4, label: '2-4' },
  { p1: 1, p2: 4, label: '1-4' },
  { p1: 0, p2: 4, label: '0-4' },
  { p1: 1, p2: 0, label: '1-0' },
  { p1: 0, p2: 1, label: '0-1' },
];

export default function QuickMatchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Step state (1-4)
  const [step, setStep] = useState(1);

  // Form data
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [selectedGameType, setSelectedGameType] = useState('best_of_3');
  const [player1SetsWon, setPlayer1SetsWon] = useState(2);
  const [player2SetsWon, setPlayer2SetsWon] = useState(1);

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

  // Auto-calculate points (simplified: sets * 11)
  const player1Points = player1SetsWon * 11;
  const player2Points = player2SetsWon * 11;

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
      setSelectedOpponent(null);
      return;
    }

    const loadMembers = async () => {
      try {
        setLoadingMembers(true);
        const { data } = await leaguesAPI.getMembers(selectedLeague);
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
  }, [selectedLeague, me?.id, t]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const payload = {
        league_id: selectedLeague,
        player2_roster_id: selectedOpponent,
        player1_sets_won: player1SetsWon,
        player2_sets_won: player2SetsWon,
        player1_points_total: player1Points,
        player2_points_total: player2Points,
        game_type: selectedGameType,
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

  const handleScorePreset = (p1, p2) => {
    setPlayer1SetsWon(p1);
    setPlayer2SetsWon(p2);
    setStep(4); // Jump to review
  };

  const canProceed = () => {
    if (step === 1) return selectedLeague !== null;
    if (step === 2) return selectedOpponent !== null;
    if (step === 3) return selectedGameType !== null;
    if (step === 4) return player1SetsWon !== player2SetsWon;
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
        {[1, 2, 3, 4].map((num) => (
          <div
            key={num}
            className={`h-2 flex-1 rounded-full transition-colors ${
              num <= step ? 'bg-blue-500' : 'bg-gray-700'
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

          {/* STEP 2: Opponent Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-blue-400" />
                  {t('quickMatch.selectOpponent')}
                </h2>
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

          {/* STEP 3: Game Type + Score Selection */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-4">{t('matchDetail.gameType')}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {GAME_TYPES.map((gt) => (
                    <button
                      key={gt.value}
                      onClick={() => setSelectedGameType(gt.value)}
                      className={`h-16 rounded-lg border-2 text-lg font-medium transition-all ${
                        selectedGameType === gt.value
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {gt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-medium mb-4">{t('quickMatch.finalScore')}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {SCORE_PRESETS.filter((preset) => {
                    const gameType = GAME_TYPES.find((gt) => gt.value === selectedGameType);
                    if (!gameType) return false;
                    return preset.p1 <= gameType.maxSets && preset.p2 <= gameType.maxSets;
                  }).map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleScorePreset(preset.p1, preset.p2)}
                      className="h-16 rounded-lg border-2 border-gray-700 hover:border-blue-500 hover:bg-blue-500/10 text-lg font-medium transition-all"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                size="lg"
                className="w-full h-14 text-lg"
                onClick={() => setStep(2)}
              >
                {t('quickMatch.back')}
              </Button>
            </div>
          )}

          {/* STEP 4: Review & Submit */}
          {step === 4 && (
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
                  <span className="font-medium">
                    {GAME_TYPES.find((gt) => gt.value === selectedGameType)?.label}
                  </span>
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
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 h-14 text-lg"
                  onClick={() => setStep(3)}
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

              <div className="text-center">
                <button
                  onClick={() => navigate('/app/matches/record')}
                  className="text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  {t('quickMatch.needDetailedScores')}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
