import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI, statsAPI } from '../services/api';
import EloSparkline from '@/components/EloSparkline';
import Sparkline from '@/components/Sparkline';
import SpinningBall from '@/components/SpinningBall';
import EloMarquee from '@/components/EloMarquee';
import { BrandMark } from '@/components/layout/Brand';
import PublicHeader from '@/components/layout/PublicHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { useTranslation } from 'react-i18next';

// Decorative ELO history for the features section sparkline
const PREVIEW_ELO_HISTORY = [
  1620, 1635, 1612, 1648, 1668, 1654, 1672, 1690, 1705, 1688,
  1701, 1722, 1735, 1718, 1741, 1758, 1742, 1730, 1747, 1748,
];

// Seedable PRNG for stable per-entry sparklines
const seededRand = (seed) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};
const buildTrend = (seed, direction = 1) => {
  const rand = seededRand(seed);
  const n = 8;
  const arr = [];
  let v = 1500 + Math.floor(rand() * 200);
  arr.push(v);
  for (let i = 1; i < n; i++) {
    const drift = direction * (4 + Math.floor(rand() * 6));
    const noise = (rand() - 0.5) * 16;
    v = Math.round(v + drift + noise);
    arr.push(v);
  }
  return arr;
};

// Compact number format (1234 → "1.2k", 31000 → "31k")
const compact = (n) => {
  if (n == null || Number.isNaN(n)) return '—';
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1000000) return Math.round(n / 1000) + 'k';
  return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
};

// Mocked live-match ticker entries — each gets its own little sparkline.
const TICKER_ENTRIES = [
  { winner: 'Nicolas', loser: 'Xavier', score: '3–1', delta: 18, league: 'TTC Baden-Wettingen', trend: buildTrend(11, 1) },
  { winner: 'Lina', loser: 'Emil', score: '3–0', delta: 12, league: 'Friday Night Office', trend: buildTrend(22, 1) },
  { winner: 'Alessandro', loser: 'Mathias', score: '3–2', delta: 9, league: 'Zürich Open', trend: buildTrend(33, 1) },
  { winner: 'Yuyue', loser: 'Priya', score: '3–1', delta: 11, league: 'TTC Baden-Wettingen', trend: buildTrend(44, -1) },
  { winner: 'Shri', loser: 'Giovanni', score: '3–2', delta: 14, league: 'Friday Night Office', trend: buildTrend(55, 1) },
];

