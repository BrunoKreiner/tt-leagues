import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Swords, ArrowLeft, TrendingUp } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI } from '../services/api';
import MedalIcon from '@/components/MedalIcon';
import EloSparkline from '@/components/EloSparkline';

const PublicLeaguePage = () => {
  const { id } = useParams();
  const [league, setLeague] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLeagueData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [leagueRes, leaderboardRes, matchesRes] = await Promise.all([
          leaguesAPI.getById(id),
          leaguesAPI.getLeaderboard(id, { limit: 20 }),
          leaguesAPI.getMatches(id, { limit: 10 }),
        ]);
        
        setLeague(leagueRes.data.league);
        setLeaderboard(leaderboardRes.data.leaderboard || []);
        setMatches(matchesRes.data.matches || []);
      } catch (err) {
        console.error('Failed to load league:', err);
        setError(err.response?.data?.error || 'Failed to load league');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchLeagueData();
    }
  }, [id]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <nav className="border-b border-gray-800/50 bg-gray-950/95 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
            <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </Link>
          </div>
        </nav>
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <p className="text-red-400">{error}</p>
          <Button asChild className="mt-4">
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-800/50 bg-gray-950/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="text-gray-400 hover:text-white">
              <Link to="/login">Log in</Link>
            </Button>
            <Button size="sm" asChild className="bg-blue-600 hover:bg-blue-500">
              <Link to="/register">Sign up to join</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* League Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="h-7 w-7 text-yellow-500" />
            <h1 className="cyberpunk-title text-3xl text-gray-100">{league?.name}</h1>
            <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
              Public
            </Badge>
          </div>
          {league?.description && (
            <p className="text-gray-400 mb-4">{league.description}</p>
          )}
          <div className="flex items-center gap-5 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" /> {league?.member_count || 0} members
            </span>
            <span className="flex items-center gap-1">
              <Swords className="h-4 w-4" /> {league?.match_count || 0} matches
            </span>
            {league?.season && <span>Season: {league.season}</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leaderboard */}
          <div className="lg:col-span-2">
            <Card className="vg-card">
              <CardHeader className="pb-3">
                <CardTitle className="cyberpunk-subtitle text-base text-gray-200 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {leaderboard.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="px-3 py-2 font-medium w-16 text-center">Rank</th>
                          <th className="px-3 py-2 font-medium">Player</th>
                          <th className="px-3 py-2 font-medium">ELO</th>
                          <th className="px-3 py-2 font-medium">Trend</th>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">W/L / Win%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((p) => (
                          <tr key={p.roster_id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                            <td className="px-3 py-4 align-middle">
                              <div className="w-10 flex items-center justify-center">
                                {p.rank <= 3 ? (
                                  <MedalIcon rank={p.rank} size={p.rank === 1 ? 36 : 32} />
                                ) : (
                                  <span className="text-gray-300 text-base font-bold tabular-nums">{p.rank}.</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 min-w-0 align-middle">
                              <div className="flex items-center gap-2">
                                {p.avatar_url ? (
                                  <img 
                                    src={p.avatar_url} 
                                    alt="" 
                                    className="w-7 h-7 rounded-full object-cover border border-gray-700"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                                    {(p.display_name || p.username || 'U').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-blue-400 font-medium">
                                  {p.display_name || p.username || 'Unknown'}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-200 font-medium tabular-nums whitespace-nowrap align-middle">
                              {p.current_elo}
                            </td>
                            <td className="px-3 py-2 align-middle">
                              {p.user_id ? (
                                <EloSparkline userId={p.user_id} leagueId={id} width={56} height={14} points={15} />
                              ) : p.roster_id ? (
                                <EloSparkline rosterId={p.roster_id} leagueId={id} width={56} height={14} points={15} />
                              ) : (
                                <span className="text-xs text-gray-500">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-200 tabular-nums whitespace-nowrap align-middle text-xs">
                              <span className="text-gray-300">{p.matches_won}/{(p.matches_played || 0) - (p.matches_won || 0)}</span>
                              <span className="text-gray-600"> • </span>
                              <span>{p.win_rate || 0}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-6">No players yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Matches */}
          <div>
            <Card className="vg-card">
              <CardHeader className="pb-3">
                <CardTitle className="cyberpunk-subtitle text-base text-gray-200 flex items-center gap-2">
                  <Swords className="h-5 w-5 text-purple-400" />
                  Recent Matches
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {matches.length > 0 ? (
                  <div className="space-y-2">
                    {matches.map((match) => (
                      <div key={match.id} className="py-3 border-b border-gray-800/50 last:border-0">
                        <div className="flex items-center justify-between text-sm">
                          <span className={match.player1_sets_won > match.player2_sets_won ? 'text-green-400 font-medium' : 'text-gray-400'}>
                            {match.player1_display_name || match.player1_username || 'P1'}
                          </span>
                          <span className="text-gray-400 font-bold text-base px-2">
                            {match.player1_sets_won} - {match.player2_sets_won}
                          </span>
                          <span className={match.player2_sets_won > match.player1_sets_won ? 'text-green-400 font-medium' : 'text-gray-400'}>
                            {match.player2_display_name || match.player2_username || 'P2'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 text-center mt-1">
                          {formatDate(match.played_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-6">No matches yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sign up CTA */}
        <div className="mt-10 text-center py-8 border-t border-gray-800/50">
          <p className="text-gray-400 mb-4">Want to join this league?</p>
          <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-500">
            <Link to="/register">Create an account</Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default PublicLeaguePage;
