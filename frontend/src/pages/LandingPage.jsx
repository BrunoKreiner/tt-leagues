import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Users, Swords, ChevronRight } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI } from '../services/api';
import MedalIcon from '@/components/MedalIcon';
import EloSparkline from '@/components/EloSparkline';

const LandingPage = () => {
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [leagueLeaderboards, setLeagueLeaderboards] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicLeagues = async () => {
      try {
        setLoading(true);
        const response = await leaguesAPI.getAll({ limit: 4 });
        const leagues = response.data.leagues?.filter(l => l.is_public) || [];
        setPublicLeagues(leagues);
        
        // Fetch leaderboards for each league
        const leaderboardPromises = leagues.slice(0, 2).map(async (league) => {
          try {
            const res = await leaguesAPI.getLeaderboard(league.id, { limit: 5 });
            return { leagueId: league.id, data: res.data?.leaderboard || [] };
          } catch (e) {
            return { leagueId: league.id, data: [] };
          }
        });
        
        const results = await Promise.all(leaderboardPromises);
        const map = {};
        results.forEach(({ leagueId, data }) => {
          map[leagueId] = data;
        });
        setLeagueLeaderboards(map);
      } catch (error) {
        console.error('Failed to fetch public leagues:', error);
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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800/50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-400" />
              <span className="cyberpunk-title text-base text-gray-100">Leagues</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild className="text-gray-400 hover:text-white">
                <Link to="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild className="bg-blue-600 hover:bg-blue-500">
                <Link to="/register">Get started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 pb-12 px-4">
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
          <section className="text-center space-y-2 py-4 border-t border-b border-gray-800/50">
            <div className="text-sm text-gray-400">
              <span className="text-gray-500">Coming soon:</span> {comingSoon.join(' · ')}
            </div>
            <div className="text-emerald-400 font-medium">Free to use · No ads</div>
          </section>

          {/* Public Leagues with Leaderboards */}
          <section>
            <h2 className="cyberpunk-title text-lg text-gray-300 mb-4">Public Leagues</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            ) : publicLeagues.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {publicLeagues.slice(0, 2).map((league) => (
                  <Card key={league.id} className="vg-card">
                    <CardHeader className="pb-3">
                      <Link to={`/league/${league.id}`} className="group">
                        <CardTitle className="cyberpunk-subtitle text-lg text-gray-100 flex items-center gap-2 group-hover:text-blue-400 transition-colors">
                          <Trophy className="h-5 w-5 text-yellow-500" />
                          {league.name}
                        </CardTitle>
                      </Link>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" /> {league.member_count || 0} members
                        </span>
                        <span className="flex items-center gap-1">
                          <Swords className="h-4 w-4" /> {league.match_count || 0} matches
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {leagueLeaderboards[league.id]?.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-400 border-b border-gray-700">
                                <th className="px-2 py-2 font-medium">Rank</th>
                                <th className="px-2 py-2 font-medium">Player</th>
                                <th className="px-2 py-2 font-medium">ELO</th>
                                <th className="px-2 py-2 font-medium">Trend</th>
                                <th className="px-2 py-2 font-medium text-right">W/L</th>
                              </tr>
                            </thead>
                            <tbody>
                              {leagueLeaderboards[league.id].map((p, idx) => (
                                <tr key={p.roster_id || idx} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                                  <td className="px-2 py-3 align-middle">
                                    {p.rank <= 3 ? (
                                      <MedalIcon rank={p.rank} size={p.rank === 1 ? 32 : 28} />
                                    ) : (
                                      <span className="text-gray-300 text-sm font-bold">{p.rank}.</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-3 align-middle">
                                    <div className="flex items-center gap-2">
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
                                      <span className="text-blue-400 font-medium">
                                        {p.display_name || p.username || 'Player'}
                                      </span>
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
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-3">No players yet</p>
                      )}
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

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-gray-800/30">
        <div className="max-w-5xl mx-auto flex items-center justify-center text-sm text-gray-600">
          <span>🏆</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
