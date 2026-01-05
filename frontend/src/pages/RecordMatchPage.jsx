import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { leaguesAPI, matchesAPI } from '@/services/api';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import RecordMatchForm from '@/components/RecordMatchForm';

const GAME_TYPES = [
  { value: 'best_of_1', label: 'best_of_1', labelKey: 'recordMatch.gameTypeBestOf1' },
  { value: 'best_of_3', label: 'best_of_3', labelKey: 'recordMatch.gameTypeBestOf3' },
  { value: 'best_of_5', label: 'best_of_5', labelKey: 'recordMatch.gameTypeBestOf5' },
  { value: 'best_of_7', label: 'best_of_7', labelKey: 'recordMatch.gameTypeBestOf7' },
];

const MAX_SETS_BY_TYPE = {
  best_of_1: 1,
  best_of_3: 3,
  best_of_5: 5,
  best_of_7: 7,
};

const schema = z.object({
  league_id: z.coerce.number().int().positive({ message: 'Select a league' }),
  player2_roster_id: z.coerce.number().int().positive({ message: 'Select an opponent' }),
  game_type: z.enum(['best_of_1', 'best_of_3', 'best_of_5', 'best_of_7']),
  player1_sets_won: z.coerce.number().int().min(0).max(4),
  player2_sets_won: z.coerce.number().int().min(0).max(4),
  player1_points_total: z.coerce.number().int().min(0),
  player2_points_total: z.coerce.number().int().min(0),
  played_at: z.string().optional().or(z.literal('')),
}).refine((data) => data.player1_sets_won !== data.player2_sets_won, {
  path: ['player1_sets_won'],
  message: 'Sets won must not be equal (there must be a winner)',
});

