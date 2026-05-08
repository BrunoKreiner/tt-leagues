import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { leaguesAPI, matchesAPI } from '@/services/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Zap, Check, Trophy, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

import { GAME_TYPE_VALUES, getGameTypeById, calculateWinner } from '@/constants/gameTypes';

const PRESET_LOSER_SCORES = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const DEUCE_PAIRS = [
  { winner: 12, loser: 10 },
  { winner: 13, loser: 11 },
  { winner: 14, loser: 12 },
  { winner: 15, loser: 13 },
  { winner: 16, loser: 14 },
];

export default function QuickMatchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [selectedPlayer1, setSelectedPlayer1] = useState(null);
  const [adminMode, setAdminMode] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState('best_of_3');
  const [setScores, setSetScores] = useState([]);

  const [editingSet, setEditingSet] = useState(null);
  const [entryMode, setEntryMode] = useState('presets');
  const [activeWinner, setActiveWinner] = useState('p1');
  const [manualP1, setManualP1] = useState('');
  const [manualP2, setManualP2] = useState('');

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

  const gameType = getGameTypeById(selectedGameType);
  const { player1SetsWon, player2SetsWon, player1Points, player2Points } = useMemo(
    () => calculateWinner(setScores),
    [setScores],
  );

  const myMembership = useMemo(
    () => members.find((m) => m.user_id === me?.id),
    [members, me?.id],
  );
  const isLeagueAdmin = !!myMembership?.is_league_admin;
  const canRecordForOthers = isAdmin || isLeagueAdmin;

  const opponentOptions = useMemo(() => {
    if (adminMode) {
      return members.filter((m) => m.roster_id !== selectedPlayer1);
    }
    return members.filter((m) => m.user_id !== me?.id);
  }, [adminMode, members, me?.id, selectedPlayer1]);

  const matchDecided =
    player1SetsWon >= gameType.setsToWin || player2SetsWon >= gameType.setsToWin;

  const player1Member = adminMode
    ? members.find((m) => m.roster_id === selectedPlayer1)
    : myMembership;
  const youLabel = adminMode
    ? (player1Member?.display_name || t('quickMatch.player1'))
    : (me?.username || t('recordMatch.you'));
  const opponentName =
    members.find((m) => m.roster_id === selectedOpponent)?.display_name || t('recordMatch.opponent');

  const activeIndex =
    editingSet !== null
      ? editingSet
      : matchDecided
        ? -1
        : Math.min(setScores.length, gameType.maxSets - 1);

  const playersReady = selectedOpponent !== null && (!adminMode || selectedPlayer1 !== null);

  const showActiveEntry =
    selectedLeague !== null &&
    playersReady &&
    !matchDecided &&
    activeIndex >= 0 &&
    activeIndex < gameType.maxSets;

  useEffect(() => {
    const loadLeagues = async () => {
      try {
        setLoadingLeagues(true);
        const { data } = await leaguesAPI.getAll({ page: 1, limit: 100 });
        const items = data.leagues || data.items || [];
        setLeagues(items.filter((l) => l.is_member));
      } catch (e) {
        console.error('Failed to load leagues', e);
        toast.error(t('recordMatch.failedToLoadLeagues'));
      } finally {
        setLoadingLeagues(false);
      }
    };
    loadLeagues();
  }, [t]);

  useEffect(() => {
    if (!selectedLeague) {
      setMembers([]);
      setSelectedOpponent(null);
      setSelectedPlayer1(null);
      setAdminMode(false);
      return;
    }
    setSelectedOpponent(null);
    setSelectedPlayer1(null);
    setAdminMode(false);
    const loadMembers = async () => {
      try {
        setLoadingMembers(true);
        const { data } = await leaguesAPI.getMembers(selectedLeague);
        const arr = (data.members || data) || [];
        setMembers(arr);
      } catch (e) {
        console.error('Failed to load members', e);
        toast.error(t('recordMatch.failedToLoadLeagueMembers'));
      } finally {
        setLoadingMembers(false);
      }
    };
    loadMembers();
  }, [selectedLeague, t]);

  useEffect(() => {
    if (!adminMode) {
      setSelectedPlayer1(null);
      setSelectedOpponent((prev) => {
        if (!prev) return prev;
        const stillValid = members.some(
          (m) => m.roster_id === prev && m.user_id !== me?.id,
        );
        return stillValid ? prev : null;
      });
    }
  }, [adminMode, members, me?.id]);

  useEffect(() => {
    if (setScores.length > gameType.maxSets) {
      setSetScores((prev) => prev.slice(0, gameType.maxSets));
    }
  }, [gameType.maxSets, setScores.length]);

  const recordSet = (p1, p2) => {
    setSetScores((prev) => {
      const next = [...prev];
      next[activeIndex] = { p1, p2 };
      return next;
    });
    setEditingSet(null);
    setEntryMode('presets');
    setActiveWinner('p1');
    setManualP1('');
    setManualP2('');
  };

  const handlePreset = (loserScore) => {
    if (activeWinner === 'p1') recordSet(11, loserScore);
    else recordSet(loserScore, 11);
  };

  const handleDeuce = (winnerScore, loserScore) => {
    if (activeWinner === 'p1') recordSet(winnerScore, loserScore);
    else recordSet(loserScore, winnerScore);
  };

  const handleManual = () => {
    const p1 = parseInt(manualP1, 10);
    const p2 = parseInt(manualP2, 10);
    if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 < 0 || p2 < 0 || p1 === p2) return;
    recordSet(p1, p2);
  };

  const handleEditSet = (idx) => {
    setEditingSet(idx);
    const existing = setScores[idx];
    if (existing) setActiveWinner(existing.p1 > existing.p2 ? 'p1' : 'p2');
    setEntryMode('presets');
  };

  const handleClearSet = (idx) => {
    setSetScores((prev) => prev.slice(0, idx));
    setEditingSet(null);
  };

  const handleFormatChange = (id) => {
    setSelectedGameType(id);
    const next = getGameTypeById(id);
    if (setScores.length > next.maxSets) setSetScores((prev) => prev.slice(0, next.maxSets));
    setEditingSet(null);
  };

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
        sets: setScores.map((s, idx) => ({
          set_number: idx + 1,
          player1_score: s.p1,
          player2_score: s.p2,
        })),
      };
      if (adminMode && selectedPlayer1) {
        payload.player1_roster_id = selectedPlayer1;
      }
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

  if (loadingLeagues) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const eyebrow = 'font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--accent)]';
  const divider = (
    <div aria-hidden="true" className="h-px w-full" style={{ background: 'var(--line-soft)' }} />
  );

  return (
    <div className="px-4 py-6 mx-auto w-full max-w-[560px]">
      {/* HEADER */}
      <div className="mb-5 flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center rounded-full"
          style={{
            width: 38,
            height: 38,
            background: 'oklch(0.70 0.20 38 / 0.14)',
            color: 'var(--accent)',
          }}
        >
          <Zap className="h-5 w-5" />
        </span>
        <div>
          <h1
            className="font-sans font-bold leading-none"
            style={{ fontSize: 26, letterSpacing: '-0.02em' }}
          >
            {t('nav.quickMatch')}
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--fg-3)' }}>
            {t('quickMatch.subtitle')}
          </p>
        </div>
      </div>

      {/* MAIN PANEL */}
      <div
        className="relative overflow-hidden p-5 sm:p-6 space-y-5"
        style={{
          background: 'var(--bg-2)',
          border: '1.5px solid var(--line-soft)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 right-0"
          style={{ height: 2, background: 'var(--accent)', borderRadius: 'var(--r-lg) var(--r-lg) 0 0' }}
        />

        {/* LEAGUE */}
        <div className="space-y-2">
          <div className={eyebrow}>{t('quickMatch.selectLeague')}</div>
          <Select
            value={selectedLeague?.toString() || ''}
            onValueChange={(v) => setSelectedLeague(Number(v))}
          >
            <SelectTrigger className="w-full h-12 text-[15px]">
              <SelectValue placeholder={t('recordMatch.selectLeague')} />
            </SelectTrigger>
            <SelectContent>
              {leagues.map((l) => (
                <SelectItem key={l.id} value={String(l.id)} className="text-base py-2.5">
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {divider}

        {/* ADMIN: Record for another person */}
        {selectedLeague && canRecordForOthers && (
          <>
            <div
              className="flex items-center justify-between rounded-md px-3 py-2.5"
              style={{ border: '1.5px solid var(--line-soft)', background: 'var(--bg-3, transparent)' }}
            >
              <div className="pr-3">
                <div className="text-[14px] font-medium" style={{ color: 'var(--fg)' }}>
                  {t('quickMatch.recordForAnotherPerson')}
                </div>
                <div className="text-[12px]" style={{ color: 'var(--fg-3)' }}>
                  {t('quickMatch.recordForAnotherPersonHint')}
                </div>
              </div>
              <Switch checked={adminMode} onCheckedChange={setAdminMode} />
            </div>

            {divider}
          </>
        )}

        {/* PLAYER 1 (admin mode only) */}
        {adminMode && (
          <>
            <div className="space-y-2">
              <div className={eyebrow}>{t('quickMatch.selectPlayer1')}</div>
              <Select
                value={selectedPlayer1?.toString() || ''}
                onValueChange={(v) => setSelectedPlayer1(Number(v))}
                disabled={!selectedLeague || loadingMembers}
              >
                <SelectTrigger className="w-full h-12 text-[15px]">
                  <SelectValue
                    placeholder={
                      !selectedLeague
                        ? t('recordMatch.selectLeagueFirst')
                        : loadingMembers
                          ? t('common.loading')
                          : t('quickMatch.selectPlayer1')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {members
                    .filter((m) => m.roster_id !== selectedOpponent)
                    .map((m) => (
                      <SelectItem key={m.roster_id} value={String(m.roster_id)} className="text-base py-2.5">
                        {m.display_name}
                        {typeof m.current_elo === 'number' ? `  ·  ${m.current_elo}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {divider}
          </>
        )}

        {/* OPPONENT */}
        <div className="space-y-2">
          <div className={eyebrow}>
            {adminMode ? t('quickMatch.selectPlayer2') : t('quickMatch.selectOpponent')}
          </div>
          <Select
            value={selectedOpponent?.toString() || ''}
            onValueChange={(v) => setSelectedOpponent(Number(v))}
            disabled={!selectedLeague || loadingMembers}
          >
            <SelectTrigger className="w-full h-12 text-[15px]">
              <SelectValue
                placeholder={
                  !selectedLeague
                    ? t('recordMatch.selectLeagueFirst')
                    : loadingMembers
                      ? t('common.loading')
                      : (adminMode ? t('quickMatch.selectPlayer2') : t('recordMatch.selectOpponent'))
                }
              />
            </SelectTrigger>
            <SelectContent>
              {opponentOptions.map((m) => (
                <SelectItem key={m.roster_id} value={String(m.roster_id)} className="text-base py-2.5">
                  {m.display_name}
                  {typeof m.current_elo === 'number' ? `  ·  ${m.current_elo}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {divider}

        {/* FORMAT */}
        <div className="space-y-2">
          <div className={eyebrow}>{t('matchDetail.gameType')}</div>
          <div className="grid grid-cols-4 gap-2">
            {GAME_TYPE_VALUES.map((gt) => {
              const active = selectedGameType === gt.id;
              return (
                <button
                  key={gt.id}
                  type="button"
                  onClick={() => handleFormatChange(gt.id)}
                  className="h-12 rounded-md text-[15px] font-semibold transition-all active:scale-[0.97]"
                  style={{
                    background: active ? 'oklch(0.70 0.20 38 / 0.14)' : 'transparent',
                    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-soft)'}`,
                    color: active ? 'var(--accent)' : 'var(--fg-2)',
                  }}
                >
                  {gt.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {divider}

        {/* SCOREBOARD */}
        <div className="space-y-3">
          <div className={eyebrow}>{t('quickMatch.score')}</div>
          <div
            className="flex items-center justify-center gap-4 py-3 rounded-md"
            style={{ background: 'var(--bg-3, oklch(0.18 0.006 50))' }}
          >
            <span className="text-[13px] truncate max-w-[35vw] text-right" style={{ color: 'var(--fg-2)' }}>
              {youLabel}
            </span>
            <span
              className="tabular-nums font-bold"
              style={{
                fontSize: 38,
                lineHeight: 1,
                color: player1SetsWon >= player2SetsWon && matchDecided ? 'var(--accent)' : 'var(--fg)',
              }}
            >
              {player1SetsWon}
            </span>
            <span
              style={{
                fontFamily: '"Fraunces", ui-serif, Georgia, serif',
                fontStyle: 'italic',
                color: 'var(--accent)',
                fontSize: 18,
                fontWeight: 500,
              }}
            >
              vs.
            </span>
            <span
              className="tabular-nums font-bold"
              style={{
                fontSize: 38,
                lineHeight: 1,
                color: player2SetsWon > player1SetsWon && matchDecided ? 'var(--accent)' : 'var(--fg)',
              }}
            >
              {player2SetsWon}
            </span>
            <span className="text-[13px] truncate max-w-[35vw]" style={{ color: 'var(--fg-2)' }}>
              {opponentName}
            </span>
          </div>

          {/* Set chips */}
          {setScores.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {setScores.map((s, idx) => {
                const youWon = s.p1 > s.p2;
                const isEditing = editingSet === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleEditSet(idx)}
                    className="inline-flex items-center gap-2 px-3 h-9 rounded-full text-[13px] font-mono tabular-nums transition-all active:scale-[0.97]"
                    style={{
                      background: isEditing ? 'oklch(0.70 0.20 38 / 0.14)' : 'transparent',
                      border: `1.5px solid ${isEditing ? 'var(--accent)' : 'var(--line-soft)'}`,
                      color: 'var(--fg)',
                    }}
                  >
                    <span style={{ color: 'var(--fg-3)' }}>{idx + 1}</span>
                    <span style={{ color: youWon ? 'var(--accent)' : 'var(--fg-2)' }}>{s.p1}</span>
                    <span style={{ color: 'var(--fg-3)' }}>–</span>
                    <span style={{ color: !youWon ? 'var(--accent)' : 'var(--fg-2)' }}>{s.p2}</span>
                    <Pencil className="h-3 w-3" style={{ color: 'var(--fg-3)' }} />
                  </button>
                );
              })}
            </div>
          )}

          {matchDecided && (
            <div
              className="flex items-center gap-2 text-[13px]"
              style={{ color: 'var(--accent)' }}
            >
              <Trophy className="h-4 w-4" />
              <span style={{ fontFamily: '"Fraunces", ui-serif, Georgia, serif', fontStyle: 'italic' }}>
                {player1SetsWon > player2SetsWon ? youLabel : opponentName} wins
              </span>
            </div>
          )}
        </div>

        {/* ACTIVE SET ENTRY */}
        {showActiveEntry && (
          <>
            {divider}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className={eyebrow}>
                  {t('recordMatch.set')} {activeIndex + 1}
                </div>
                {editingSet !== null && (
                  <button
                    type="button"
                    onClick={() => handleClearSet(editingSet)}
                    className="text-[12px]"
                    style={{ color: 'var(--fg-3)' }}
                  >
                    {t('common.cancel')}
                  </button>
                )}
              </div>

              {/* Winner toggle */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'p1', label: youLabel },
                  { id: 'p2', label: opponentName },
                ].map(({ id, label }) => {
                  const active = activeWinner === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveWinner(id)}
                      className="h-11 rounded-md text-[14px] font-medium transition-all active:scale-[0.97] truncate px-3 inline-flex items-center justify-center gap-1.5"
                      style={{
                        background: active ? 'oklch(0.70 0.20 38 / 0.14)' : 'transparent',
                        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-soft)'}`,
                        color: active ? 'var(--accent)' : 'var(--fg-2)',
                      }}
                    >
                      {active && <Trophy className="h-3.5 w-3.5" />}
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>

              {entryMode === 'presets' && (
                <>
                  <div className="grid grid-cols-5 gap-1.5">
                    {PRESET_LOSER_SCORES.map((loser) => {
                      const display =
                        activeWinner === 'p1' ? `11–${loser}` : `${loser}–11`;
                      return (
                        <button
                          key={loser}
                          type="button"
                          onClick={() => handlePreset(loser)}
                          className="h-12 rounded-md font-mono tabular-nums text-[13px] transition-all active:scale-[0.95]"
                          style={{
                            border: '1.5px solid var(--line-soft)',
                            color: 'var(--fg)',
                            background: 'transparent',
                          }}
                        >
                          {display}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEntryMode('deuce')}
                      className="h-10 rounded-md text-[13px] font-medium"
                      style={{ border: '1.5px solid var(--line-soft)', color: 'var(--fg-2)' }}
                    >
                      Deuce…
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryMode('manual')}
                      className="h-10 rounded-md text-[13px] font-medium"
                      style={{ border: '1.5px solid var(--line-soft)', color: 'var(--fg-2)' }}
                    >
                      Manual
                    </button>
                  </div>
                </>
              )}

              {entryMode === 'deuce' && (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DEUCE_PAIRS.map(({ winner, loser }) => {
                      const display =
                        activeWinner === 'p1' ? `${winner}–${loser}` : `${loser}–${winner}`;
                      return (
                        <button
                          key={winner}
                          type="button"
                          onClick={() => handleDeuce(winner, loser)}
                          className="h-12 rounded-md font-mono tabular-nums text-[13px] transition-all active:scale-[0.95]"
                          style={{
                            border: '1.5px solid var(--line-soft)',
                            color: 'var(--fg)',
                          }}
                        >
                          {display}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEntryMode('presets')}
                    className="h-10 w-full rounded-md text-[13px] font-medium"
                    style={{ border: '1.5px solid var(--line-soft)', color: 'var(--fg-2)' }}
                  >
                    ← Back
                  </button>
                </>
              )}

              {entryMode === 'manual' && (
                <>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={manualP1}
                      onChange={(e) => setManualP1(e.target.value)}
                      placeholder="11"
                      className="h-12 text-center text-lg tabular-nums"
                    />
                    <span style={{ color: 'var(--fg-3)' }}>–</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={manualP2}
                      onChange={(e) => setManualP2(e.target.value)}
                      placeholder="9"
                      className="h-12 text-center text-lg tabular-nums"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEntryMode('presets');
                        setManualP1('');
                        setManualP2('');
                      }}
                      className="h-10 rounded-md text-[13px] font-medium"
                      style={{ border: '1.5px solid var(--line-soft)', color: 'var(--fg-2)' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleManual}
                      disabled={!manualP1 || !manualP2 || manualP1 === manualP2}
                      className="h-10 rounded-md text-[13px] font-semibold disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                    >
                      Confirm
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* SUBMIT */}
      <div className="mt-5">
        <Button
          onClick={handleSubmit}
          disabled={!matchDecided || submitting}
          className="w-full h-14 rounded-full font-bold text-[15px] bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-2)] disabled:opacity-50 tt-btn-primary"
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
        {!matchDecided && selectedLeague && playersReady && (
          <p className="text-center text-[12px] mt-3" style={{ color: 'var(--fg-3)' }}>
            {t('quickMatch.enterSetsHint', {
              defaultValue: `Enter sets until someone wins ${gameType.setsToWin}`,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
