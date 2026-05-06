import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { leaguesAPI, matchesAPI } from '@/services/api';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import { getGameTypeById } from '@/constants/gameTypes';

const GAME_TYPES = [
  { value: 'best_of_1', labelKey: 'recordMatch.gameTypeBestOf1' },
  { value: 'best_of_3', labelKey: 'recordMatch.gameTypeBestOf3' },
  { value: 'best_of_5', labelKey: 'recordMatch.gameTypeBestOf5' },
  { value: 'best_of_7', labelKey: 'recordMatch.gameTypeBestOf7' },
];

const MAX_SETS_BY_TYPE = {
  best_of_1: 1,
  best_of_3: 3,
  best_of_5: 5,
  best_of_7: 7,
};

const schema = z
  .object({
    league_id: z.coerce.number().int().positive({ message: 'Select a league' }),
    player2_roster_id: z.coerce.number().int().positive({ message: 'Select an opponent' }),
    game_type: z.enum(['best_of_1', 'best_of_3', 'best_of_5', 'best_of_7']),
    player1_sets_won: z.coerce.number().int().min(0).max(4),
    player2_sets_won: z.coerce.number().int().min(0).max(4),
    player1_points_total: z.coerce.number().int().min(0),
    player2_points_total: z.coerce.number().int().min(0),
    played_at: z.string().optional().or(z.literal('')),
  })
  .refine((data) => data.player1_sets_won !== data.player2_sets_won, {
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
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
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

  useEffect(() => {
    if (!form.getValues('game_type')) {
      form.setValue('game_type', 'best_of_3', { shouldValidate: true });
    }
    setGameTypeValue(form.getValues('game_type') || 'best_of_3');
  }, [form]);

  const [setScores, setSetScores] = useState([
    { p1: 0, p2: 0 },
    { p1: 0, p2: 0 },
    { p1: 0, p2: 0 },
  ]);

  const gameType = form.watch('game_type');
  const p1SetsWon = form.watch('player1_sets_won');
  const p2SetsWon = form.watch('player2_sets_won');
  const leagueId = form.watch('league_id');
  const opponentRosterId = form.watch('player2_roster_id');

  const gameTypeMetadata = useMemo(() => getGameTypeById(gameType || 'best_of_3'), [gameType]);

  useEffect(() => {
    if (gameType && gameType !== gameTypeValue) setGameTypeValue(gameType);
  }, [gameType, gameTypeValue]);

  const maxSets = useMemo(() => MAX_SETS_BY_TYPE[gameType] ?? 3, [gameType]);
  const desiredSetCount = useMemo(() => {
    const sum = Number(p1SetsWon || 0) + Number(p2SetsWon || 0);
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

  useEffect(() => {
    const totalSets = Number(p1SetsWon || 0) + Number(p2SetsWon || 0);
    if (totalSets > maxSets) {
      form.setError('player1_sets_won', {
        type: 'manual',
        message: t('recordMatch.totalSetsExceedsMax', { max: maxSets, gameType: (gameType || '').replaceAll('_', ' ') }),
      });
    } else {
      form.clearErrors('player1_sets_won');
    }
  }, [p1SetsWon, p2SetsWon, maxSets, gameType, form, t]);

  useEffect(() => {
    const t1 = setScores.reduce((acc, s) => acc + (Number.isFinite(+s.p1) ? +s.p1 : 0), 0);
    const t2 = setScores.reduce((acc, s) => acc + (Number.isFinite(+s.p2) ? +s.p2 : 0), 0);
    form.setValue('player1_points_total', t1, { shouldDirty: true, shouldValidate: false });
    form.setValue('player2_points_total', t2, { shouldDirty: true, shouldValidate: false });
  }, [setScores, form]);

  // Load leagues where user is a member
  useEffect(() => {
    const load = async () => {
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
    load();
  }, [t]);

  // Load members when league changes
  useEffect(() => {
    const sub = form.watch(async (values, { name }) => {
      if (name === 'league_id') {
        const id = values.league_id;
        if (!id) {
          setMembers([]);
          form.setValue('player2_roster_id', undefined);
          setEloPreview(null);
          return;
        }
        try {
          setLoadingMembers(true);
          const { data } = await leaguesAPI.getMembers(id);
          const arr = data.members || data || [];
          const filtered = arr.filter((m) => m.user_id !== me?.id);
          setMembers(filtered);
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
    return () => sub.unsubscribe();
  }, [form, me?.id, t]);

  // Debounced ELO preview
  useEffect(() => {
    const sub = form.watch((values) => {
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
          setEloPreview(null);
        }
      }, 300);
    });
    return () => sub.unsubscribe();
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
      if (nonEmptySets.length > 0) payload.sets = nonEmptySets;
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

  const opponent = useMemo(
    () => members.find((m) => m.roster_id === opponentRosterId),
    [members, opponentRosterId]
  );

  const youInitials = useMemo(() => {
    const fn = me?.first_name?.[0] || '';
    const ln = me?.last_name?.[0] || '';
    return (fn + ln).toUpperCase() || me?.username?.[0]?.toUpperCase() || 'YO';
  }, [me]);

  const oppInitials = useMemo(() => {
    if (!opponent) return '?';
    const dn = opponent.display_name || opponent.username || '?';
    const parts = dn.split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  }, [opponent]);

  const youSetsCount = Number(p1SetsWon || 0);
  const oppSetsCount = Number(p2SetsWon || 0);
  const youAreWinning = youSetsCount > oppSetsCount;
  const showConfetti = youAreWinning && setScores.some((s) => s.p1 > 0 || s.p2 > 0);

  return (
    <div className="max-w-[760px] mx-auto px-6 md:px-12 py-10 md:py-14">
      <div className="font-mono text-[12px] text-[var(--fg-3)] mb-3.5">
        <Link to="/app/dashboard" className="hover:text-[var(--fg)]">
          {t('nav.dashboard')}
        </Link>{' '}
        / <span style={{ color: 'var(--fg)' }}>{t('recordMatch.title')}</span>
      </div>

      <h1
        className="display"
        style={{
          fontSize: 'clamp(32px, 4.4vw, 44px)',
          letterSpacing: '-0.03em',
          marginBottom: 8,
        }}
      >
        {t('recordMatch.title')}.
      </h1>
      <p className="text-[15px] text-[var(--fg-3)] mb-9">{t('recordMatch.subtitle')}</p>

      {/* Step indicator */}
      <div
        className="flex gap-0 mb-9 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--line-soft)' }}
      >
        {[
          { n: '01', key: 'recordMatch.stepPlayers', active: true },
          { n: '02', key: 'recordMatch.stepScore', active: leagueId && opponentRosterId },
          { n: '03', key: 'recordMatch.stepConfirm', active: false },
        ].map((s) => (
          <div
            key={s.n}
            className="px-0 mr-7 pb-3.5 font-mono text-[13px] cursor-default relative shrink-0"
            style={{ color: s.active ? 'var(--fg)' : 'var(--fg-3)' }}
          >
            <span className="text-[var(--accent)] mr-2">{s.n}</span>
            {t(s.key)}
            {s.active && (
              <span
                className="absolute left-0 right-0 -bottom-px h-px"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </div>
        ))}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7">
          {/* League selector */}
          <FormField
            name="league_id"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="tt-field-label">{t('recordMatch.leagueLabel')}</FormLabel>
                <FormControl>
                  <Select
                    value={field.value?.toString()}
                    onValueChange={(v) => field.onChange(Number(v))}
                    disabled={loadingLeagues}
                  >
                    <SelectTrigger className="tt-field-input">
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

          {/* VS BUILDER */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-stretch">
            {/* You */}
            <div
              className="p-6 flex flex-col gap-3.5"
              style={{
                background: 'oklch(0.70 0.20 38 / 0.05)',
                border: '1.5px solid var(--accent)',
                borderRadius: 'var(--r-xl)',
                minHeight: 200,
              }}
            >
              <div className="eyebrow">{t('recordMatch.you')}</div>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-semibold"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
              >
                {youInitials}
              </div>
              <div
                className="text-[18px] font-semibold tracking-tight"
                style={{ fontFamily: '"Inter Tight", sans-serif' }}
              >
                {me?.first_name && me?.last_name ? `${me.first_name} ${me.last_name}` : me?.username || t('recordMatch.you')}
              </div>
              <div className="font-mono text-[13px] text-[var(--fg-3)]">@{me?.username}</div>
            </div>

            <div className="hidden md:flex items-center justify-center">
              <span
                className="display"
                style={{
                  fontStyle: 'italic',
                  fontSize: 36,
                  color: 'var(--accent)',
                  fontWeight: 500,
                }}
              >
                {t('common.vs')}
              </span>
            </div>
            <div className="md:hidden flex items-center justify-center">
              <span
                className="display"
                style={{
                  fontStyle: 'italic',
                  fontSize: 24,
                  color: 'var(--accent)',
                  transform: 'rotate(90deg)',
                }}
              >
                {t('common.vs')}
              </span>
            </div>

            {/* Opponent */}
            <div className="tt-card p-6 flex flex-col gap-3.5" style={{ minHeight: 200, borderRadius: 'var(--r-xl)' }}>
              <div className="eyebrow">{t('recordMatch.opponent')}</div>
              <FormField
                name="player2_roster_id"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="flex-1 flex flex-col">
                    <FormControl>
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(v) => field.onChange(Number(v))}
                        disabled={!leagueId || loadingMembers}
                      >
                        <SelectTrigger className="tt-field-input">
                          <SelectValue
                            placeholder={
                              !leagueId
                                ? t('recordMatch.selectLeagueFirst')
                                : loadingMembers
                                ? t('common.loading')
                                : t('recordMatch.selectOpponent')
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {members.length === 0 ? (
                            <SelectItem disabled value="0">
                              {t('recordMatch.noMembers')}
                            </SelectItem>
                          ) : (
                            members.map((m) => (
                              <SelectItem key={m.roster_id} value={String(m.roster_id)}>
                                {m.display_name} {typeof m.current_elo === 'number' ? `(ELO ${m.current_elo})` : ''}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    {opponent && (
                      <div className="mt-3.5 flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-semibold"
                          style={{ background: 'var(--bg-3)', color: 'var(--fg)' }}
                        >
                          {oppInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold truncate">
                            {opponent.display_name || opponent.username}
                          </div>
                          {typeof opponent.current_elo === 'number' && (
                            <div className="font-mono text-[13px] text-[var(--fg-3)]">ELO {opponent.current_elo}</div>
                          )}
                        </div>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Game type */}
          <FormField
            name="game_type"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="tt-field-label">{t('matchDetail.gameType')}</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={gameTypeValue}
                    onValueChange={(value) => {
                      setGameTypeValue(value);
                      field.onChange(value);
                    }}
                    className="grid grid-cols-2 gap-2.5"
                  >
                    {GAME_TYPES.map((gt) => (
                      <label
                        key={gt.value}
                        htmlFor={gt.value}
                        className="flex items-center gap-3 p-3 cursor-pointer border-[1.5px] rounded-md hover:border-[var(--fg-2)] transition-colors"
                        style={{
                          borderColor: gameTypeValue === gt.value ? 'var(--accent)' : 'var(--line-soft)',
                          background: gameTypeValue === gt.value ? 'oklch(0.70 0.20 38 / 0.05)' : 'transparent',
                        }}
                      >
                        <RadioGroupItem id={gt.value} value={gt.value} />
                        <span className="text-sm">{t(gt.labelKey)}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Sets won row */}
          <div className="flex justify-between items-baseline">
            <div className="eyebrow dotted">{t('recordMatch.setScoresLabel')}</div>
            <div className="font-mono text-[13px] text-[var(--fg-2)]">
              {t('recordMatch.you')} {youSetsCount} — {oppSetsCount}{' '}
              {opponent?.display_name?.split(' ')[0] || opponent?.username || t('recordMatch.opponent')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              name="player1_sets_won"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="tt-field-label">{t('recordMatch.yourSetsWon')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={gameTypeMetadata.setsToWin}
                      className="tt-field-input"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
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
                  <FormLabel className="tt-field-label">{t('recordMatch.opponentSetsWon')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={gameTypeMetadata.setsToWin}
                      className="tt-field-input"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Per-set scores */}
          {setScores.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {setScores.map((s, idx) => (
                <div
                  key={idx}
                  className="tt-card p-5 flex flex-col gap-2.5"
                  style={{ borderRadius: 'var(--r-xl)' }}
                >
                  <div className="eyebrow">
                    {t('recordMatch.set')} {idx + 1}
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={0}
                      value={s.p1}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setSetScores((arr) =>
                          arr.map((it, i) => (i === idx ? { ...it, p1: Number.isFinite(v) ? v : 0 } : it))
                        );
                      }}
                      className="text-center display-num"
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                        fontSize: 30,
                        padding: '10px 0',
                      }}
                      aria-label={`Your points in set ${idx + 1}`}
                    />
                    <span className="text-[var(--fg-3)] text-lg">–</span>
                    <Input
                      type="number"
                      min={0}
                      value={s.p2}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setSetScores((arr) =>
                          arr.map((it, i) => (i === idx ? { ...it, p2: Number.isFinite(v) ? v : 0 } : it))
                        );
                      }}
                      className="text-center display-num"
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                        fontSize: 30,
                        padding: '10px 0',
                      }}
                      aria-label={`Opponent points in set ${idx + 1}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Live ELO preview */}
          <div
            className="relative p-6"
            style={{
              background: 'oklch(0.70 0.20 38 / 0.05)',
              border: '1.5px solid oklch(0.70 0.20 38 / 0.3)',
              borderRadius: 'var(--r-xl)',
            }}
          >
            {showConfetti &&
              Array.from({ length: 14 }).map((_, i) => {
                const colors = ['var(--p-orange)', 'var(--p-cyan)', 'var(--p-lime)', 'var(--p-magenta)', 'var(--p-amber)'];
                return (
                  <span
                    key={i}
                    className="tt-confetti"
                    style={{
                      left: `${5 + i * 7}%`,
                      top: 4,
                      background: colors[i % colors.length],
                      animationDelay: `${i * 0.07}s`,
                      transform: `rotate(${i * 30}deg)`,
                    }}
                  />
                );
              })}
            <div className="eyebrow mb-3">{t('recordMatch.eloPreview')}</div>
            {!eloPreview ? (
              <p className="text-[13px] text-[var(--fg-3)]">{t('recordMatch.selectLeagueOpponentSetsToPreview')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-5 items-center">
                <div>
                  <div className="text-[15px] font-semibold">{t('recordMatch.you')}</div>
                  <div className="font-mono text-[13px] text-[var(--fg-3)]">
                    {eloPreview.current_elos?.player1} → <span className="text-[var(--fg)]">{eloPreview.new_elos?.player1}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className="display-num"
                    style={{
                      fontSize: 26,
                      color:
                        (eloPreview.changes?.player1 ?? 0) > 0
                          ? 'var(--good)'
                          : (eloPreview.changes?.player1 ?? 0) < 0
                          ? 'var(--bad)'
                          : 'var(--fg-3)',
                    }}
                  >
                    {eloPreview.changes?.player1 >= 0 ? '+' : ''}
                    {eloPreview.changes?.player1}
                  </div>
                </div>
                <div className="md:text-right">
                  <div className="text-[15px] font-semibold">
                    {opponent?.display_name?.split(' ')[0] || t('recordMatch.opponent')}
                  </div>
                  <div className="font-mono text-[13px] text-[var(--fg-3)]">
                    {eloPreview.current_elos?.player2} → <span className="text-[var(--fg)]">{eloPreview.new_elos?.player2}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Played at (optional) */}
          <FormField
            name="played_at"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="tt-field-label">{t('recordMatch.playedAt')}</FormLabel>
                <FormControl>
                  <Input type="datetime-local" className="tt-field-input" {...field} />
                </FormControl>
                <FormDescription>{t('recordMatch.playedAtHelp')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-wrap gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/app/dashboard')}
              className="rounded-full px-6"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-2)] font-bold rounded-full px-7 py-5 text-[15px] tt-btn-primary"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  {t('common.submitting')}
                </>
              ) : (
                t('recordMatch.submitMatch')
              )}
            </Button>
          </div>
        </form>
      </Form>

      {(loadingLeagues || loadingMembers) && (
        <div className="py-4">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
}