export default function RecordMatchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [leagues, setLeagues] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [eloPreview, setEloPreview] = useState(null);
  const [gameTypeValue, setGameTypeValue] = useState('best_of_3');
  const previewTimer = useRef(null);

  const me = useMemo(() => {
    if (user) return user;
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }, [user]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      league_id: undefined,
      player2_roster_id: undefined,
      game_type: 'best_of_3',
      player1_sets_won: 2,
      player2_sets_won: 1,
      player1_points_total: 0,
      player2_points_total: 0,
      played_at: '',
    },
    mode: 'onChange',
  });

  // Ensure form is properly initialized
  useEffect(() => {
    if (!form.getValues('game_type')) {
      form.setValue('game_type', 'best_of_3', { shouldValidate: true });
    }
    // Sync local state with form
    setGameTypeValue(form.getValues('game_type') || 'best_of_3');
  }, [form]);

  // Local state: per-set points for each played set (auto totals)
  const [setScores, setSetScores] = useState([{ p1: 0, p2: 0 }, { p1: 0, p2: 0 }, { p1: 0, p2: 0 }]);

  // Watch key fields
  const gameType = form.watch('game_type');
  const p1SetsWon = form.watch('player1_sets_won');
  const p2SetsWon = form.watch('player2_sets_won');

  // Sync local state with form value
  useEffect(() => {
    if (gameType && gameType !== gameTypeValue) {
      setGameTypeValue(gameType);
    }
  }, [gameType, gameTypeValue]);

  const maxSets = useMemo(() => MAX_SETS_BY_TYPE[gameType] ?? 3, [gameType]);
  const desiredSetCount = useMemo(() => {
    const sum = (Number(p1SetsWon || 0) + Number(p2SetsWon || 0));
    return Math.max(0, Math.min(maxSets, sum));
  }, [p1SetsWon, p2SetsWon, maxSets]);

  // Adjust setScores length to match desiredSetCount
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

  // Basic validation: total sets should not exceed max for the game type
  useEffect(() => {
    const totalSets = Number(p1SetsWon || 0) + Number(p2SetsWon || 0);
    if (totalSets > maxSets) {
      form.setError('player1_sets_won', {
        type: 'manual',
        message: `${t('recordMatch.totalSetsExceedsMax', { max: maxSets, gameType: gameType.replaceAll('_', ' ') })}`,
      });
    } else {
      form.clearErrors('player1_sets_won');
    }
  }, [p1SetsWon, p2SetsWon, maxSets, gameType, form, t]);

  // Auto-calc totals from per-set scores and update form values (totals are read-only in UI)
  useEffect(() => {
    const t1 = setScores.reduce((acc, s) => acc + (Number.isFinite(+s.p1) ? +s.p1 : 0), 0);
    const t2 = setScores.reduce((acc, s) => acc + (Number.isFinite(+s.p2) ? +s.p2 : 0), 0);
    form.setValue('player1_points_total', t1, { shouldDirty: true, shouldValidate: false });
    form.setValue('player2_points_total', t2, { shouldDirty: true, shouldValidate: false });
  }, [setScores, form]);

  // Style helper: highlight close sets with orange→red gradient
  const _getSetClosenessStyle = (p1, p2) => {
    const a = Number(p1);
    const b = Number(p2);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return {};
    const margin = Math.abs(a - b);
    const total = a + b;
    // Base increases with extended points beyond 20; 20 -> 0, 34 -> 1
    const base = Math.min(Math.max((total - 20) / 14, 0), 1);
    // Penalize larger margins (>2)
    const penalty = Math.max(0, (margin - 2) * 0.25);
    let score = Math.min(Math.max(base - penalty, 0), 1);
    if (score <= 0) return {};
    // Color from orange (h≈30) to red (h≈0), slight decrease in lightness with score
    const hue = 30 - 30 * score;
    const sat = 90;
    const light = 60 - 10 * score;
    const color = `hsl(${hue} ${sat}% ${light}%)`;
    const glow = 4 + 8 * score;
    return {
      border: `2px solid ${color}`,
      boxShadow: `0 0 ${glow}px ${color}`,
      transition: 'box-shadow 120ms ease, border-color 120ms ease',
    };
  };

  // Load leagues where the user is a member
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
    const subscription = form.watch(async (values, { name }) => {
      if (name === 'league_id') {
        const leagueId = values.league_id;
        if (!leagueId) {
          setMembers([]);
          form.setValue('player2_roster_id', undefined);
          setEloPreview(null);
          return;
        }
        try {
          setLoadingMembers(true);
          const { data } = await leaguesAPI.getMembers(leagueId);
          const arr = (data.members || data) || [];
          const filtered = arr.filter((m) => m.user_id !== me?.id);
          setMembers(filtered);
          // Clear opponent if not in list
          if (filtered.findIndex((m) => m.roster_id === values.player2_roster_id) === -1) {
            form.setValue('player2_roster_id', undefined);
          }
        } catch (e) {
          console.error('Failed to load members', e);
          toast.error(t('recordMatch.failedToLoadLeagueMembers'));
        } finally {
          setLoadingMembers(false);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, me?.id, t]);

  // Debounced ELO preview when relevant fields change
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(async () => {
        const { league_id, player2_roster_id, player1_sets_won, player2_sets_won, player1_points_total, player2_points_total } = values;
        if (!league_id || !player2_roster_id || player1_sets_won == null || player2_sets_won == null) {
          setEloPreview(null);
          return;
        }
        try {
          const payload = {
            league_id,
            player2_roster_id,
            player1_sets_won,
            player2_sets_won,
            player1_points_total: Number.isFinite(+player1_points_total) ? +player1_points_total : 0,
            player2_points_total: Number.isFinite(+player2_points_total) ? +player2_points_total : 0,
          };
          const { data } = await matchesAPI.previewElo(payload);
          setEloPreview(data);
        } catch {
          // Ignore preview errors silently (e.g., opponent not selected or not a member)
          setEloPreview(null);
        }
      }, 300);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = async (values) => {
    try {
      setSubmitting(true);
      const payload = {
        league_id: values.league_id,
        player2_roster_id: values.player2_roster_id,
        player1_sets_won: values.player1_sets_won,
        player2_sets_won: values.player2_sets_won,
        player1_points_total: values.player1_points_total,
        player2_points_total: values.player2_points_total,
        game_type: values.game_type,
        ...(values.played_at ? { played_at: values.played_at } : {}),
      };
      const nonEmptySets = setScores
        .filter((s) => Number(s.p1) > 0 || Number(s.p2) > 0)
        .map((s) => ({ player1_score: Number(s.p1) || 0, player2_score: Number(s.p2) || 0 }));
      if (nonEmptySets.length > 0) {
        payload.sets = nonEmptySets;
      }
      await matchesAPI.create(payload);
      toast.success(t('recordMatch.matchRecordedSuccess'));
      navigate('/matches');
    } catch (err) {
      const msg = err.response?.data?.error || t('recordMatch.failedToRecordMatch');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-6 mx-auto w-full max-w-3xl">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{t('recordMatch.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('recordMatch.subtitle')}</p>
      </div>

      

      <Card>
        <CardHeader>
          <CardTitle>{t('recordMatch.detailsTitle')}</CardTitle>
          <CardDescription>{t('recordMatch.detailsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* League selector */}
              <FormField
                name="league_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('recordMatch.leagueLabel')}</FormLabel>
                    <FormControl>
                      <Select value={field.value?.toString()}
                              onValueChange={(v) => field.onChange(Number(v))}
                              disabled={loadingLeagues}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={loadingLeagues ? t('common.loading') : t('recordMatch.selectLeague')} />
                        </SelectTrigger>
                        <SelectContent>
                          {leagues.map((l) => (
                            <SelectItem key={l.id} value={String(l.id)}>
                              {l.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Opponent selector */}
              <FormField
                name="player2_roster_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('recordMatch.opponentLabel')}</FormLabel>
                    <FormControl>
                      <Select value={field.value?.toString()}
                              onValueChange={(v) => field.onChange(Number(v))}
                              disabled={!form.getValues('league_id') || loadingMembers}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={!form.getValues('league_id') ? t('recordMatch.selectLeagueFirst') : (loadingMembers ? t('common.loading') : t('recordMatch.selectOpponent'))} />
                        </SelectTrigger>
                        <SelectContent>
                          {members.length === 0 ? (
                            <SelectItem disabled value="0">{t('recordMatch.noMembers')}</SelectItem>
                          ) : members.map((m) => (
                            <SelectItem key={m.roster_id} value={String(m.roster_id)}>
                              {m.display_name} {typeof m.current_elo === 'number' ? `(ELO ${m.current_elo})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>{t('recordMatch.player1Note')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

                             {/* Game type */}
               <FormField
                 name="game_type"
                 control={form.control}
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>{t('matchDetail.gameType')}</FormLabel>
                     <FormControl>
                       <RadioGroup 
                         value={gameTypeValue} 
                         onValueChange={(value) => {
                           setGameTypeValue(value);
                           field.onChange(value);
                         }} 
                         className="grid gap-2 md:grid-cols-2"
                       >
                         {GAME_TYPES.map((gt) => (
                           <div key={gt.value} className="flex items-center space-x-2 rounded-md border p-3">
                             <RadioGroupItem id={gt.value} value={gt.value} />
                             <label htmlFor={gt.value} className="text-sm leading-none cursor-pointer">
                               {t(gt.labelKey)}
                             </label>
                           </div>
                         ))}
                       </RadioGroup>
                     </FormControl>
                     <FormMessage />
                   </FormItem>
                 )}
               />

              {/* Result (sets) */}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  name="player1_sets_won"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('recordMatch.yourSetsWon')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={4} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
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
                      <FormLabel>{t('recordMatch.opponentSetsWon')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={4} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Set Scores (compact inline) */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sets:</span>
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
                        aria-label={`Your points in set ${idx + 1}`}
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
                        aria-label={`Opponent points in set ${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Points totals (auto) */}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  name="player1_points_total"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your total points (auto)</FormLabel>
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
                      <FormLabel>Opponent total points (auto)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} readOnly disabled />
                      </FormControl>
                      <FormDescription>Automatically calculated from set scores.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Played at (optional) */}
              <FormField
                name="played_at"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Played at (optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormDescription>If empty, the created time will be used.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ELO preview */}
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium mb-2">ELO Preview</div>
                {!eloPreview ? (
                  <div className="text-muted-foreground">{t('recordMatch.selectLeagueOpponentSetsToPreview')}</div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <div className="text-muted-foreground">{t('recordMatch.you')}{me?.username ? ` (${me.username})` : ''}</div>
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
                      <div className="text-muted-foreground">{t('recordMatch.opponent')}</div>
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

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? t('common.submitting') : t('recordMatch.submitMatch')}
                </Button>
                <Button type="button" variant="outline" onClick={() => form.reset()} disabled={submitting}>
                  {t('common.reset')}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {(loadingLeagues || loadingMembers) && (
        <div className="py-4"><LoadingSpinner /></div>
      )}
    </div>
  );
}
