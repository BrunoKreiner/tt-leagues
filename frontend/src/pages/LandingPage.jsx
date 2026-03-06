import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, ChevronRight, ListChecks, Calendar, Globe, Sparkles, BookOpen, Menu, X } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI } from '../services/api';
import MedalIcon from '@/components/MedalIcon';
import EloSparkline from '@/components/EloSparkline';
import { BadgeList } from '@/components/BadgeDisplay';
import { useTranslation } from 'react-i18next';
import SiteFooter from '@/components/layout/SiteFooter';

const LandingPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [leagueLeaderboards, setLeagueLeaderboards] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaderboardStatus, setLeaderboardStatus] = useState({});
  const [shouldLoadLeaderboards, setShouldLoadLeaderboards] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const leaderboardSectionRef = useRef(null);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((open) => !open);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // Close menu on route change
  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname, closeMobileMenu]);

  // Handle escape key and body scroll
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        closeMobileMenu();
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen, closeMobileMenu]);

  const leaderboardLeagues = useMemo(() => publicLeagues.slice(0, 2), [publicLeagues]);

  useEffect(() => {
    const node = leaderboardSectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadLeaderboards(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const fetchPublicLeagues = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await leaguesAPI.getAll({ limit: 4 }, { ttlMs: 15000 });
        const leagueData = response.data?.leagues;
        const leagues = Array.isArray(leagueData)
          ? leagueData.filter((league) => league.is_public)
          : [];
        setPublicLeagues(leagues);
        
      } catch (error) {
        console.error('Failed to fetch public leagues:', error);
        const apiMessage = error?.response?.data?.error;
        setError(typeof apiMessage === 'string' && apiMessage.length > 0 ? apiMessage : 'Failed to fetch public leagues');
      } finally {
        setLoading(false);
      }
    };

    fetchPublicLeagues();
  }, []);

  useEffect(() => {
    if (!shouldLoadLeaderboards) return;
    if (leaderboardLeagues.length === 0) {
      setLeagueLeaderboards({});
      setLeaderboardStatus({});
      return;
    }

    const loadLeaderboards = async () => {
      const loadingStatus = {};
      leaderboardLeagues.forEach((league) => {
        loadingStatus[league.id] = { status: 'loading' };
      });
      setLeaderboardStatus((prev) => ({ ...prev, ...loadingStatus }));

      const leaderboardResults = await Promise.allSettled(
        leaderboardLeagues.map((league) =>
          leaguesAPI.getLeaderboard(league.id, { limit: 5, include_badges: true }, { ttlMs: 10000 })
        )
      );
      const nextLeaderboards = {};
      const nextStatus = {};
      leaderboardResults.forEach((result, index) => {
        const leagueId = leaderboardLeagues[index]?.id;
        if (!leagueId) return;
        if (result.status === 'fulfilled') {
          const leaderboardData = result.value.data?.leaderboard;
          nextLeaderboards[leagueId] = Array.isArray(leaderboardData) ? leaderboardData : [];
          nextStatus[leagueId] = { status: 'loaded' };
        } else {
          console.error(`Failed to load leaderboard for league ${leagueId}:`, result.reason);
          nextStatus[leagueId] = { status: 'error' };
        }
      });
      setLeagueLeaderboards((prev) => ({ ...prev, ...nextLeaderboards }));
      setLeaderboardStatus((prev) => ({ ...prev, ...nextStatus }));
    };

    loadLeaderboards();
  }, [leaderboardLeagues, shouldLoadLeaderboards]);

  const features = [
    'Manage your own leagues',
    'Track your performance among friends',
    'Complex ELO system',
    'Match history with detailed stats',
    'Leaderboards',
    'Define and award custom badges',
    'Show off your profile',
  ];

  const comingSoon = ['Tournament systems', 'Different sport configurations', 'Chat system'];

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b velocity-border-glow bg-gradient-to-r from-velocity-dark/95 via-velocity-dark/98 to-velocity-dark/95 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2 group">
              <img src="/img/logo.png" alt="Logo" className="h-8 w-8 group-hover:scale-110 transition-transform" />
              <span className="cyberpunk-title text-lg bg-gradient-to-r from-velocity-cyan to-velocity-accent-purple bg-clip-text text-transparent velocity-glow">
                {t('app.title')}
              </span>
            </Link>
            <div className="flex items-center gap-3">
              {/* Desktop: Wiki link and auth buttons */}
              <div className="hidden md:flex items-center gap-3">
                <Button variant="ghost" size="sm" asChild className="text-gray-400 hover:text-velocity-cyan transition-colors">
                  <Link to="/wiki/ttc-baden-wettingen" className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span className="inline-flex items-start gap-1">
                      <span>TTC Baden-Wettingen</span>
                      <sup className="text-[10px] font-semibold text-velocity-cyan inline-block -skew-y-3">wiki</sup>
                    </span>
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild className="text-gray-400 hover:text-velocity-cyan transition-colors">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button size="sm" asChild className="velocity-card gradient-cyan-to-purple text-black font-bold hover:shadow-lg hover:shadow-velocity-cyan/50">
                  <Link to="/register">Get started</Link>
                </Button>
              </div>
              
              {/* Mobile: Hamburger button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMobileMenu}
                className="md:hidden h-11 w-11 p-0 flex items-center justify-center hover:bg-transparent active:bg-transparent focus-visible:ring-0 focus:outline-none touch-manipulation"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6 text-gray-200" />
                ) : (
                  <Menu className="w-6 h-6 text-gray-200" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative py-12 px-4">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full opacity-20" style={{background: 'radial-gradient(circle, #00d9ff 0%, transparent 70%)'}} />
          <div className="absolute bottom-40 right-1/4 w-96 h-96 rounded-full opacity-10" style={{background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)'}} />
        </div>

        <div className="max-w-5xl mx-auto space-y-10 relative z-10">

          {/* Hero */}
          <section className="text-center space-y-8 py-12">
            <div className="space-y-4 animate-float-up">
              <h1 className="cyberpunk-title text-5xl sm:text-6xl font-black">
                <span className="bg-gradient-to-r from-velocity-cyan via-velocity-accent-purple to-velocity-gold bg-clip-text text-transparent inline-block">
                  League & ELO Tracking
                </span>
              </h1>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
                Track competitive play. Analyze performance. Dominate the leaderboards.
              </p>
            </div>
            <Button asChild size="lg" className="mx-auto velocity-card gradient-cyan-to-purple text-black font-bold hover:shadow-lg hover:shadow-velocity-cyan/50">
              <Link to="/register">Get started →</Link>
            </Button>
          </section>

          {/* Features List */}
          <section className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-100">What You Get</h2>
            <ul className="space-y-3">
              {features.map((feature, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 py-3 px-5 rounded-lg border-l-4 border-velocity-cyan/70 velocity-card hover:border-velocity-cyan hover:scale-105 transition-all"
                  style={{animationDelay: `${i * 50}ms`}}
                >
                  <ChevronRight className="h-5 w-5 text-velocity-cyan flex-shrink-0" />
                  <span className="text-gray-100 font-medium">{feature}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Coming Soon + Free */}
          <section className="py-8 border-t border-b border-velocity-border/50 velocity-card rounded-lg">
            <div className="max-w-2xl mx-auto text-center">
              <div className="flex items-center justify-center gap-2 mb-6">
                <Sparkles className="h-5 w-5 text-velocity-gold" />
                <span className="text-sm font-semibold text-velocity-gold">Coming soon</span>
              </div>
              <ul className="space-y-3">
                {comingSoon.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 py-3 px-5 rounded-lg border-l-4 border-velocity-gold/50 velocity-card hover:border-velocity-gold hover:scale-105 transition-all text-left"
                  >
                    <ChevronRight className="h-5 w-5 text-velocity-gold flex-shrink-0" />
                    <span className="text-gray-100 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 text-sm text-velocity-cyan font-semibold">Free to use · No ads</div>
            </div>
          </section>

          {/* Public Leagues with Leaderboards */}
          <section ref={leaderboardSectionRef} className="relative">
            <h2 className="cyberpunk-title text-3xl font-bold mb-8 text-gray-100">Public Leagues</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            ) : error ? (
              <p className="text-sm text-red-400 text-center py-6">{error}</p>
            ) : publicLeagues.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {publicLeagues.slice(0, 2).map((league, idx) => (
                  <Card key={league.id} className="vg-card hover:shadow-lg hover:shadow-velocity-cyan/30 transition-all" style={{animationDelay: `${idx * 100}ms`}}>
                    <CardHeader className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link to={`/league/${league.id}`} className="min-w-0">
                          <CardTitle className="cyberpunk-subtitle text-xl truncate text-velocity-cyan hover:text-velocity-gold transition-colors">
                            {league.name}
                          </CardTitle>
                        </Link>
                        <Badge variant="secondary" className="ml-2 flex items-center gap-1 shrink-0 bg-velocity-cyan/20 text-velocity-cyan border border-velocity-cyan/50">
                          <Globe className="h-3.5 w-3.5" />
                          Public
                        </Badge>
                      </div>
                      {league.description && (
                        <CardDescription className="line-clamp-2 text-gray-400">{league.description}</CardDescription>
                      )}
                      <div className="flex flex-wrap gap-3 text-sm text-gray-500 pt-1">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" /> {league.member_count || 0} members
                        </span>
                        <span className="flex items-center gap-1">
                          <ListChecks className="h-4 w-4" /> {league.match_count || 0} matches
                        </span>
                        {league.season && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" /> {league.season}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {(() => {
                        const status = leaderboardStatus[league.id]?.status;
                        const resolvedStatus = typeof status === 'string'
                          ? status
                          : (shouldLoadLeaderboards ? 'loading' : 'idle');
                        const leaderboardData = Array.isArray(leagueLeaderboards[league.id])
                          ? leagueLeaderboards[league.id]
                          : [];

                        if (resolvedStatus === 'loading' || resolvedStatus === 'idle') {
                          return (
                            <div className="flex items-center justify-center py-3">
                              <LoadingSpinner size="sm" />
                            </div>
                          );
                        }

                        if (resolvedStatus === 'error') {
                          return (
                            <p className="text-sm text-red-400 text-center py-3">{t('leagues.leaderboardError')}</p>
                          );
                        }

                        if (leaderboardData.length === 0) {
                          return <p className="text-sm text-gray-500 text-center py-3">No players yet</p>;
                        }

                        return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-velocity-cyan/70 border-b border-velocity-border">
                                <th className="px-2 py-3 font-semibold w-16 text-center">Rank</th>
                                <th className="px-2 py-3 font-semibold">Player</th>
                                <th className="px-2 py-3 font-semibold">ELO</th>
                                <th className="px-2 py-3 font-semibold">Trend</th>
                                <th className="px-2 py-3 font-semibold text-right">W/L</th>
                              </tr>
                            </thead>
                            <tbody>
                              {leaderboardData.map((p, idx) => (
                                <tr key={p.roster_id || idx} className="border-b border-velocity-border/30 hover:bg-velocity-cyan/5 transition-colors">
                                  <td className="px-2 py-3 align-middle">
                                    <div className="w-10 flex items-center justify-center">
                                      {p.rank <= 3 ? (
                                        <MedalIcon rank={p.rank} size={p.rank === 1 ? 32 : 28} />
                                      ) : (
                                        <span className="text-gray-300 text-sm font-bold tabular-nums">{p.rank}.</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2 py-3 align-middle">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {p.avatar_url ? (
                                        <img
                                          src={p.avatar_url}
                                          alt=""
                                          className="w-6 h-6 rounded-full object-cover border border-velocity-cyan/50"
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-velocity-cyan to-velocity-accent-purple flex items-center justify-center text-xs font-bold text-velocity-dark">
                                          {(p.display_name || p.username || 'P').charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="text-velocity-cyan font-semibold truncate">
                                        {p.display_name || p.username || 'Player'}
                                      </span>
                                      {p.badges && p.badges.length > 0 && (
                                        <BadgeList
                                          badges={p.badges}
                                          size="sm"
                                          showDate={false}
                                          showLeague={false}
                                          className="flex-nowrap overflow-x-auto scrollbar-hide gap-1"
                                        />
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2 py-3 text-velocity-gold font-bold tabular-nums align-middle">
                                    {p.current_elo}
                                  </td>
                                  <td className="px-2 py-3 align-middle">
                                    {p.user_id ? (
                                      <EloSparkline userId={p.user_id} leagueId={league.id} width={56} height={14} points={15} />
                                    ) : p.roster_id ? (
                                      <EloSparkline rosterId={p.roster_id} leagueId={league.id} width={56} height={14} points={15} />
                                    ) : (
                                      <span className="text-xs text-gray-500">—</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-3 text-gray-300 tabular-nums text-right align-middle text-xs">
                                    {p.matches_won}/{(p.matches_played || 0) - (p.matches_won || 0)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        );
                      })()}
                      <Link
                        to={`/league/${league.id}`}
                        className="block text-center text-sm text-velocity-cyan hover:text-velocity-gold font-semibold mt-3 py-3 border-t border-velocity-border/30 transition-colors"
                      >
                        View full leaderboard →
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-6">No public leagues yet</p>
            )}

            {/* Additional leagues list */}
            {publicLeagues.length > 2 && (
              <div className="mt-8 space-y-2">
                <h3 className="text-sm font-bold text-velocity-gold/80 mb-3 uppercase tracking-wide">More Leagues</h3>
                {publicLeagues.slice(2).map((league) => (
                  <Link
                    key={league.id}
                    to={`/league/${league.id}`}
                    className="flex items-center justify-between py-3 px-4 rounded-lg velocity-card hover:border-velocity-cyan transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Trophy className="h-5 w-5 text-velocity-gold/70 group-hover:text-velocity-gold transition-colors" />
                      <span className="text-gray-200 group-hover:text-velocity-cyan font-medium">{league.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400 group-hover:text-gray-300">
                      <span>{league.member_count || 0} members</span>
                      <span>{league.match_count || 0} matches</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

        </div>
      </main>

      <SiteFooter />

      {/* Mobile Menu */}
      <>
        {/* Backdrop */}
        <div 
          className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`} 
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
        
        {/* Menu Panel */}
        <div 
          className={`fixed right-0 top-0 h-full w-80 bg-gray-900 border-l border-gray-700 z-50 transform transition-transform duration-300 ease-in-out ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-gray-200">Menu</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeMobileMenu}
              className="h-11 w-11 p-0 touch-manipulation"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto">
            <div className="p-2">
              <Link
                to="/wiki/ttc-baden-wettingen"
                className="flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-200 hover:bg-gray-700 transition-colors min-h-[44px] touch-manipulation"
                onClick={closeMobileMenu}
              >
                <BookOpen className="h-5 w-5" />
                <span className="inline-flex items-start gap-1">
                  <span>TTC Baden-Wettingen</span>
                  <sup className="text-[10px] font-semibold text-blue-400 inline-block -skew-y-3">wiki</sup>
                </span>
              </Link>
            </div>

            {/* Divider */}
            <div className="px-4 py-2">
              <div className="h-px bg-gray-700" />
            </div>

            {/* Auth Buttons */}
            <div className="p-4">
              <div className="flex flex-col gap-2">
                <Button asChild variant="ghost" className="w-full justify-start min-h-[44px] touch-manipulation">
                  <Link to="/login" onClick={closeMobileMenu}>Log in</Link>
                </Button>
                <Button asChild className="w-full min-h-[44px] touch-manipulation">
                  <Link to="/register" onClick={closeMobileMenu}>Get started</Link>
                </Button>
              </div>
            </div>
          </nav>
        </div>
      </>
    </div>
  );
};

export default LandingPage;
