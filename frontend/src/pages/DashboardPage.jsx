import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Swords, TrendingUp, Plus, Calendar } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { leaguesAPI, matchesAPI, authAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

const DashboardPage = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
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
        // Use backend-provided membership flag
        setUserLeagues(leaguesResponse.data.leagues?.filter((league) => !!league.is_member) || []);
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
    <div className="space-y-4">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('welcome', { name: user?.first_name })}
        </h1>
        <p className="text-muted-foreground">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Compact stats chips */}
      <div className="flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm bg-muted/40">
          <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{t('stats.leagues', { count: stats?.leagues_count || 0 })}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm bg-muted/40">
          <Swords className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{t('stats.matches', { count: stats?.matches_played || 0 })}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm bg-muted/40">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{t('stats.wins', { wins: stats?.matches_won || 0, rate: stats?.win_rate || 0 })}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm bg-muted/40">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">Avg ELO 1200</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Matches */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t('nav.matches')}</h2>
            <Link to="/matches" className="text-xs text-primary underline">{t('nav.matches')}</Link>
          </div>
          {recentMatches.length > 0 ? (
            <div className="space-y-2">
              {recentMatches.map((match) => (
                <div key={match.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <div className="font-medium text-sm">
                        {match.player1_username} vs {match.player2_username}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {match.league_name} • {formatDate(match.played_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={match.winner_id === user?.id ? 'default' : 'secondary'}>
                      {match.player1_sets_won}-{match.player2_sets_won}
                    </Badge>
                    {match.winner_id === user?.id && (
                      <Badge variant="outline" className="text-green-600">Won</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Swords className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('notifications.none')}</p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/matches">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('cta.recordMatch')}
                </Link>
              </Button>
            </div>
          )}
        </section>

        {/* My Leagues */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t('nav.leagues')}</h2>
            <Link to="/leagues" className="text-xs text-primary underline">{t('nav.leagues')}</Link>
          </div>
          {userLeagues.length > 0 ? (
            <div className="space-y-2">
              {userLeagues.slice(0, 5).map((league) => (
                <div key={league.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-6 w-6 text-primary" />
                    <div className="flex flex-col">
                      <div className="font-medium text-sm">{league.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {league.member_count} members • {league.match_count} matches
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/leagues/${league.id}`}>{t('cta.viewProfile')}</Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('notifications.none')}</p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/leagues">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('cta.browseLeagues')}
                </Link>
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* Compact Actions Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/matches">
            <Swords className="h-4 w-4 mr-2" />
            {t('cta.recordMatch')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/leagues">
            <Trophy className="h-4 w-4 mr-2" />
            {t('cta.browseLeagues')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/profile">
            <Users className="h-4 w-4 mr-2" />
            {t('cta.viewProfile')}
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default DashboardPage;

