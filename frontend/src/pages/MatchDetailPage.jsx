import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { matchesAPI } from '@/services/api';
import { leaguesAPI } from '@/services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTranslation } from 'react-i18next';

const GAME_TYPES = [
  { value: 'best_of_1', label: 'Best of 1' },
  { value: 'best_of_3', label: 'Best of 3' },
  { value: 'best_of_5', label: 'Best of 5' },
  { value: 'best_of_7', label: 'Best of 7' },
];

const MAX_SETS_BY_TYPE = {
  best_of_1: 1,
  best_of_3: 3,
  best_of_5: 5,
  best_of_7: 7,
};

const schema = z.object({
  game_type: z.enum(['best_of_1', 'best_of_3', 'best_of_5', 'best_of_7']),
  player1_sets_won: z.coerce.number().int().min(0).max(4),
  player2_sets_won: z.coerce.number().int().min(0).max(4),
  player1_points_total: z.coerce.number().int().min(0),
  player2_points_total: z.coerce.number().int().min(0),
}).refine((data) => data.player1_sets_won !== data.player2_sets_won, {
  path: ['player1_sets_won'],
  message: 'Sets won must not be equal (there must be a winner)',
});

export default function MatchDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const me = useMemo(() => {
    if (user) return user;
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }, [user]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [match, setMatch] = useState(null);
  const [sets, setSets] = useState([]); // [{ set_number, player1_score, player2_score }]
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [eloPreview, setEloPreview] = useState(null);
  const previewTimer = useRef(null);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      game_type: 'best_of_3',
      player1_sets_won: 0,
      player2_sets_won: 0,
      player1_points_total: 0,
      player2_points_total: 0,
    },
  });

  const [setScores, setSetScores] = useState([]); // [{ p1, p2 }]

  const gameType = form.watch('game_type');
  const p1SetsWon = form.watch('player1_sets_won');
  const p2SetsWon = form.watch('player2_sets_won');

  const maxSets = useMemo(() => MAX_SETS_BY_TYPE[gameType] ?? 3, [gameType]);
  const desiredSetCount = useMemo(() => {
    const sum = (Number(p1SetsWon || 0) + Number(p2SetsWon || 0));
    return Math.max(0, Math.min(maxSets, sum));
  }, [p1SetsWon, p2SetsWon, maxSets]);

  useEffect(() => {
    setSetScores((prev) => {
      let arr = [...prev];
      if (desiredSetCount > arr.length) {
        while (arr.length < desiredSetCount) arr.push({ p1: 0, p2: 0 });
      } else if (desiredSetCount < arr.length) {
        arr = arr.slice(0, desiredSetCount);
      }
      return arr;
    });
  }, [desiredSetCount]);

  // Auto totals
  useEffect(() => {
    const t1 = setScores.reduce((acc, s) => acc + (Number.isFinite(+s.p1) ? +s.p1 : 0), 0);
    const t2 = setScores.reduce((acc, s) => acc + (Number.isFinite(+s.p2) ? +s.p2 : 0), 0);
    form.setValue('player1_points_total', t1, { shouldDirty: true, shouldValidate: false });
    form.setValue('player2_points_total', t2, { shouldDirty: true, shouldValidate: false });
  }, [setScores, form]);

  const getSetClosenessStyle = (p1, p2) => {
    const a = Number(p1);
    const b = Number(p2);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return {};
    const margin = Math.abs(a - b);
    const total = a + b;
    const base = Math.min(Math.max((total - 20) / 14, 0), 1);
    const penalty = Math.max(0, (margin - 2) * 0.25);
    let score = Math.min(Math.max(base - penalty, 0), 1);
    if (score <= 0) return {};
    const hue = 30 - 30 * score;
    const sat = 90;
    const light = 60 - 10 * score;
    const color = `hsl(${hue} ${sat}% ${light}%)`;
    const glow = 4 + 8 * score;
    return { border: `2px solid ${color}`, boxShadow: `0 0 ${glow}px ${color}`, transition: 'box-shadow 120ms ease, border-color 120ms ease' };
  };

  const canEdit = useMemo(() => {
    if (!match || match.is_accepted) return false;
    if (!me?.id) return false;
    return me.id === match.player1_user_id || me.id === match.player2_user_id;
  }, [match, me?.id]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await matchesAPI.getById(id);
      const m = res.data?.match;
      const s = res.data?.sets || [];
      setMatch(m);
      setSets(s);
      // Check if current user is league admin (for accept/reject)
      try {
        const league = await leaguesAPI.getById(m.league_id);
        const mem = league.data?.user_membership;
        setIsLeagueAdmin(!!mem?.is_admin);
      } catch {
        setIsLeagueAdmin(false);
      }
      form.reset({
        game_type: m.game_type,
        player1_sets_won: m.player1_sets_won,
        player2_sets_won: m.player2_sets_won,
        player1_points_total: m.player1_points_total ?? 0,
        player2_points_total: m.player2_points_total ?? 0,
      });
      if (s.length > 0) {
        setSetScores(s.map((it) => ({ p1: it.player1_score ?? 0, p2: it.player2_score ?? 0 })));
      } else {
        const setCount = Math.max(0, Math.min(MAX_SETS_BY_TYPE[m.game_type] ?? 3, Math.max(m.player1_sets_won || 0, m.player2_sets_won || 0) * 2 - 1));
        const initial = Array.from({ length: setCount }, () => ({ p1: 0, p2: 0 }));
        setSetScores(initial);
      }
    } catch (e) {
      console.error('Failed to load match', e);
      setError(e?.response?.data?.error || 'Failed to load match');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Debounced ELO preview when participants edit pre-accept
  useEffect(() => {
    if (!match || !canEdit) return;
    const subscription = form.watch((values) => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(async () => {
        try {
          const meId = me?.id;
          if (!meId) return setEloPreview(null);
          const otherRosterId = meId === match.player1_user_id ? match.player2_roster_id : match.player1_roster_id;
          const payload = {
            league_id: match.league_id,
            player2_roster_id: otherRosterId,
            player1_sets_won: values.player1_sets_won,
            player2_sets_won: values.player2_sets_won,
            player1_points_total: Number.isFinite(+values.player1_points_total) ? +values.player1_points_total : 0,
            player2_points_total: Number.isFinite(+values.player2_points_total) ? +values.player2_points_total : 0,
          };
          if (
            payload.league_id && payload.player2_roster_id &&
            payload.player1_sets_won != null && payload.player2_sets_won != null
          ) {
            const { data } = await matchesAPI.previewElo(payload);
            setEloPreview(data);
          } else {
            setEloPreview(null);
          }
        } catch {
          setEloPreview(null);
        }
      }, 300);
    });
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, canEdit]);

  const onSubmit = async (values) => {
    try {
      setSaving(true);
      const payload = {
        game_type: values.game_type,
        player1_sets_won: values.player1_sets_won,
        player2_sets_won: values.player2_sets_won,
        player1_points_total: values.player1_points_total,
        player2_points_total: values.player2_points_total,
        sets: setScores.map((s) => ({ player1_score: Number(s.p1) || 0, player2_score: Number(s.p2) || 0 })),
      };
      await matchesAPI.update(id, payload);
      toast.success('Match updated');
      await load();
    } catch (e) {
      const msg = e?.response?.data?.error || 'Failed to update match';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-10"><LoadingSpinner /></div>;
  if (error) return (
    <Card>
      <CardHeader>
        <CardTitle>Error</CardTitle>
        <CardDescription className="text-red-500">{error}</CardDescription>
      </CardHeader>
    </Card>
  );
  if (!match) return null;

  const p1Name = match.player1_display_name || match.player1_username || 'Player 1';
  const p2Name = match.player2_display_name || match.player2_username || 'Player 2';

  const deltaP1 = match.player1_elo_after != null && match.player1_elo_before != null ? match.player1_elo_after - match.player1_elo_before : null;
  const deltaP2 = match.player2_elo_after != null && match.player2_elo_before != null ? match.player2_elo_after - match.player2_elo_before : null;

  return (
    <div className="px-4 py-6 mx-auto w-full max-w-3xl">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{t('matchDetail.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('matchDetail.leagueLabel')}: {match.league_name}</p>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>
            {match.player1_username ? (
              <Link to={`/profile/${match.player1_username}`} className="underline hover:no-underline">{p1Name}</Link>
            ) : (
              <span className="text-blue-400">{p1Name}</span>
            )}{' '}
            {t('common.vs')}{' '}
            {match.player2_username ? (
              <Link to={`/profile/${match.player2_username}`} className="underline hover:no-underline">{p2Name}</Link>
            ) : (
              <span className="text-blue-400">{p2Name}</span>
            )}
          </CardTitle>
          <CardDescription>
            {match.played_at ? `${t('matchDetail.played')}: ${format(new Date(match.played_at), 'PP p')}` : `${t('matchDetail.created')}: ${format(new Date(match.created_at), 'PP p')}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div>{t('matchDetail.statusLabel')}: {match.is_accepted ? t('status.accepted') : t('status.pending')}</div>
          {match.is_accepted && (
            <div>
              ELO: {match.elo_applied ? (
                <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs">{t('elo.applied')}{match.elo_applied_at ? ` (${format(new Date(match.elo_applied_at), 'PP p')})` : ''}</span>
              ) : (
                <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs bg-amber-900/50 text-amber-200 border-amber-700">{t('elo.deferred')}</span>
              )}
            </div>
          )}
          {match.is_accepted && match.accepted_by_username && (
            <div>{t('matchDetail.acceptedBy')}: <Link to={`/profile/${match.accepted_by_username}`} className="underline hover:no-underline">{match.accepted_by_username}</Link></div>
          )}
          <div>{t('matchDetail.gameType')}: {GAME_TYPES.find((g) => g.value === match.game_type)?.label || match.game_type}</div>
          <div>{t('matchDetail.result')}: {match.player1_sets_won} - {match.player2_sets_won}</div>
          {match.is_accepted && (
            <div className="grid gap-1 md:grid-cols-2">
              <div>
                <div className="text-muted-foreground">{p1Name} ELO</div>
                <div>
                  {match.player1_elo_before} → {match.player1_elo_after} {deltaP1 != null && (
                    <span className={deltaP1 > 0 ? 'text-green-600' : deltaP1 < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                      ({deltaP1 >= 0 ? '+' : ''}{deltaP1})
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">{p2Name} ELO</div>
                <div>
                  {match.player2_elo_before} → {match.player2_elo_after} {deltaP2 != null && (
                    <span className={deltaP2 > 0 ? 'text-green-600' : deltaP2 < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                      ({deltaP2 >= 0 ? '+' : ''}{deltaP2})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{canEdit ? t('matchDetail.editTitle') : t('matchDetail.detailsTitle')}</CardTitle>
          <CardDescription>{canEdit ? t('matchDetail.editHint') : t('matchDetail.detailsHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                name="game_type"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('matchDetail.gameType')}</FormLabel>
                    <FormControl>
                                             <RadioGroup 
                         value={field.value || 'best_of_3'} 
                         onValueChange={field.onChange} 
                         className="grid gap-2 md:grid-cols-2"
                       >
                        {GAME_TYPES.map((gt) => (
                          <div key={gt.value} className="flex items-center space-x-2 rounded-md border p-3">
                            <RadioGroupItem id={gt.value} value={gt.value} disabled={!canEdit} />
                            <label htmlFor={gt.value} className={`text-sm leading-none ${canEdit ? 'cursor-pointer' : 'opacity-70'}`}>
                              {gt.label}
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  name="player1_sets_won"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{p1Name} sets won</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={4} {...field} onChange={(e) => field.onChange(Number(e.target.value))} disabled={!canEdit} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="player2_sets_won"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{p2Name} sets won</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={4} {...field} onChange={(e) => field.onChange(Number(e.target.value))} disabled={!canEdit} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Sets:</span>
                {canEdit ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {setScores.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-1 basis-full">
                        <span className="text-sm">{idx + 1}:</span>
                        <Input
                          type="number"
                          min={0}
                          value={s.p1}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setSetScores((arr) => arr.map((it, i) => (i === idx ? { ...it, p1: Number.isFinite(v) ? v : 0 } : it)));
                          }}
                          className="w-14 h-8 px-2 text-sm"
                          aria-label={`${p1Name} points in set ${idx + 1}`}
                          style={getSetClosenessStyle(s.p1, s.p2)}
                        />
                        <span className="text-sm">:</span>
                        <Input
                          type="number"
                          min={0}
                          value={s.p2}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setSetScores((arr) => arr.map((it, i) => (i === idx ? { ...it, p2: Number.isFinite(v) ? v : 0 } : it)));
                          }}
                          className="w-14 h-8 px-2 text-sm"
                          aria-label={`${p2Name} points in set ${idx + 1}`}
                          style={getSetClosenessStyle(s.p1, s.p2)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {sets && sets.length > 0 ? (
                      sets.map((s, idx) => (
                        <div key={idx} className="text-sm">
                          Set {s.set_number ?? idx + 1}: {s.player1_score} : {s.player2_score}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">No per-set scores provided.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  name="player1_points_total"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{p1Name} total points (auto)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} readOnly disabled />
                      </FormControl>
                      <FormDescription>Automatically calculated from set scores.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="player2_points_total"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{p2Name} total points (auto)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} readOnly disabled />
                      </FormControl>
                      <FormDescription>Automatically calculated from set scores.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {canEdit && (
                <div className="rounded-md border p-3 text-sm">
                  <div className="font-medium mb-2">ELO Preview</div>
                  {!eloPreview ? (
                    <div className="text-muted-foreground">Adjust sets to preview rating change.</div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <div className="text-muted-foreground">{p1Name}</div>
                        <div>
                          {eloPreview.current_elos?.player1} → {eloPreview.new_elos?.player1}{' '}
                          <span className={(() => {
                            const d = (eloPreview.changes?.player1 ?? 0);
                            return d > 0 ? 'text-green-600' : d < 0 ? 'text-red-600' : 'text-muted-foreground';
                          })()}>
                            ({eloPreview.changes?.player1 >= 0 ? '+' : ''}{eloPreview.changes?.player1})
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">{p2Name}</div>
                        <div>
                          {eloPreview.current_elos?.player2} → {eloPreview.new_elos?.player2}{' '}
                          <span className={(() => {
                            const d = (eloPreview.changes?.player2 ?? 0);
                            return d > 0 ? 'text-green-600' : d < 0 ? 'text-red-600' : 'text-muted-foreground';
                          })()}>
                            ({eloPreview.changes?.player2 >= 0 ? '+' : ''}{eloPreview.changes?.player2})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" asChild>
                    <Link to="/matches">Back to Matches</Link>
                  </Button>
                )}
                {!canEdit && (
                  <Button type="button" variant="secondary" asChild>
                    <Link to={`/leagues/${match.league_id}`}>View League</Link>
                  </Button>
                )}
                {!match.is_accepted && isLeagueAdmin && (
                  <>
                    <Button
                      type="button"
                      onClick={async () => {
                        try {
                          setAccepting(true);
                          const r = await matchesAPI.accept(id);
                          toast.success(r.data?.message || 'Match accepted');
                          await load();
                        } catch (e) {
                          toast.error(e?.response?.data?.error || 'Failed to accept match');
                        } finally {
                          setAccepting(false);
                        }
                      }}
                      disabled={accepting}
                    >
                      {accepting ? 'Accepting…' : 'Accept Match'}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={async () => {
                        const reason = window.prompt('Optional reason for rejection:') || '';
                        try {
                          setRejecting(true);
                          const r = await matchesAPI.reject(id, reason);
                          toast.success(r.data?.message || 'Match rejected');
                          navigate('/matches');
                        } catch (e) {
                          toast.error(e?.response?.data?.error || 'Failed to reject match');
                        } finally {
                          setRejecting(false);
                        }
                      }}
                      disabled={rejecting}
                    >
                      {rejecting ? 'Rejecting…' : 'Reject Match'}
                    </Button>
                  </>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
