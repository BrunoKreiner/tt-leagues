import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Swords, ArrowRight, User } from 'lucide-react';
import MedalIcon from '@/components/MedalIcon';
import TimelineStats from '@/components/TimelineStats';
import EloSparkline from '@/components/EloSparkline';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI, matchesAPI, usersAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [_stats, setStats] = useState(null);
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
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        setMatchesError(null);
        setLeaguesError(null);
        
        // Fetch all data in parallel - user comes from AuthContext (no extra getMe call)
        const [matchesResponse, leaguesResponse, statsResponse] = await Promise.allSettled([
          matchesAPI.getAll({ limit: 5, status: 'accepted' }, { ttlMs: 10000 }),
          leaguesAPI.getAll({ limit: 10 }, { ttlMs: 10000 }),
          user?.id ? usersAPI.getStats(user.id, { ttlMs: 15000 }) : Promise.reject(new Error('no user id'))
        ]);

        if (statsResponse.status === 'fulfilled') {
          const statsData = statsResponse.value.data;
          const normalized = statsData?.overall
            ? { ...statsData, avg_elo: statsData.overall.average_elo, win_rate: statsData.overall.win_rate, leagues_count: statsData.overall.leagues_count, matches_played: statsData.overall.matches_played }
            : statsData;
          setStats(normalized);
        }

        if (matchesResponse.status === 'fulfilled') {
          const matchesData = matchesResponse.value.data?.matches;
          setRecentMatches(Array.isArray(matchesData) ? matchesData : []);
        } else {
          const apiMessage = matchesResponse.reason?.response?.data?.error;
          setMatchesError(typeof apiMessage === 'string' && apiMessage.length > 0 ? apiMessage : 'Failed to load matches');
        }

        if (leaguesResponse.status === 'fulfilled') {
          const leagueData = leaguesResponse.value.data?.leagues;
          // Use backend-provided membership flag
          const leagues = Array.isArray(leagueData)
            ? leagueData.filter((league) => !!league.is_member)
            : [];
          setUserLeagues(leagues);
          if (leagues.length === 0) {
            setLeagueLeaderboards({});
            setLeaderboardStatus({});
          }
        } else {
          const apiMessage = leaguesResponse.reason?.response?.data?.error;
          setLeaguesError(typeof apiMessage === 'string' && apiMessage.length > 0 ? apiMessage : 'Failed to load leagues');
        }
        
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        const apiMessage = error?.response?.data?.error;
        setLoadError(typeof apiMessage === 'string' && apiMessage.length > 0 ? apiMessage : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (loading) return;
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
  }, [loading]);

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
          leaguesAPI.getLeaderboard(league.id, { page: 1, limit: 5, include_badges: false }, { ttlMs: 10000 })
        )
      );
      const leaderboardMap = {};
      const nextStatus = {};
      leaderboardResults.forEach((result, index) => {
        const leagueId = leaderboardLeagues[index]?.id;
        if (!leagueId) return;
        if (result.status === 'fulfilled') {
          const data = result.value.data?.leaderboard;
          leaderboardMap[leagueId] = Array.isArray(data) ? data : [];
          nextStatus[leagueId] = { status: 'loaded' };
        } else {
          console.error(`Failed to load leaderboard for league ${leagueId}:`, result.reason);
          nextStatus[leagueId] = { status: 'error' };
        }
      });
      setLeagueLeaderboards((prev) => ({ ...prev, ...leaderboardMap }));
      setLeaderboardStatus((prev) => ({ ...prev, ...nextStatus }));
    };

    loadLeaderboards();
  }, [leaderboardLeagues, shouldLoadLeaderboards]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('common.error')}</CardTitle>
          <CardDescription className="text-red-500">{loadError}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-10 animate-fade-in max-w-7xl mx-auto">
      {/* Header: Username */}
      <div className="flex items-center justify-center gap-4 flex-wrap py-6 bg-gray-800/20 rounded-xl border border-gray-700/30">
        <h1 className="cyberpunk-title text-3xl sm:text-4xl bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
          {user?.first_name || user?.username}
        </h1>
        <Link to="/app/profile" className="text-gray-400 hover:text-blue-400 transition-colors">
          <User className="h-5 w-5" />
        </Link>
        <Button asChild variant="outline" size="sm" className="border-gray-700 hover:border-blue-500/50 hover:bg-blue-500/10">
          <Link to="/app/profile">
            {t('cta.viewProfile')}
          </Link>
        </Button>
      </div>

      {/* Section 1: Timeline Statistics */}
      <div className="space-y-6">
        <h2 className="cyberpunk-title text-2xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Performance Overview
        </h2>
        <TimelineStats userId={user?.id} />
      </div>

      {/* Section 2: Recent Matches */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="cyberpunk-title text-2xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Recent Matches
          </h2>
          <Link to="/app/matches" className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {matchesError ? (
          <div className="text-center py-4">
            <p className="text-sm text-red-400">{matchesError}</p>
          </div>
        ) : recentMatches.length > 0 ? (
          <div className="relative">
            {/* Left Arrow */}
            <button
              className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 text-gray-400 hover:text-blue-400 transition-colors text-2xl bg-gray-900/90 backdrop-blur-sm rounded-full w-8 h-8 flex items-center justify-center border border-gray-700 hover:border-blue-500/50"
              onClick={() => {
                const container = document.getElementById('dashboard-matches-scroll');
                if (container) container.scrollLeft -= 250;
              }}
              aria-label="Scroll left"
            >
              ‹
            </button>

            {/* Right Arrow */}
            <button
              className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 text-gray-400 hover:text-blue-400 transition-colors text-2xl bg-gray-900/90 backdrop-blur-sm rounded-full w-8 h-8 flex items-center justify-center border border-gray-700 hover:border-blue-500/50"
              onClick={() => {
                const container = document.getElementById('dashboard-matches-scroll');
                if (container) container.scrollLeft += 250;
              }}
              aria-label="Scroll right"
            >
              ›
            </button>

            {/* Matches Container */}
            <div
              id="dashboard-matches-scroll"
              className="overflow-x-auto scrollbar-hide px-10"
              style={{ scrollBehavior: 'smooth' }}
            >
              <div className="flex gap-4 min-w-max py-2 justify-center">
                {recentMatches.slice(0, 5).map((match) => {
                  const player1Won = match.player1_sets_won > match.player2_sets_won;
                  const player2Won = match.player2_sets_won > match.player1_sets_won;

                  return (
                    <div
                      key={match.id}
                      className="flex flex-col items-center min-w-fit px-4 py-3 bg-gray-800/30 rounded-lg border border-gray-700/50 hover:border-gray-600/50 hover:bg-gray-800/50 transition-all"
                    >
                      {/* Players and Score Line */}
                      <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                        {match.player1_username ? (
                          <Link
                            to={`/app/profile/${match.player1_username}`}
                            className="text-blue-400 hover:text-blue-300 font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {match.player1_display_name || match.player1_username}
                          </Link>
                        ) : (
                          <span className="text-blue-400 font-medium">{match.player1_display_name || 'Player 1'}</span>
                        )}
                        <span className={`font-bold text-lg ${player1Won ? 'text-green-400' : 'text-gray-300'}`}>{match.player1_sets_won}</span>
                        <span className="text-gray-500 font-bold">-</span>
                        <span className={`font-bold text-lg ${player2Won ? 'text-green-400' : 'text-gray-300'}`}>{match.player2_sets_won}</span>
                        {match.player2_username ? (
                          <Link
                            to={`/app/profile/${match.player2_username}`}
                            className="text-blue-400 hover:text-blue-300 font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {match.player2_display_name || match.player2_username}
                          </Link>
                        ) : (
                          <span className="text-blue-400 font-medium">{match.player2_display_name || 'Player 2'}</span>
                        )}
                      </div>
                      
                      {/* ELO Points Line */}
                      <div className="flex items-center gap-1 text-xs whitespace-nowrap mt-0.5">
                        {match.elo_applied ? (
                          <>
                            <span className={`font-medium ${player1Won ? 'text-green-400' : player2Won ? 'text-red-400' : 'text-gray-400'}`}>
                              {match.player1_elo_before || 'N/A'}
                              {match.player1_elo_after && match.player1_elo_before && (
                                <span className={match.player1_elo_after > match.player1_elo_before ? 'text-green-400' : 'text-red-400'}>
                                  {match.player1_elo_after > match.player1_elo_before ? ' (+' : ' ('}
                                  {match.player1_elo_after - match.player1_elo_before}
                                  {match.player1_elo_after > match.player1_elo_before ? ')' : ')'}
                                </span>
                              )}
                            </span>
                            <span className="text-gray-500">vs</span>
                            <span className={`font-medium ${player2Won ? 'text-green-400' : player1Won ? 'text-red-400' : 'text-gray-400'}`}>
                              {match.player2_elo_before || 'N/A'}
                              {match.player2_elo_after && match.player2_elo_before && (
                                <span className={match.player2_elo_after > match.player2_elo_before ? 'text-green-400' : 'text-red-400'}>
                                  {match.player2_elo_after > match.player2_elo_before ? ' (+' : ' ('}
                                  {match.player2_elo_after - match.player2_elo_before}
                                  {match.player2_elo_after > match.player2_elo_before ? ')' : ')'}
                                </span>
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="text-yellow-500/80 font-medium text-[11px]">Pending ELO</span>
                        )}
                      </div>
                      
                      {/* Date and League Line */}
                      <Link
                        to={`/app/matches/${match.id}`}
                        className="text-[11px] text-gray-400 hover:text-blue-400 mt-1 text-center transition-colors"
                      >
                        {formatDate(match.played_at)} • {match.league_name || 'Unknown'}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <Swords className="h-6 w-6 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm mb-3">No matches yet</p>
            <Button asChild variant="outline">
              <Link to="/app/profile">
                {t('cta.viewProfile')}
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Section 3: Leaderboards (ref triggers lazy-load via IntersectionObserver) */}
      <div ref={leaderboardSectionRef} className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="cyberpunk-title text-2xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Leaderboards</h2>
          <Link
            to="/app/leagues"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            Browse all leagues <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {leaguesError && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>{t('common.error')}</CardTitle>
              <CardDescription className="text-red-500">{leaguesError}</CardDescription>
            </CardHeader>
          </Card>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {userLeagues.map((league) => (
            <Card
              key={league.id}
              className="vg-card cursor-pointer hover:scale-[1.02] transition-all bg-gray-800/30 border-gray-700/50 hover:border-gray-600/50 hover:shadow-lg hover:shadow-blue-500/10"
              onClick={() => navigate(`/app/leagues/${league.id}`)}
            >
              <CardHeader className="compact-card-header">
                <CardTitle className="cyberpunk-subtitle flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  {league.name}
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {league.member_count} members • {league.match_count} matches
                </CardDescription>
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
                      <p className="text-sm text-red-400">{t('leagues.leaderboardError')}</p>
                    );
                  }

                  if (leaderboardData.length === 0) {
                    return <p className="text-sm text-gray-400">{t('leagues.noPlayers')}</p>;
                  }

                  return (
                    <div className="space-y-2">
                      {leaderboardData.slice(0, 5).map((player) => (
                        <div 
                          key={player.roster_id || player.user_id} 
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 flex items-center justify-center shrink-0">
                              {player.rank <= 3 ? (
                                <MedalIcon rank={player.rank} size={player.rank === 1 ? 28 : 24} userAvatar={player.avatar_url} />
                              ) : (
                                <span className="text-sm text-gray-400 text-center tabular-nums">{player.rank}.</span>
                              )}
                            </div>
                            {player.username ? (
                              <Link 
                                to={`/app/profile/${player.username}`} 
                                className="text-sm font-medium text-blue-400 hover:text-blue-300"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {player.display_name || player.username}
                              </Link>
                            ) : (
                              <span
                                className="text-sm font-medium text-blue-400"
                                title="No user assigned"
                              >
                                {player.display_name || 'No user assigned'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {player.user_id ? (
                              <EloSparkline
                                userId={player.user_id}
                                leagueId={league.id}
                                width={56}
                                height={14}
                                points={15}
                              />
                            ) : player.roster_id ? (
                              <EloSparkline
                                rosterId={player.roster_id}
                                leagueId={league.id}
                                width={56}
                                height={14}
                                points={15}
                              />
                            ) : (
                              <span className="text-xs text-gray-500">—</span>
                            )}
                            <span className="text-sm text-gray-400 tabular-nums shrink-0 w-10 text-right">{player.current_elo}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>


    </div>
  );
};

export default DashboardPage;

