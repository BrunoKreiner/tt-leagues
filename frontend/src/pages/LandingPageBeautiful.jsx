import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Trophy, Users, TrendingUp, Award, Zap, ArrowRight, Menu, X, BookOpen,
  Flame, Target, Gauge, Crown
} from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import SiteFooter from '@/components/layout/SiteFooter';

const LandingPageBeautiful = () => {
  const { t } = useTranslation();
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [leagueLeaderboards, setLeagueLeaderboards] = useState({});
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const leaderboardSectionRef = useRef(null);
  const heroRef = useRef(null);

  // Parallax effect on mouse move
  const handleMouseMove = (e) => {
    if (!heroRef.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = heroRef.current.getBoundingClientRect();

    const x = (clientX - left) / width;
    const y = (clientY - top) / height;

    const moveX = (x - 0.5) * 20;
    const moveY = (y - 0.5) * 20;

    heroRef.current.style.setProperty('--mouse-x', `${moveX}px`);
    heroRef.current.style.setProperty('--mouse-y', `${moveY}px`);
  };

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
  }, [publicLeagues]);

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
    {
      icon: Trophy,
      title: 'Track Rankings',
      description: 'Real-time competitive rankings powered by ELO',
      accent: 'var(--accent-cyan)'
    },
    {
      icon: TrendingUp,
      title: 'Performance Analytics',
      description: 'Detailed statistics and historical trends',
      accent: 'var(--accent-orange)'
    },
    {
      icon: Users,
      title: 'Community Leagues',
      description: 'Create and manage competitive leagues',
      accent: 'var(--accent-mint)'
    },
    {
      icon: Award,
      title: 'Achievements',
      description: 'Unlock badges and milestone rewards',
      accent: 'var(--accent-purple)'
    },
  ];

  const stats = [
    { value: '1000+', label: 'Active Players' },
    { value: '50+', label: 'Leagues' },
    { value: '10K+', label: 'Matches Played' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--base-dark)] via-[var(--base-darker)] to-[var(--base-dark)]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-[var(--card-border)]" style={{
        background: 'rgba(10, 14, 31, 0.8)'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-cyan)] to-[var(--accent-purple)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-cyan)] transition-colors">
                {t('app.title')}
              </span>
            </Link>

            {/* Desktop menu */}
            <div className="hidden md:flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] transition-colors"
              >
                <Link to="/wiki/ttc-baden-wettingen" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Wiki
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] transition-colors"
              >
                <Link to="/login">Log in</Link>
              </Button>
              <Button
                size="sm"
                asChild
                className="btn-primary text-white font-semibold"
              >
                <Link to="/register">Get started</Link>
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-[var(--card-bg)] rounded-lg transition text-[var(--text-primary)]"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--card-border)] bg-gradient-to-br from-[var(--base-dark)] to-[var(--base-darker)]">
            <div className="px-4 py-4 space-y-3">
              <Link to="/wiki/ttc-baden-wettingen" className="block text-[var(--text-secondary)] hover:text-[var(--accent-cyan)]">
                Wiki
              </Link>
              <Link to="/login" className="block text-[var(--text-secondary)] hover:text-[var(--accent-cyan)]">
                Log in
              </Link>
              <Button size="sm" asChild className="w-full btn-primary">
                <Link to="/register">Get started</Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section
        ref={heroRef}
        onMouseMove={handleMouseMove}
        className="relative overflow-hidden pt-20 pb-32"
      >
        {/* Background gradient orbs */}
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-[var(--accent-cyan)] opacity-5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-32 left-1/4 w-80 h-80 bg-[var(--accent-purple)] opacity-5 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8 text-center animate-in">
            <div className="space-y-4">
              <div className="inline-block px-4 py-2 rounded-full bg-[var(--glass-light)] border border-[var(--glass-lighter)] text-[var(--accent-cyan)] text-sm font-semibold">
                ⚡ The Future of Competitive Rankings
              </div>
              <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold leading-tight">
                <span className="text-[var(--text-primary)]">Competitive Rankings</span>
                <br />
                <span className="gradient-text">Beautifully Tracked</span>
              </h1>
              <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
                Track competitive play with precision. Analyze performance in detail. Rise through the ranks and claim your place at the top.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <Button size="lg" asChild className="btn-primary text-white font-semibold px-8">
                <Link to="/register" className="flex items-center gap-2">
                  Start tracking <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-[var(--card-border)] text-[var(--accent-cyan)] hover:bg-[var(--glass-light)]"
              >
                <Link to="/league/1" className="flex items-center gap-2">
                  View leaderboards
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 mb-16">
        <div className="grid grid-cols-3 gap-4 md:gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="glass-card p-6 text-center stagger-item">
              <div className="text-3xl md:text-4xl font-bold gradient-text">
                {stat.value}
              </div>
              <div className="text-[var(--text-secondary)] text-sm mt-2">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
            Everything You Need
          </h2>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
            Powerful tools to track, analyze, and dominate your competitive scene
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="prime-card p-6 stagger-item hover:shadow-lg transition-all group"
                style={{ '--delay': `${i * 0.1}s` }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ background: `${feature.accent}20`, color: feature.accent }}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-[var(--text-primary)] mb-2">
                  {feature.title}
                </h3>
                <p className="text-[var(--text-tertiary)] text-sm">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Leaderboards Section */}
      <section ref={leaderboardSectionRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-[var(--text-primary)] mb-3">Live Rankings</h2>
          <p className="text-[var(--text-secondary)]">See who's leading right now</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : publicLeagues.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {publicLeagues.slice(0, 2).map((league, idx) => (
              <div key={league.id} className="prime-card overflow-hidden stagger-item">
                <CardContent className="p-6">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-[var(--text-primary)]">
                      {league.name}
                    </h3>
                    <p className="text-[var(--text-tertiary)] text-sm mt-1">
                      {league.member_count} members • {league.match_count} matches
                    </p>
                  </div>

                  <div className="space-y-3">
                    {(leagueLeaderboards[league.id] || []).slice(0, 5).map((player, rank) => (
                      <div
                        key={rank}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--glass-light)] transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          {rank < 3 ? (
                            <div
                              className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm ${
                                rank === 0 ? 'rank-gold' : rank === 1 ? 'rank-silver' : 'rank-bronze'
                              }`}
                            >
                              {rank + 1}
                            </div>
                          ) : (
                            <div className="w-8 text-center text-sm font-semibold text-[var(--text-tertiary)]">
                              {rank + 1}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent-cyan)] transition-colors">
                              {player.display_name || player.username}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)]">
                              {player.matches_played || 0} matches
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-[var(--accent-cyan)]">
                          {player.current_elo}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Link
                    to={`/league/${league.id}`}
                    className="mt-6 block text-center py-2 text-sm font-medium text-[var(--accent-cyan)] hover:text-[var(--accent-orange)] transition-colors"
                  >
                    View full leaderboard →
                  </Link>
                </CardContent>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="prime-card p-12 space-y-6 text-center animate-in">
          <h2 className="text-4xl font-bold text-[var(--text-primary)]">
            Ready to compete?
          </h2>
          <p className="text-lg text-[var(--text-secondary)]">
            Join thousands of players tracking their competitive journey
          </p>
          <Button
            size="lg"
            asChild
            className="btn-secondary text-white font-semibold text-base px-8 py-6 h-auto mx-auto"
          >
            <Link to="/register">Create your account</Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default LandingPageBeautiful;