const LandingPage = () => {
  const { t } = useTranslation();
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [leagueLeaderboards, setLeagueLeaderboards] = useState({});
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState(null);
  const [leaderboardStatus, setLeaderboardStatus] = useState({});
  const [shouldLoadLeaderboards, setShouldLoadLeaderboards] = useState(false);
  const [platformStats, setPlatformStats] = useState(null);
  const leaderboardSectionRef = useRef(null);

  // Hash-scroll: when arriving at /#how or /#public from another page, scroll there.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const id = window.location.hash.slice(1);
      // Defer one frame so the target sections have rendered
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  const featuredLeagues = useMemo(() => publicLeagues.slice(0, 1), [publicLeagues]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await leaguesAPI.getAll({ limit: 4 }, { ttlMs: 15000 });
        const data = response.data?.leagues;
        const leagues = Array.isArray(data) ? data.filter((l) => l.is_public) : [];
        setPublicLeagues(leagues);
      } catch (err) {
        console.error('Failed to fetch public leagues:', err);
        setError('Failed to fetch public leagues');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  useEffect(() => {
    statsAPI
      .getPublic({ ttlMs: 60000 })
      .then((res) => setPlatformStats(res.data))
      .catch((err) => {
        console.error('Failed to load platform stats:', err);
        setPlatformStats(null);
      });
  }, []);

  useEffect(() => {
    if (!shouldLoadLeaderboards) return;
    if (featuredLeagues.length === 0) return;
    const load = async () => {
      const loadingState = {};
      featuredLeagues.forEach((l) => {
        loadingState[l.id] = { status: 'loading' };
      });
      setLeaderboardStatus((p) => ({ ...p, ...loadingState }));
      const results = await Promise.allSettled(
        featuredLeagues.map((l) =>
          leaguesAPI.getLeaderboard(l.id, { limit: 5, include_badges: false }, { ttlMs: 10000 })
        )
      );
      const next = {};
      const status = {};
      results.forEach((r, i) => {
        const id = featuredLeagues[i]?.id;
        if (!id) return;
        if (r.status === 'fulfilled') {
          const lb = r.value.data?.leaderboard;
          next[id] = Array.isArray(lb) ? lb : [];
          status[id] = { status: 'loaded' };
        } else {
          status[id] = { status: 'error' };
        }
      });
      setLeagueLeaderboards((p) => ({ ...p, ...next }));
      setLeaderboardStatus((p) => ({ ...p, ...status }));
    };
    load();
  }, [featuredLeagues, shouldLoadLeaderboards]);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* HERO — fills viewport (minus nav) so the ticker sits right at the fold */}
        <section
          className="relative isolate overflow-hidden flex items-center"
          style={{
            minHeight: 'calc(100vh - 64px)',
            paddingTop: 'clamp(24px, 4vh, 56px)',
            paddingBottom: 'clamp(24px, 4vh, 56px)',
          }}
        >
          <div className="relative z-10 tt-container w-full">
            <div className="grid gap-10 lg:gap-16 items-end" style={{ gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)' }}>
              <div>
                <div className="relative z-[2] flex items-center gap-4">
                  <span className="inline-flex items-center justify-center text-white shrink-0">
                    <BrandMark size={72} />
                  </span>
                  <h1
                    className="font-sans font-bold leading-[0.95]"
                    style={{
                      fontSize: 'clamp(40px, 5.2vw, 76px)',
                      letterSpacing: '-0.04em',
                      color: '#ffffff',
                    }}
                  >
                    leagues<span style={{ color: 'var(--accent)' }}>.lol</span>
                  </h1>
                </div>
                <p
                  className="display mt-7 mb-9 leading-[1.15]"
                  style={{
                    fontSize: 'clamp(24px, 3.2vw, 38px)',
                    letterSpacing: '-0.02em',
                    fontStyle: 'italic',
                    fontWeight: 400,
                    color: 'var(--fg-2)',
                    maxWidth: 560,
                  }}
                >
                  {t('landing.hero.ledeBefore')}{' '}
                  <RotatingWord words={t('landing.hero.ledeWords', { returnObjects: true }) || []} />{' '}
                  {t('landing.hero.ledeAfter')}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    asChild
                    className="bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-2)] font-bold rounded-full px-7 py-6 text-[15px] tt-btn-primary"
                  >
                    <Link to="/register">{t('landing.hero.ctaPrimary')}</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full px-6 py-6 text-[15px] border-[1.5px]"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <a
                      onClick={() => document.getElementById('public')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="cursor-pointer"
                    >
                      {t('landing.hero.ctaSecondary')}
                    </a>
                  </Button>
                </div>
              </div>

              <div className="relative flex flex-col gap-3.5">
                {/* Blob sits behind the ball so it tracks the column instead of the viewport */}
                <div
                  aria-hidden="true"
                  className="hero-blob"
                  style={{
                    left: '50%',
                    top: '40%',
                    width: 520,
                    height: 520,
                    zIndex: 0,
                  }}
                />
                <div className="relative z-[1]">
                  <SpinningBall />
                </div>

                {/* Platform live counters — 3 compact cards directly under the ball */}
                <div className="relative z-[1] grid grid-cols-3 gap-2.5 mt-5">
                  <div
                    className="tt-card relative overflow-hidden p-3.5"
                    style={{
                      borderRadius: 'var(--r-md)',
                      borderColor: 'oklch(0.70 0.20 38 / 0.35)',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{
                        background: 'var(--accent)',
                        borderRadius: 'var(--r-md) var(--r-md) 0 0',
                      }}
                    />
                    <div className="eyebrow" style={{ fontSize: 9.5 }}>
                      {t('landing.stats.activePlayers')}
                    </div>
                    <div
                      className="num mt-1.5"
                      style={{
                        fontSize: 'clamp(22px, 2.4vw, 30px)',
                        color: 'var(--accent)',
                        lineHeight: 1,
                      }}
                    >
                      {compact(platformStats?.active_players)}
                    </div>
                    <div className="text-[11px] text-[var(--fg-3)] mt-1.5 leading-tight">
                      {t('landing.stats.activePlayersSubShort')}
                    </div>
                  </div>

                  <div className="tt-card p-3.5" style={{ borderRadius: 'var(--r-md)' }}>
                    <div className="eyebrow" style={{ fontSize: 9.5 }}>
                      {t('landing.stats.leagues')}
                    </div>
                    <div
                      className="num mt-1.5"
                      style={{
                        fontSize: 'clamp(22px, 2.4vw, 30px)',
                        color: 'var(--fg)',
                        lineHeight: 1,
                      }}
                    >
                      {compact(platformStats?.leagues)}
                    </div>
                    <div className="text-[11px] text-[var(--fg-3)] mt-1.5 leading-tight">
                      {t('landing.stats.leaguesSub')}
                    </div>
                  </div>

                  <div className="tt-card p-3.5" style={{ borderRadius: 'var(--r-md)' }}>
                    <div className="eyebrow" style={{ fontSize: 9.5 }}>
                      {t('landing.stats.matchesLogged')}
                    </div>
                    <div
                      className="num mt-1.5"
                      style={{
                        fontSize: 'clamp(22px, 2.4vw, 30px)',
                        color: 'var(--fg)',
                        lineHeight: 1,
                      }}
                    >
                      {compact(platformStats?.matches)}
                    </div>
                    <div className="text-[11px] text-[var(--fg-3)] mt-1.5 leading-tight">
                      {t('landing.stats.matchesLoggedSub')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TICKER */}
        <div className="tt-ticker">
          <div className="tt-ticker-track">
            {[0, 1].map((k) => (
              <span key={k} className="contents">
                {TICKER_ENTRIES.map((e, i) => {
                  const palette = [
                    'var(--p-orange)',
                    'var(--p-cyan)',
                    'var(--p-magenta)',
                    'var(--p-lime)',
                    'var(--p-amber)',
                  ];
                  return (
                    <span
                      key={`${k}-${i}`}
                      className="inline-flex items-center gap-2.5 align-middle"
                      style={{ fontFamily: '"Inter Tight", sans-serif', fontSize: 14 }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: palette[i % palette.length],
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{e.winner}</span>
                      <span
                        style={{
                          fontFamily: '"Fraunces", ui-serif, Georgia, serif',
                          fontStyle: 'italic',
                          color: 'var(--accent)',
                          fontWeight: 500,
                          fontSize: 15,
                        }}
                      >
                        vs.
                      </span>
                      <span style={{ color: 'var(--fg-2)' }}>{e.loser}</span>
                      <span
                        style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: 12,
                          color: 'var(--fg-2)',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {e.score}
                      </span>
                      <span
                        style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: 12,
                          color: 'var(--good)',
                          fontWeight: 600,
                        }}
                      >
                        +{e.delta}
                      </span>
                      <Sparkline
                        data={e.trend}
                        w={50}
                        h={14}
                        stroke="auto"
                        strokeWidth={1.4}
                      />
                      <span
                        style={{
                          color: 'var(--fg-3)',
                          fontSize: 12,
                          fontFamily: '"JetBrains Mono", monospace',
                          letterSpacing: '0.02em',
                        }}
                      >
                        · {e.league}
                      </span>
                    </span>
                  );
                })}
              </span>
            ))}
          </div>
        </div>

        <EloMarquee />

        {/* HOW IT WORKS */}
        <section id="how" className="pb-20 md:pb-24">
          <div className="tt-container">
            <h2 className="display text-[clamp(32px,4.4vw,48px)] leading-[1.02] mb-10">
              {t('landing.how.title')}
            </h2>
            <ol className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 md:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <li
                  key={i}
                  className="how-card group relative p-5 md:p-6 cursor-default"
                  style={{
                    background: 'var(--bg-2)',
                    border: '1.5px solid var(--line-soft)',
                    borderRadius: 'var(--r-lg)',
                    transition: 'transform 220ms cubic-bezier(.34,1.56,.64,1), border-color 180ms ease, box-shadow 220ms ease',
                  }}
                >
                  {/* Top accent rail — slides in from left on hover */}
                  <span
                    aria-hidden="true"
                    className="how-card-rail"
                    style={{
                      position: 'absolute',
                      top: -1,
                      left: -1,
                      right: -1,
                      height: 2,
                      background: 'var(--accent)',
                      borderRadius: '2px 2px 0 0',
                      transformOrigin: 'left',
                      transform: 'scaleX(0)',
                      transition: 'transform 320ms cubic-bezier(.34,1.56,.64,1)',
                    }}
                  />
                  <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--accent)] transition-colors">
                    Step {String(i).padStart(2, '0')}
                  </div>
                  <h4
                    className="text-[16px] md:text-[17px] font-semibold mt-2 leading-[1.35]"
                    style={{ fontFamily: '"Inter Tight", sans-serif', letterSpacing: '-0.01em' }}
                  >
                    {t(`landing.how.step${i}.title`)}
                  </h4>
                </li>
              ))}
            </ol>
            <style>{`
              .how-card { will-change: transform; }
              .how-card:hover, .how-card:focus-visible {
                transform: translateY(-3px);
                border-color: var(--accent) !important;
                box-shadow: 0 14px 32px -18px oklch(0.70 0.20 38 / 0.55), 0 0 0 1px oklch(0.70 0.20 38 / 0.15);
              }
              .how-card:hover .how-card-rail,
              .how-card:focus-visible .how-card-rail {
                transform: scaleX(1);
              }
              .how-card:active {
                transform: translateY(-1px) scale(0.99);
              }
              @media (hover: none) {
                /* On touch devices, the press itself is the feedback */
                .how-card:active {
                  border-color: var(--accent) !important;
                  transform: scale(0.985);
                }
                .how-card:active .how-card-rail { transform: scaleX(1); }
              }
            `}</style>
          </div>
        </section>

        {/* PUBLIC LEAGUES */}
        <section id="public" className="pb-20 md:pb-24" ref={leaderboardSectionRef}>
          <div className="tt-container">
            <h2 className="display text-[clamp(32px,4.4vw,48px)] leading-[1.02] mb-10 max-w-[700px]">
              {t('landing.public.title')}
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="md" />
              </div>
            ) : publicLeagues.length === 0 ? (
              <div className="ph h-24">
                <span>{t('landing.public.empty')}</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {publicLeagues.slice(0, 2).map((league) => (
                    <PublicLeagueCard
                      key={league.id}
                      league={league}
                      leaderboard={leagueLeaderboards[league.id]}
                      status={leaderboardStatus[league.id]?.status}
                      shouldLoad={shouldLoadLeaderboards}
                      t={t}
                    />
                  ))}
                </div>
                {publicLeagues.length > 2 && (
                  <div className="mt-6 grid gap-1">
                    {publicLeagues.slice(2).map((l) => (
                      <Link
                        key={l.id}
                        to={`/league/${l.id}`}
                        className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-[var(--bg-2)] transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`av-chip av-c${(l.id % 5) + 1} w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold`}>
                            {(l.name || '??').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-[14px] text-[var(--fg-2)] group-hover:text-[var(--fg)] truncate">
                            {l.name}
                          </span>
                        </div>
                        <div className="font-mono text-[12px] text-[var(--fg-3)] flex gap-4">
                          <span>{l.member_count || 0} members</span>
                          <span>{l.match_count || 0} matches</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                <div className="mt-8 flex justify-center">
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full px-6 py-5 text-[14px] border-[1.5px]"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <Link to="/register">
                      {t('landing.public.seeAll')} →
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* CTA — editorial card-link with bobbing accent arrow */}
        <section className="pb-24 md:pb-28 relative">
          <div className="tt-container flex justify-center">
            <Link
              to="/register"
              className="cta-card group relative inline-flex items-center justify-between gap-8 px-8 md:px-12 py-7 md:py-8 no-underline"
              style={{
                background: 'var(--bg-2)',
                border: '1.5px solid var(--line-soft)',
                borderRadius: 'var(--r-xl)',
                color: '#ffffff',
                minWidth: 'min(640px, 92vw)',
                transition: 'transform 240ms cubic-bezier(.34,1.56,.64,1), border-color 200ms ease, box-shadow 240ms ease',
                overflow: 'hidden',
              }}
            >
              {/* Top accent rail (slides in on hover) */}
              <span
                aria-hidden="true"
                className="cta-rail"
                style={{
                  position: 'absolute',
                  top: -1,
                  left: -1,
                  right: -1,
                  height: 2,
                  background: 'var(--accent)',
                  borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
                  transformOrigin: 'left',
                  transform: 'scaleX(0)',
                  transition: 'transform 360ms cubic-bezier(.34,1.56,.64,1)',
                }}
              />
              <span
                className="cta-text"
                style={{
                  fontFamily: '"Fraunces", ui-serif, Georgia, serif',
                  fontStyle: 'italic',
                  fontWeight: 600,
                  fontSize: 'clamp(22px, 3.2vw, 36px)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.05,
                  color: '#ffffff',
                }}
              >
                {t('landing.cta.button')}
              </span>
              <span
                aria-hidden="true"
                className="cta-arrow inline-flex items-center justify-center shrink-0"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'oklch(0.70 0.20 38 / 0.12)',
                  color: 'var(--accent)',
                  fontFamily: '"Inter Tight", sans-serif',
                  fontSize: 22,
                  fontWeight: 700,
                  lineHeight: 1,
                  transition: 'background 200ms ease',
                }}
              >
                <span className="cta-arrow-glyph">→</span>
              </span>
            </Link>
          </div>
        </section>
        <style>{`
          .cta-card { will-change: transform; }
          .cta-card:hover, .cta-card:focus-visible {
            transform: translateY(-2px);
            border-color: var(--accent) !important;
            box-shadow:
              0 22px 40px -22px oklch(0.70 0.20 38 / 0.55),
              0 0 0 1px oklch(0.70 0.20 38 / 0.18);
          }
          .cta-card:active { transform: translateY(-1px) scale(0.995); }
          .cta-card:hover .cta-arrow { background: var(--accent) !important; color: var(--accent-ink) !important; }
          .cta-card:hover .cta-rail { transform: scaleX(1); }

          /* The arrow gently bobs on its own — the "this is a link" tell */
          .cta-arrow-glyph {
            display: inline-block;
            animation: tt-cta-bob 2.4s ease-in-out infinite;
          }
          .cta-card:hover .cta-arrow-glyph { animation: tt-cta-snap 520ms cubic-bezier(.34,1.56,.64,1); }
          @keyframes tt-cta-bob {
            0%, 100% { transform: translateX(0); }
            50%      { transform: translateX(4px); }
          }
          @keyframes tt-cta-snap {
            0%   { transform: translateX(0); }
            55%  { transform: translateX(10px); }
            100% { transform: translateX(2px); }
          }

          /* Soft underline that grows under the editorial text on hover */
          .cta-text { background-image: linear-gradient(var(--accent), var(--accent)); background-position: 0 100%; background-repeat: no-repeat; background-size: 0 1.5px; transition: background-size 320ms ease; padding-bottom: 4px; }
          .cta-card:hover .cta-text { background-size: 100% 1.5px; }

          @media (hover: none) {
            .cta-card:active { border-color: var(--accent) !important; }
            .cta-card:active .cta-rail { transform: scaleX(1); }
            .cta-card:active .cta-arrow { background: var(--accent) !important; color: var(--accent-ink) !important; }
          }
        `}</style>
      </main>

      <SiteFooter />
    </div>
  );
};

// Cycles through a list of words. The active word is rendered alone so the
// surrounding line reflows tightly around it — short words don't leave a gap.
function RotatingWord({ words, interval = 2200 }) {
  const list = Array.isArray(words) && words.length > 0 ? words : [''];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return undefined;
    const t = setInterval(() => setI((p) => (p + 1) % list.length), interval);
    return () => clearInterval(t);
  }, [list.length, interval]);
  return (
    <span
      key={i}
      style={{
        color: 'var(--accent)',
        display: 'inline-block',
        animation: 'tt-word-swap 0.45s ease',
        whiteSpace: 'nowrap',
      }}
      aria-live="polite"
    >
      {list[i]}
      <style>{`
        @keyframes tt-word-swap {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </span>
  );
}

function PublicLeagueCard({ league, leaderboard, status, shouldLoad, t }) {
  const resolvedStatus = typeof status === 'string' ? status : shouldLoad ? 'loading' : 'idle';
  const data = Array.isArray(leaderboard) ? leaderboard : [];

  return (
    <div className="tt-card p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <Link to={`/league/${league.id}`} className="min-w-0 flex-1 group">
          <h3 className="display text-[24px] leading-[1.1] truncate group-hover:text-[var(--accent)] transition-colors">
            {league.name}
          </h3>
        </Link>
        <span className="chip">● {t('leagues.public')}</span>
      </div>
      {league.description && (
        <p className="text-[14px] text-[var(--fg-3)] line-clamp-2 mb-3">{league.description}</p>
      )}
      <div className="flex flex-wrap gap-3 font-mono text-[11px] text-[var(--fg-3)] uppercase tracking-wider mb-4">
        <span>{league.member_count || 0} members</span>
        <span>·</span>
        <span>{league.match_count || 0} matches</span>
        {league.season && (
          <>
            <span>·</span>
            <span>{league.season}</span>
          </>
        )}
      </div>

      {resolvedStatus === 'loading' || resolvedStatus === 'idle' ? (
        <div className="flex items-center justify-center py-6">
          <LoadingSpinner size="sm" />
        </div>
      ) : resolvedStatus === 'error' ? (
        <p className="text-sm text-[var(--bad)] text-center py-4">{t('leagues.leaderboardError')}</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-[var(--fg-3)] text-center py-4">{t('leagues.noPlayers')}</p>
      ) : (
        <div className="space-y-1">
          {data.slice(0, 5).map((p) => (
            <div
              key={p.roster_id || p.user_id}
              className="grid items-center gap-3 py-1.5"
              style={{ gridTemplateColumns: '32px 1fr 60px auto' }}
            >
              <span
                className={`font-sans font-bold text-[14px] tabular-nums ${
                  p.rank === 1 ? 'text-[var(--accent)]' : 'text-[var(--fg-2)]'
                }`}
              >
                {p.rank}.
              </span>
              <span className="text-[13.5px] truncate">{p.display_name || p.username || 'Player'}</span>
              {p.user_id ? (
                <EloSparkline userId={p.user_id} leagueId={league.id} width={56} height={14} points={15} />
              ) : p.roster_id ? (
                <EloSparkline rosterId={p.roster_id} leagueId={league.id} width={56} height={14} points={15} />
              ) : (
                <span className="text-xs text-[var(--fg-4)]">—</span>
              )}
              <span className="font-mono text-[13px] text-[var(--fg-2)] tabular-nums text-right">{p.current_elo}</span>
            </div>
          ))}
        </div>
      )}
      <Link
        to={`/league/${league.id}`}
        className="block text-center text-[13px] text-[var(--accent)] hover:underline mt-4 pt-3 border-t"
        style={{ borderColor: 'var(--line-soft)' }}
      >
        {t('landing.public.viewLeaderboard')} →
      </Link>
    </div>
  );
}

export default LandingPage;
