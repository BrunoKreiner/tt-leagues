import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Users, TrendingUp, Award, Zap, ArrowRight, Menu, X, BookOpen } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI } from '../services/api';
import MedalIcon from '@/components/MedalIcon';
import EloSparkline from '@/components/EloSparkline';
import { useTranslation } from 'react-i18next';
import SiteFooter from '@/components/layout/SiteFooter';

const LandingPage = () => {
  const { t } = useTranslation();
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [leagueLeaderboards, setLeagueLeaderboards] = useState({});
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const leaderboardSectionRef = useRef(null);

  // Fetch public leagues
  useEffect(() => {
    const fetchPublicLeagues = async () => {
      try {
        const response = await leaguesAPI.getAll({ limit: 3 }, { ttlMs: 15000 });
        const leagueData = response.data?.leagues;
        const leagues = Array.isArray(leagueData)
          ? leagueData.filter((league) => league.is_public)
          : [];
        setPublicLeagues(leagues);
      } catch (error) {
        console.error('Failed to fetch public leagues:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicLeagues();
  }, []);

  // Lazy load leaderboards on scroll
  useEffect(() => {
    const node = leaderboardSectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadLeaderboards();
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const loadLeaderboards = async () => {
    if (publicLeagues.length === 0) return;

    const results = await Promise.allSettled(
      publicLeagues.map((league) =>
        leaguesAPI.getLeaderboard(league.id, { limit: 5, include_badges: true }, { ttlMs: 10000 })
      )
    );

    const leaderboards = {};
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const data = result.value.data?.leaderboard;
        leaderboards[publicLeagues[index].id] = Array.isArray(data) ? data : [];
      }
    });
    setLeagueLeaderboards(leaderboards);
  };

  const features = [
    { icon: Trophy, title: 'Track Rankings', description: 'Real-time competitive rankings powered by ELO' },
    { icon: TrendingUp, title: 'Performance Analytics', description: 'Detailed statistics and historical trends' },
    { icon: Users, title: 'Community Leagues', description: 'Create and manage competitive leagues' },
    { icon: Award, title: 'Achievements', description: 'Unlock badges and milestone rewards' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf8f5] via-[#f5f3f1] to-[#faf8f5]">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 backdrop-blur-sm bg-white/80 border-b border-[#e5e3e0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <img src="/img/logo.png" alt="Logo" className="h-8 w-8 group-hover:scale-110 transition-transform" />
              <span className="text-xl font-bold text-[#1a2942]">{t('app.title')}</span>
            </Link>

            {/* Desktop menu */}
            <div className="hidden md:flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild className="text-[#6b7280] hover:text-[#1a2942]">
                <Link to="/wiki/ttc-baden-wettingen" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Wiki
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="text-[#6b7280]">
                <Link to="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild style={{ background: 'linear-gradient(135deg, #2a8a8a 0%, #4ade80 100%)' }} className="text-white font-semibold">
                <Link to="/register">Get started</Link>
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-[#f5f3f1] rounded-lg transition"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center animate-in">
        <div className="space-y-6 mb-12">
          <h1 className="text-5xl sm:text-6xl font-bold text-[#1a2942] leading-tight">
            Competitive rankings,{' '}
            <span style={{ background: 'linear-gradient(135deg, #2a8a8a 0%, #d4a574 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              beautifully tracked
            </span>
          </h1>
          <p className="text-lg text-[#6b7280] max-w-2xl mx-auto leading-relaxed">
            Track competitive play with precision. Analyze performance in detail. Rise through the ranks and claim your place at the top.
          </p>
        </div>

        <Button size="lg" asChild style={{ background: 'linear-gradient(135deg, #2a8a8a 0%, #4ade80 100%)' }} className="text-white font-semibold text-base px-8 py-6 h-auto">
          <Link to="/register" className="flex items-center gap-2">
            Start tracking <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Card key={i} className="prime-card group" style={{ animationDelay: `${i * 50}ms` }}>
                <CardContent className="pt-6 text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg" style={{ background: 'rgba(42, 138, 138, 0.1)' }}>
                    <Icon className="w-6 h-6 text-[#2a8a8a]" />
                  </div>
                  <h3 className="font-semibold text-[#1a2942]">{feature.title}</h3>
                  <p className="text-sm text-[#6b7280]">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Leaderboards Section */}
      <section ref={leaderboardSectionRef} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-[#1a2942] mb-3">Live Rankings</h2>
          <p className="text-[#6b7280]">See who's leading right now</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : publicLeagues.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {publicLeagues.slice(0, 2).map((league, idx) => (
              <Card key={league.id} className="prime-card overflow-hidden" style={{ animationDelay: `${idx * 100}ms` }}>
                <CardContent className="p-6">
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-[#1a2942]">{league.name}</h3>
                    <p className="text-sm text-[#6b7280] mt-1">{league.member_count} members • {league.match_count} matches</p>
                  </div>

                  <div className="space-y-3">
                    {(leagueLeaderboards[league.id] || []).slice(0, 5).map((player, rank) => (
                      <div key={rank} className="flex items-center justify-between p-3 rounded-lg hover:bg-[#f5f3f1] transition">
                        <div className="flex items-center gap-3">
                          {rank < 3 ? (
                            <div className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm ${['rank-gold', 'rank-silver', 'rank-bronze'][rank]}`}>
                              {rank + 1}
                            </div>
                          ) : (
                            <div className="w-8 text-center text-sm font-semibold text-[#6b7280]">{rank + 1}</div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-[#1a2942] truncate">{player.display_name || player.username}</p>
                            <p className="text-xs text-[#9ca3af]">{player.matches_played || 0} matches</p>
                          </div>
                        </div>
                        <p className="font-semibold text-[#d4a574]">{player.current_elo}</p>
                      </div>
                    ))}
                  </div>

                  <Link to={`/league/${league.id}`} className="mt-6 block text-center py-2 text-sm font-medium text-[#2a8a8a] hover:text-[#d4a574] transition">
                    View full leaderboard →
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="prime-card p-12 space-y-6">
          <h2 className="text-3xl font-bold text-[#1a2942]">Ready to compete?</h2>
          <p className="text-lg text-[#6b7280]">Join thousands of players tracking their competitive journey</p>
          <Button size="lg" asChild style={{ background: 'linear-gradient(135deg, #2a8a8a 0%, #4ade80 100%)' }} className="text-white font-semibold text-base px-8 py-6 h-auto">
            <Link to="/register">Create your account</Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default LandingPage;
