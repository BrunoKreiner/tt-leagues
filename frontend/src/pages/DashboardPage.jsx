import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight, Plus } from 'lucide-react';
import EloSparkline from '@/components/EloSparkline';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI, matchesAPI, usersAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [_loadError, setLoadError] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const [matchesError, setMatchesError] = useState(null);
  const [userLeagues, setUserLeagues] = useState([]);
  const [leaguesError, setLeaguesError] = useState(null);
  const [leagueLeaderboards, setLeagueLeaderboards] = useState({});
  const [leaderboardStatus, setLeaderboardStatus] = useState({});
  const [shouldLoadLeaderboards, setShouldLoadLeaderboards] = useState(false);
  const leaderboardSectionRef = useRef(null);

  const leaderboardLeagues = userLeagues;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        setMatchesError(null);
        setLeaguesError(null);
        const [matchesRes, leaguesRes, statsRes] = await Promise.allSettled([
          matchesAPI.getAll({ limit: 5, status: 'accepted' }, { ttlMs: 10000 }),
          leaguesAPI.getAll({ limit: 10 }, { ttlMs: 10000 }),
          user?.id ? usersAPI.getStats(user.id, { ttlMs: 15000 }) : Promise.reject(new Error('no user id')),
        ]);

        if (statsRes.status === 'fulfilled') {
          const sd = statsRes.value.data;
          const normalized = sd?.overall
            ? {
                ...sd,
                avg_elo: sd.overall.average_elo,
                win_rate: sd.overall.win_rate,
                leagues_count: sd.overall.leagues_count,
                matches_played: sd.overall.matches_played,
                wins: sd.overall.wins,
                losses: sd.overall.losses,
                current_streak: sd.overall.current_streak,
                peak_elo: sd.overall.peak_elo,
              }
            : sd;
          setStats(normalized);
        }

        if (matchesRes.status === 'fulfilled') {
          const m = matchesRes.value.data?.matches;
          setRecentMatches(Array.isArray(m) ? m : []);
        } else {
          const apiMessage = matchesRes.reason?.response?.data?.error;
          setMatchesError(typeof apiMessage === 'string' ? apiMessage : 'Failed to load matches');
        }

        if (leaguesRes.status === 'fulfilled') {
          const ld = leaguesRes.value.data?.leagues;
          const leagues = Array.isArray(ld) ? ld.filter((l) => !!l.is_member) : [];
          setUserLeagues(leagues);
          if (leagues.length === 0) {
            setLeagueLeaderboards({});
            setLeaderboardStatus({});
          }
        } else {
          const apiMessage = leaguesRes.reason?.response?.data?.error;
          setLeaguesError(typeof apiMessage === 'string' ? apiMessage : 'Failed to load leagues');
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        const apiMessage = err?.response?.data?.error;
        setLoadError(typeof apiMessage === 'string' ? apiMessage : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    const node = leaderboardSectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoadLeaderboards(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    if (!shouldLoadLeaderboards) return;
    if (leaderboardLeagues.length === 0) {
      setLeagueLeaderboards({});
      setLeaderboardStatus({});
      return;
    }

    const load = async () => {
      const loadingState = {};
      leaderboardLeagues.forEach((l) => {
        loadingState[l.id] = { status: 'loading' };
      });
      setLeaderboardStatus((p) => ({ ...p, ...loadingState }));

      const results = await Promise.allSettled(
        leaderboardLeagues.map((l) =>
          leaguesAPI.getLeaderboard(l.id, { page: 1, limit: 5, include_badges: false }, { ttlMs: 10000 })
        )
      );
      const map = {};
      const status = {};
      results.forEach((r, i) => {
        const id = leaderboardLeagues[i]?.id;
        if (!id) return;
        if (r.status === 'fulfilled') {
          const data = r.value.data?.leaderboard;
          map[id] = Array.isArray(data) ? data : [];
          status[id] = { status: 'loaded' };
        } else {
          status[id] = { status: 'error' };
        }
      });
      setLeagueLeaderboards((p) => ({ ...p, ...map }));
      setLeaderboardStatus((p) => ({ ...p, ...status }));
    };
    load();
  }, [leaderboardLeagues, shouldLoadLeaderboards]);

  // Pick the league with the user's highest ELO as the "primary" surface for the hero card
  const primaryLeague = useMemo(() => {
    if (!userLeagues || userLeagues.length === 0) return null;
    const ranked = [...userLeagues].sort((a, b) => {
      const ae = a.user_current_elo ?? a.user_elo ?? 0;
      const be = b.user_current_elo ?? b.user_elo ?? 0;
      return be - ae;
    });
    return ranked[0];
  }, [userLeagues]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 5) return t('dashboard.greet.lateNight');
    if (h < 12) return t('dashboard.greet.morning');
    if (h < 18) return t('dashboard.greet.afternoon');
    return t('dashboard.greet.evening');
  })();

  return (
    <div className="tt-container py-7 md:py-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <div className="font-mono text-[12px] text-[var(--fg-3)] tracking-[0.06em] uppercase">
            {format(new Date(), 'EEEE · MMM d')}
          </div>
          <h1
            className="tt-pop-in text-[28px] md:text-[30px] font-bold tracking-tight leading-[1.05] mt-1.5"
            style={{ fontFamily: '"Inter Tight", sans-serif' }}
          >
            {greet},{' '}
            <em
              className="not-italic"
              style={{ fontStyle: 'italic', color: 'var(--accent)', fontWeight: 500 }}
            >
              {user?.first_name || user?.username || 'player'}
            </em>
            .
          </h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button asChild variant="outline" className="rounded-full border-[1.5px]" style={{ borderColor: 'var(--line)' }}>
            <Link to="/app/leagues">{t('dashboard.myLeagues')}</Link>
          </Button>
          <Button
            asChild
            className="bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-2)] font-bold rounded-full"
          >
            <Link to="/app/quick-match" className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> {t('cta.recordMatch')}
            </Link>
          </Button>
        </div>
      </div>

      {/* HERO + SUMMARY GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-[18px]">
        {/* ELO HERO */}
        <div className="tt-panel relative overflow-hidden p-5 sm:p-6 md:p-7" style={{ borderRadius: 'var(--r-xl)' }}>
          <div
            aria-hidden
            className="absolute -top-16 -right-16 w-[200px] h-[200px] rounded-full pointer-events-none"
            style={{ background: 'oklch(0.70 0.20 38 / 0.06)' }}
          />
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 relative">
            <div className="min-w-0">
              <div className="font-mono text-[11px] text-[var(--fg-3)] tracking-[0.1em] uppercase">
                {primaryLeague
                  ? `${t('dashboard.heroEyebrow')} · ${primaryLeague.name}`
                  : t('dashboard.heroEyebrowNoLeague')}
              </div>
              <div
                className="font-bold tabular-nums leading-none mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1"
                style={{
                  fontFamily: '"Inter Tight", sans-serif',
                  fontSize: 'clamp(44px, 8vw, 88px)',
                  letterSpacing: '-0.055em',
                  color: 'var(--fg)',
                }}
              >
                <span>
                  {primaryLeague?.user_current_elo ?? primaryLeague?.user_elo ?? stats?.avg_elo ?? '—'}
                </span>
                {typeof stats?.peak_elo === 'number' && (
                  <span
                    className="font-mono px-1.5 py-0.5 rounded-full"
                    style={{
                      fontSize: 'clamp(13px, 1.6vw, 18px)',
                      color: 'var(--good)',
                      background: 'oklch(0.78 0.16 145 / 0.15)',
                      letterSpacing: 0,
                      fontWeight: 600,
                    }}
                  >
                    peak {stats.peak_elo}
                  </span>
                )}
              </div>
              <div className="text-[12.5px] text-[var(--fg-3)] mt-2">
                {primaryLeague ? (
                  <>
                    {t('dashboard.rankIn', { count: primaryLeague.member_count || 0 })}
                  </>
                ) : (
                  t('dashboard.joinLeagueToTrack')
                )}
              </div>
            </div>
            {primaryLeague && user?.id && (
              <div className="sm:text-right sm:shrink-0">
                <EloSparkline userId={user.id} leagueId={primaryLeague.id} width={120} height={36} points={12} />
                <div className="font-mono text-[10px] text-[var(--fg-3)] mt-1.5 tracking-[0.1em] uppercase">
                  {t('dashboard.recentTrend')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SUMMARY CARD */}
        <div
          className="overflow-hidden border-[1.5px]"
          style={{
            background: 'var(--bg-2)',
            borderColor: 'var(--line-soft)',
            borderRadius: 'var(--r-xl)',
          }}
        >
          {[
            {
              k: t('dashboard.summary.winRate'),
              v: stats?.win_rate != null ? `${Math.round(stats.win_rate)}` : '—',
              suf: '%',
            },
            {
              k: t('dashboard.summary.matches'),
              v: stats?.matches_played ?? 0,
              suf: t('dashboard.summary.played'),
            },
            {
              k: t('dashboard.summary.streak'),
              v: stats?.current_streak ?? 0,
              suf: t('dashboard.summary.games'),
            },
            {
              k: t('dashboard.summary.leagues'),
              v: stats?.leagues_count ?? userLeagues.length,
              suf: t('dashboard.summary.joined'),
            },
          ].map((row, i) => (
            <div
              key={i}
              className="px-5 py-3.5 grid grid-cols-[1fr_auto_minmax(5.5rem,auto)] gap-x-3 items-baseline border-b last:border-b-0"
              style={{ borderColor: 'var(--line-soft)' }}
            >
              <span className="font-mono text-[11px] text-[var(--fg-3)] tracking-[0.08em] uppercase">{row.k}</span>
              <span
                className="font-bold tabular-nums text-right"
                style={{
                  fontFamily: '"Inter Tight", sans-serif',
                  fontSize: 24,
                  letterSpacing: '-0.035em',
                }}
              >
                {row.v}
              </span>
              <small className="font-normal font-mono text-[11px] text-[var(--fg-3)] text-left">{row.suf}</small>
            </div>
          ))}
        </div>
      </div>

      {/* SECONDARY GRID — leagues + matches + rivalries */}
      <div ref={leaderboardSectionRef} className="grid grid-cols-1 lg:grid-cols-3 gap-[18px] mt-[18px]">
        {/* MY LEAGUES */}
        <section className="tt-panel">
          <div className="panel-title">
            <h3>{t('dashboard.yourLeagues')}</h3>
            <Link to="/app/leagues" className="eyebrow text-[var(--accent)] hover:opacity-80">
              {t('dashboard.viewAll')} →
            </Link>
          </div>
          {leaguesError ? (
            <p className="text-sm text-[var(--bad)] py-4">{leaguesError}</p>
          ) : userLeagues.length === 0 ? (
            <div className="ph py-6">
              <span>{t('dashboard.noLeagues')}</span>
            </div>
          ) : (
            <div>
              {userLeagues.slice(0, 5).map((l) => (
                <button
                  key={l.id}
                  onClick={() => navigate(`/app/leagues/${l.id}`)}
                  className="w-full grid items-center gap-3 py-2.5 border-b last:border-b-0 cursor-pointer hover:bg-[var(--bg-3)]/40 transition-colors text-left rounded-md hover:px-2.5"
                  style={{
                    gridTemplateColumns: '32px 1fr auto auto',
                    borderColor: 'var(--line-soft)',
                  }}
                >
                  <div
                    className={`av-chip av-c${(l.id % 5) + 1} w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-semibold`}
                  >
                    {(l.name || '??').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-[13.5px] truncate">{l.name}</div>
                    <div className="font-mono text-[11px] text-[var(--fg-3)]">
                      {l.member_count || 0} {t('leagues.members')}
                      {l.season && ` · ${l.season}`}
                    </div>
                  </div>
                  <div
                    className="font-bold tabular-nums"
                    style={{
                      fontFamily: '"Inter Tight", sans-serif',
                      fontSize: 17,
                      letterSpacing: '-0.03em',
                      color: l.user_rank === 1 ? 'var(--accent)' : 'var(--fg)',
                    }}
                  >
                    {l.user_rank ? `#${l.user_rank}` : '—'}
                  </div>
                  <div className="font-mono text-[13px] text-[var(--fg-3)] text-right">
                    {l.user_current_elo ?? l.user_elo ?? '—'}
                    <div className="font-mono text-[10px] text-[var(--fg-4)]">ELO</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* RECENT MATCHES */}
        <section className="tt-panel">
          <div className="panel-title">
            <h3>{t('dashboard.recentMatches')}</h3>
            <Link to="/app/matches" className="eyebrow text-[var(--accent)] hover:opacity-80 inline-flex items-center gap-1">
              {t('dashboard.viewAll')} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {matchesError ? (
            <p className="text-sm text-[var(--bad)] py-4">{matchesError}</p>
          ) : recentMatches.length === 0 ? (
            <div className="ph py-6">
              <span>{t('dashboard.noMatches')}</span>
            </div>
          ) : (
            <div>
              {recentMatches.slice(0, 5).map((m) => {
                const youAreP1 = m.player1_user_id === user?.id;
                const youSets = youAreP1 ? m.player1_sets_won : m.player2_sets_won;
                const oppSets = youAreP1 ? m.player2_sets_won : m.player1_sets_won;
                const oppName = youAreP1
                  ? m.player2_display_name || m.player2_username || 'Opponent'
                  : m.player1_display_name || m.player1_username || 'Opponent';
                const win = youSets > oppSets;
                const eloBefore = youAreP1 ? m.player1_elo_before : m.player2_elo_before;
                const eloAfter = youAreP1 ? m.player1_elo_after : m.player2_elo_after;
                const delta =
                  m.elo_applied && eloAfter != null && eloBefore != null ? eloAfter - eloBefore : null;
                return (
                  <Link
                    key={m.id}
                    to={`/app/matches/${m.id}`}
                    className="grid items-center gap-3 py-2.5 border-b last:border-b-0 hover:opacity-90"
                    style={{ gridTemplateColumns: 'auto 1fr auto', borderColor: 'var(--line-soft)' }}
                  >
                    <div className={`match-result ${win ? 'win' : 'loss'}`}>{win ? 'W' : 'L'}</div>
                    <div>
                      <div className="text-[13px]">
                        <span className="font-semibold">vs {oppName}</span>
                      </div>
                      <div className="font-mono text-[11px] text-[var(--fg-3)] mt-0.5">
                        {youSets}–{oppSets} · {m.league_name || ''}
                      </div>
                    </div>
                    <div className="text-right">
                      {delta != null ? (
                        <div
                          className="font-mono text-[12.5px]"
                          style={{ color: delta > 0 ? 'var(--good)' : 'var(--bad)' }}
                        >
                          {delta > 0 ? '+' : ''}
                          {delta} ELO
                        </div>
                      ) : (
                        <div className="font-mono text-[11px] text-[var(--fg-3)]">{t('elo.deferred')}</div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* LEAGUE LEADERBOARDS PEEK */}
        <section className="tt-panel">
          <div className="panel-title">
            <h3>{t('dashboard.leaderboardsPeek')}</h3>
            <Link to="/app/leagues" className="eyebrow text-[var(--accent)] hover:opacity-80">
              {t('dashboard.browseAll')} →
            </Link>
          </div>
          {leaderboardLeagues.length === 0 ? (
            <div className="ph py-6">
              <span>{t('dashboard.noLeagues')}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {leaderboardLeagues.slice(0, 2).map((l) => {
                const status = leaderboardStatus[l.id]?.status;
                const resolvedStatus = typeof status === 'string' ? status : shouldLoadLeaderboards ? 'loading' : 'idle';
                const data = Array.isArray(leagueLeaderboards[l.id]) ? leagueLeaderboards[l.id] : [];
                return (
                  <div key={l.id} className="">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Trophy className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                        <Link
                          to={`/app/leagues/${l.id}`}
                          className="text-[13px] font-medium truncate hover:text-[var(--accent)] transition-colors"
                        >
                          {l.name}
                        </Link>
                      </div>
                    </div>
                    {resolvedStatus === 'loading' || resolvedStatus === 'idle' ? (
                      <div className="flex items-center justify-center py-3">
                        <LoadingSpinner size="sm" />
                      </div>
                    ) : data.length === 0 ? (
                      <p className="text-[12px] text-[var(--fg-3)] py-2">{t('leagues.noPlayers')}</p>
                    ) : (
                      <div className="space-y-1">
                        {data.slice(0, 5).map((p) => (
                          <div
                            key={p.roster_id || p.user_id}
                            className="grid items-center gap-2.5 py-1"
                            style={{ gridTemplateColumns: '24px 1fr auto' }}
                          >
                            <span
                              className="font-sans font-bold text-[13px] tabular-nums"
                              style={{ color: p.rank === 1 ? 'var(--accent)' : 'var(--fg-2)' }}
                            >
                              {p.rank}.
                            </span>
                            <span className="text-[13px] truncate">{p.display_name || p.username || 'Player'}</span>
                            <span className="font-mono text-[12px] text-[var(--fg-2)] tabular-nums">{p.current_elo}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
