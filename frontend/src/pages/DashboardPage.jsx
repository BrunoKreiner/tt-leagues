import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Swords, TrendingUp, Plus, Calendar } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI, matchesAPI, authAPI } from '../services/api';

const DashboardPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const [userLeagues, setUserLeagues] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch user stats
        const [userResponse, matchesResponse, leaguesResponse] = await Promise.all([
          authAPI.getMe(),
          matchesAPI.getAll({ limit: 5, status: 'accepted' }),
          leaguesAPI.getAll({ limit: 10 })
        ]);

        setStats(userResponse.data.stats);
        setRecentMatches(matchesResponse.data.matches || []);
        setUserLeagues(leaguesResponse.data.leagues?.filter(league => 
          league.member_count > 0 // This is a simplified filter - in real app you'd check membership
        ) || []);
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
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {user?.first_name}!
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening in your table tennis leagues.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leagues Joined</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.leagues_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active memberships
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matches Played</CardTitle>
            <Swords className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.matches_played || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total matches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matches Won</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.matches_won || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.win_rate || 0}% win rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average ELO</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1200</div>
            <p className="text-xs text-muted-foreground">
              Across all leagues
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Matches */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Matches</CardTitle>
            <CardDescription>
              Your latest match results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentMatches.length > 0 ? (
              <div className="space-y-4">
                {recentMatches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex flex-col">
                        <div className="font-medium text-sm">
                          {match.player1_username} vs {match.player2_username}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {match.league_name} • {formatDate(match.played_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={match.winner_id === user?.id ? "default" : "secondary"}>
                        {match.player1_sets_won}-{match.player2_sets_won}
                      </Badge>
                      {match.winner_id === user?.id && (
                        <Badge variant="outline" className="text-green-600">
                          Won
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Swords className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No matches played yet</p>
                <Button asChild className="mt-4">
                  <Link to="/matches">
                    <Plus className="h-4 w-4 mr-2" />
                    Record a Match
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Leagues */}
        <Card>
          <CardHeader>
            <CardTitle>My Leagues</CardTitle>
            <CardDescription>
              Leagues you're participating in
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userLeagues.length > 0 ? (
              <div className="space-y-4">
                {userLeagues.slice(0, 5).map((league) => (
                  <div key={league.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Trophy className="h-8 w-8 text-primary" />
                      <div className="flex flex-col">
                        <div className="font-medium text-sm">{league.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {league.member_count} members • {league.match_count} matches
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/leagues/${league.id}`}>
                        View
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No leagues joined yet</p>
                <Button asChild className="mt-4">
                  <Link to="/leagues">
                    <Plus className="h-4 w-4 mr-2" />
                    Browse Leagues
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks to get you started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/matches">
                <Swords className="h-6 w-6 mb-2" />
                Record Match
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/leagues">
                <Trophy className="h-6 w-6 mb-2" />
                Browse Leagues
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/profile">
                <Users className="h-6 w-6 mb-2" />
                View Profile
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;

