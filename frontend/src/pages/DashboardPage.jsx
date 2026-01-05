import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Swords, TrendingUp, Plus, Calendar, Target, Award, ArrowRight, User } from 'lucide-react';
import MedalIcon from '@/components/MedalIcon';
import EloSparkline from '@/components/EloSparkline';
import TimelineStats from '@/components/TimelineStats';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI, matchesAPI, authAPI, usersAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

const DashboardPage = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [_stats, setStats] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const [userLeagues, setUserLeagues] = useState([]);
  const [leagueLeaderboards, setLeagueLeaderboards] = useState({});

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch base data
        const [userResponse, matchesResponse, leaguesResponse] = await Promise.all([
          authAPI.getMe(),
          matchesAPI.getAll({ limit: 5, status: 'accepted' }),
          leaguesAPI.getAll({ limit: 10 })
        ]);

        // Fetch up-to-date user stats (authoritative source)
        try {
          const statsRes = await usersAPI.getStats(userResponse.data.user.id);
          // Normalize to have a stable shape
          const normalized = statsRes.data?.overall
            ? { ...statsRes.data, avg_elo: statsRes.data.overall.average_elo, win_rate: statsRes.data.overall.win_rate, leagues_count: statsRes.data.overall.leagues_count, matches_played: statsRes.data.overall.matches_played }
            : statsRes.data;
          setStats(normalized);
        } catch (e) {
          console.error('Failed to load user stats, falling back to /auth/me stats', e);
          const s = userResponse.data.stats || null;
          const normalized = s?.overall
            ? { ...s, avg_elo: s.overall.average_elo, win_rate: s.overall.win_rate, leagues_count: s.overall.leagues_count, matches_played: s.overall.matches_played }
            : s;
          setStats(normalized);
        }
        setRecentMatches(matchesResponse.data.matches || []);
        // Use backend-provided membership flag
        const leagues = leaguesResponse.data.leagues?.filter((league) => !!league.is_member) || [];
        setUserLeagues(leagues);
        
        // Fetch leaderboards for all user leagues
        const leaderboardPromises = leagues.map(async (league) => {
          try {
            const res = await leaguesAPI.getLeaderboard(league.id, { page: 1, limit: 5 });
            return { leagueId: league.id, data: res.data?.leaderboard || [] };
          } catch (e) {
            console.error(`Failed to load leaderboard for league ${league.id}:`, e);
            return { leagueId: league.id, data: [] };
          }
        });
        
        const leaderboardResults = await Promise.all(leaderboardPromises);
        const leaderboardMap = {};
        leaderboardResults.forEach(({ leagueId, data }) => {
          leaderboardMap[leagueId] = data;
        });
        setLeagueLeaderboards(leaderboardMap);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
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
    <div className="space-y-8 animate-fade-in">
      {/* Header: Username */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <h1 className="cyberpunk-title text-4xl text-blue-300">
          {user?.first_name || user?.username}
        </h1>
        <Link to="/profile" className="text-blue-400 hover:text-blue-300 transition-colors">
          <User className="h-6 w-6" />
        </Link>
        <Button asChild variant="outline" className="ml-2">
          <Link to="/profile">
            {t('cta.viewProfile')}
          </Link>
        </Button>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-800"></div>

      {/* Section 1: Timeline Statistics */}
      <div>
        <TimelineStats userId={user?.id} />
      </div>

      {/* Divider */}
      <div className="border-t border-gray-800"></div>

      {/* Section 2: Recent Matches */}
      <div>
        {recentMatches.length > 0 ? (
          <div className="relative mx-2">
            {/* Left Arrow */}
            <button 
              className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 text-gray-400 hover:text-gray-300 text-xl font-bold bg-gray-900/80 rounded-full w-6 h-6 flex items-center justify-center"
              onClick={() => {
                const container = document.getElementById('dashboard-matches-scroll');
                if (container) container.scrollLeft -= 200;
              }}
            >
              ‹
            </button>
            
            {/* Right Arrow */}
            <button 
              className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 text-gray-400 hover:text-gray-300 text-xl font-bold bg-gray-900/80 rounded-full w-6 h-6 flex items-center justify-center"
              onClick={() => {
                const container = document.getElementById('dashboard-matches-scroll');
                if (container) container.scrollLeft += 200;
              }}
            >
              ›
            </button>
            
            {/* Matches Container */}
            <div 
              id="dashboard-matches-scroll"
              className="overflow-x-auto scrollbar-hide px-8"
              style={{ scrollBehavior: 'smooth' }}
            >
              <div className="flex gap-3 min-w-max py-2 justify-center">
                {recentMatches.slice(0, 5).map((match) => {
                  const player1Won = match.player1_sets_won > match.player2_sets_won;
                  const player2Won = match.player2_sets_won > match.player1_sets_won;
                  
                  return (
                    <div key={match.id} className="flex flex-col items-center min-w-fit px-1">
                      {/* Score Line */}
                      <div className="flex items-center gap-1 text-sm whitespace-nowrap">
                        <Link to={`/profile/${match.player1_username}`} className="text-blue-400 hover:text-blue-300">
                          {match.player1_username}
                        </Link>
                        <span className="text-gray-300 font-bold">{match.player1_sets_won}</span>
                        <span className="text-gray-500">:</span>
                        <span className="text-gray-300 font-bold">{match.player2_sets_won}</span>
                        <Link to={`/profile/${match.player2_username}`} className="text-blue-400 hover:text-blue-300">
                          {match.player2_username}
                        </Link>
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
                          <span className="text-yellow-400 font-medium">Pending ELO calculation</span>
                        )}
                      </div>
                      
                      {/* Date and League Line */}
                      <div className="text-xs text-gray-500 mt-0.5 text-center">
                        {formatDate(match.played_at)} • {match.league_name || 'Unknown'}
                      </div>
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
              <Link to="/profile">
                {t('cta.viewProfile')}
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-800"></div>

      {/* Section 3: Leaderboards */}
      <div>
        <div className="flex items-center justify-between mb-4 gap-4">
          <h2 className="cyberpunk-title text-2xl text-purple-300">Leaderboards</h2>
          <Link to="/leagues" className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2 whitespace-nowrap">
            Browse all leagues <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {userLeagues.map((league) => (
            <Card 
              key={league.id} 
              className="vg-card cursor-pointer hover:scale-105 transition-transform"
              onClick={() => window.location.href = `/leagues/${league.id}`}
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
                {leagueLeaderboards[league.id]?.length > 0 ? (
                  <div className="space-y-2">
                    {leagueLeaderboards[league.id].slice(0, 5).map((player) => (
                      <div 
                        key={player.id} 
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {player.rank <= 3 ? (
                            <MedalIcon rank={player.rank} size={24} userAvatar={player.avatar_url} />
                          ) : (
                            <span className="text-sm text-gray-400 w-6 text-center">{player.rank}</span>
                          )}
                          <Link 
                            to={`/profile/${player.username}`} 
                            className="text-sm font-medium text-blue-400 hover:text-blue-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {player.username}
                          </Link>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">{player.current_elo}</span>
                          <div className="w-12 h-6">
                            <EloSparkline 
                              userId={player.id} 
                              leagueId={league.id} 
                              width={48} 
                              height={16} 
                              points={15} 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">{t('leagues.noPlayers')}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>


    </div>
  );
};

export default DashboardPage;

