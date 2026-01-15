import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, ChevronRight, ListChecks, Calendar, Globe, Sparkles } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI } from '../services/api';
import MedalIcon from '@/components/MedalIcon';
import EloSparkline from '@/components/EloSparkline';
import { BadgeList } from '@/components/BadgeDisplay';
import { useTranslation } from 'react-i18next';
import SiteFooter from '@/components/layout/SiteFooter';

const LandingPage = () => {
  const { t } = useTranslation();
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [leagueLeaderboards, setLeagueLeaderboards] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaderboardStatus, setLeaderboardStatus] = useState({});

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
        
        // Fetch leaderboards for each league
        const leaderboardLeagues = leagues.slice(0, 2);
        if (leaderboardLeagues.length === 0) {
          setLeagueLeaderboards({});
          setLeaderboardStatus({});
          return;
        }

        const loadingStatus = {};
        leaderboardLeagues.forEach((league) => {
          loadingStatus[league.id] = { status: 'loading' };
        });
        setLeaderboardStatus((prev) => ({ ...prev, ...loadingStatus }));

        const leaderboardResults = await Promise.allSettled(
          leaderboardLeagues.map((league) =>
            leaguesAPI.getLeaderboard(league.id, { limit: 5, include_badges: false }, { ttlMs: 10000 })
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

  const features = [
    'Create or join leagues',
    'Track your ELO rating and performance',
    'Manage league members and logged matches',
    'Match history with detailed stats',
    'See who\'s on top of leaderboards',
    'Define and award custom badges',
    'Show off your profile',
    'Full league management',
  ];

  const comingSoon = ['Tournament systems', 'Different sport configurations', 'Chat system'];

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-gray-800/60 bg-gradient-to-r from-gray-900/95 via-gray-900/98 to-gray-900/95 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2 group">
              <img src="/img/logo.png" alt="Logo" className="h-8 w-8 group-hover:scale-105 transition-transform" />
              <span className="cyberpunk-title text-lg bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {t('app.title')}
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center text-[11px] font-semibold tracking-wide uppercase text-emerald-200/70 bg-emerald-500/5 border border-emerald-500/15 px-2 py-1 rounded-md">
                Free
              </span>
              <Button variant="ghost" size="sm" asChild className="text-gray-400 hover:text-white">
                <Link to="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild className="bg-blue-600 hover:bg-blue-500">
                <Link to="/register">Get started</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-12 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          
          {/* Hero */}
          <section className="text-center space-y-4">
            <h1 className="cyberpunk-title text-3xl sm:text-4xl bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              League & ELO Tracking
            </h1>
            <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500">
              <Link to="/register">Get started</Link>
            </Button>
          </section>

          {/* Features List */}
          <section className="max-w-2xl mx-auto">
            <ul className="space-y-2">
              {features.map((feature, i) => (
                <li 
                  key={i}
                  className="flex items-center gap-3 py-2 px-4 rounded-lg border-l-2 border-blue-500/60 bg-gray-900/40 hover:bg-gray-800/50 transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <span className="text-gray-200">{feature}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Coming Soon + Free */}
          <section className="py-5 border-t border-b border-gray-800/50">
            <div className="max-w-2xl mx-auto text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-purple-300" />
                <span className="text-sm font-semibold text-gray-200">Coming soon</span>
              </div>
              <ul className="space-y-2">
                {comingSoon.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 py-2 px-4 rounded-lg border-l-2 border-purple-500/50 bg-gray-900/40 hover:bg-gray-800/50 transition-colors text-left"
                  >
                    <ChevronRight className="h-4 w-4 text-purple-300 flex-shrink-0" />
                    <span className="text-gray-200">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-xs text-gray-500">Free to use · No ads</div>
            </div>
          </section>

          {/* Public Leagues with Leaderboards */}
          <section>
            <h2 className="cyberpunk-title text-lg text-gray-300 mb-4">Public Leagues</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            ) : error ? (
              <p className="text-sm text-red-400 text-center py-6">{error}</p>
            ) : publicLeagues.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {publicLeagues.slice(0, 2).map((league) => (
                  <Card key={league.id} className="vg-card">
                    <CardHeader className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link to={`/league/${league.id}`} className="min-w-0">
                          <CardTitle className="cyberpunk-subtitle text-xl truncate text-blue-400 hover:text-blue-300 transition-colors">
                            {league.name}
                          </CardTitle>
                        </Link>
                        <Badge variant="secondary" className="ml-2 flex items-center gap-1 shrink-0">
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
                        const resolvedStatus = typeof status === 'string' ? status : 'loaded';
                        const leaderboardData = Array.isArray(leagueLeaderboards[league.id])
                          ? leagueLeaderboards[league.id]
                          : [];

                        if (resolvedStatus === 'loading') {
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
                              <tr className="text-left text-gray-400 border-b border-gray-700">
                                <th className="px-2 py-2 font-medium w-16 text-center">Rank</th>
                                <th className="px-2 py-2 font-medium">Player</th>
                                <th className="px-2 py-2 font-medium">ELO</th>
                                <th className="px-2 py-2 font-medium">Trend</th>
                                <th className="px-2 py-2 font-medium text-right">W/L</th>
                              </tr>
                            </thead>
                            <tbody>
                              {leaderboardData.map((p, idx) => (
                                <tr key={p.roster_id || idx} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
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
                                          className="w-6 h-6 rounded-full object-cover border border-gray-700"
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                                          {(p.display_name || p.username || 'P').charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="text-blue-400 font-medium truncate">
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
                                  <td className="px-2 py-3 text-gray-200 font-medium tabular-nums align-middle">
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
                        className="block text-center text-sm text-blue-400 hover:text-blue-300 mt-3 py-2 border-t border-gray-800/50"
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
              <div className="mt-6 space-y-1">
                <h3 className="text-sm text-gray-500 mb-2">More leagues</h3>
                {publicLeagues.slice(2).map((league) => (
                  <Link 
                    key={league.id}
                    to={`/league/${league.id}`}
                    className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-800/30 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500/60" />
                      <span className="text-gray-300 group-hover:text-gray-100">{league.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
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
    </div>
  );
};

export default LandingPage;
