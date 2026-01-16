import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ListChecks, Calendar, ArrowLeft, TrendingUp, Globe, Swords } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI } from '../services/api';
import MedalIcon from '@/components/MedalIcon';
import EloSparkline from '@/components/EloSparkline';
import LeagueEloTimeline from '@/components/LeagueEloTimeline';
import { format } from 'date-fns';
import { BadgeList } from '@/components/BadgeDisplay';
import SiteFooter from '@/components/layout/SiteFooter';

const PublicLeaguePage = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const [league, setLeague] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaderboardStatus, setLeaderboardStatus] = useState('idle');
  const [leaderboardError, setLeaderboardError] = useState(null);
  const [matchesStatus, setMatchesStatus] = useState('idle');
  const [matchesError, setMatchesError] = useState(null);
  const [eloRange, setEloRange] = useState(null);

  useEffect(() => {
    const fetchLeagueData = async () => {
      try {
        setLoading(true);
        setError(null);
        setLeaderboardError(null);
        setMatchesError(null);
        setLeaderboardStatus('loading');
        setMatchesStatus('loading');
        
        const [leagueRes, leaderboardRes, matchesRes, eloRangeRes] = await Promise.allSettled([
          leaguesAPI.getById(id, { ttlMs: 15000 }),
          leaguesAPI.getLeaderboard(id, { limit: 20 }, { ttlMs: 10000 }),
          leaguesAPI.getMatches(id, { limit: 10 }, { ttlMs: 10000 }),
          leaguesAPI.getEloRange(id, { ttlMs: 10000 }),
        ]);

        if (leagueRes.status === 'rejected') {
          throw leagueRes.reason;
        }

        setLeague(leagueRes.value.data.league);
        if (leaderboardRes.status === 'fulfilled') {
          const leaderboardData = leaderboardRes.value.data?.leaderboard;
          setLeaderboard(Array.isArray(leaderboardData) ? leaderboardData : []);
          setLeaderboardStatus('loaded');
        } else {
          setLeaderboardStatus('error');
          const apiMessage = leaderboardRes.reason?.response?.data?.error;
          setLeaderboardError(typeof apiMessage === 'string' && apiMessage.length > 0 ? apiMessage : 'Failed to load leaderboard');
        }

        // Matches may be restricted for unauthenticated users; treat that as non-fatal.
        if (matchesRes.status === 'fulfilled') {
          const matchData = matchesRes.value.data?.matches;
          setMatches(Array.isArray(matchData) ? matchData : []);
          setMatchesStatus('loaded');
        } else {
          const status = matchesRes.reason?.response?.status;
          if (status === 403) {
            setMatchesStatus('restricted');
            setMatchesError('Matches are only visible to league members');
          } else {
            setMatchesStatus('error');
            const apiMessage = matchesRes.reason?.response?.data?.error;
            setMatchesError(typeof apiMessage === 'string' && apiMessage.length > 0 ? apiMessage : 'Failed to load matches');
          }
        }

        if (eloRangeRes.status === 'fulfilled') {
          setEloRange(eloRangeRes.value.data);
        } else {
          setEloRange(null);
        }
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
        <div className="space-y-4 mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="cyberpunk-title text-3xl text-blue-300">{league?.name}</h1>
              {league?.created_by_username && league?.created_at ? (
                <p className="cyberpunk-text text-gray-400">
                  Created by {league.created_by_username} • {format(new Date(league.created_at), 'PPP')}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {league?.description ? (
                <span className="max-w-full text-sm text-gray-300 px-2 py-1 bg-gray-800 rounded border border-gray-700 break-words">
                  {league.description}
                </span>
              ) : null}
              <Badge variant="secondary" className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                Public
              </Badge>
              {league?.season ? (
                <Badge variant="outline">Season: {league.season}</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" /> {league?.member_count || 0} members
            </span>
            <span className="flex items-center gap-1">
              <ListChecks className="h-4 w-4" /> {league?.match_count || 0} matches
            </span>
            {league?.season ? (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" /> {league.season}
              </span>
            ) : null}
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
                {leaderboardStatus === 'loading' ? (
                  <div className="flex items-center justify-center py-6">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : leaderboardStatus === 'error' ? (
                  <p className="text-sm text-red-400 text-center py-6">
                    {typeof leaderboardError === 'string' && leaderboardError.length > 0
                      ? leaderboardError
                      : t('leagues.leaderboardError')}
                  </p>
                ) : leaderboard.length > 0 ? (
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
            <div className="mt-6">
              <LeagueEloTimeline
                leagueId={id}
                players={leaderboard}
                playersStatus={leaderboardStatus}
                playersError={leaderboardError}
                eloRange={eloRange}
              />
            </div>
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
                {matchesStatus === 'loading' ? (
                  <div className="flex items-center justify-center py-6">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : matchesStatus === 'error' || matchesStatus === 'restricted' ? (
                  <p className="text-sm text-gray-500 text-center py-6">
                    {typeof matchesError === 'string' && matchesError.length > 0
                      ? matchesError
                      : 'Matches are not available yet'}
                  </p>
                ) : matches.length > 0 ? (
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

      <SiteFooter />
    </div>
  );
};

export default PublicLeaguePage;
