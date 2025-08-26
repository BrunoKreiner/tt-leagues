import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { leaguesAPI } from '@/services/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Users, ListChecks, Calendar, Lock, Globe, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const LeagueDetailPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [league, setLeague] = useState(null);
  const [userMembership, setUserMembership] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [members, setMembers] = useState([]);
  const [matches, setMatches] = useState([]);
  const { isAuthenticated } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const leagueP = leaguesAPI.getById(id);
        const leaderboardP = leaguesAPI.getLeaderboard(id);
        const matchesP = leaguesAPI.getMatches(id, { page: 1, limit: 10 });
        const membersP = isAuthenticated
          ? leaguesAPI.getMembers(id)
          : Promise.resolve({ data: { members: [] } });

        const [leagueRes, leaderboardRes, membersRes, matchesRes] = await Promise.allSettled([
          leagueP,
          leaderboardP,
          membersP,
          matchesP,
        ]);

        if (cancelled) return;

        if (leagueRes.status === 'rejected') {
          const err = leagueRes.reason;
          setError(err?.response?.data?.error || 'Failed to load league');
          return;
        }

        const leagueData = leagueRes.value.data;
        setLeague(leagueData.league);
        setUserMembership(leagueData.user_membership);

        if (leaderboardRes.status === 'fulfilled') {
          setLeaderboard(leaderboardRes.value.data.leaderboard || []);
        } else {
          setLeaderboard([]);
        }

        if (membersRes.status === 'fulfilled') {
          setMembers(membersRes.value.data.members || []);
        } else {
          setMembers([]);
        }

        if (matchesRes.status === 'fulfilled') {
          setMatches(matchesRes.value.data.matches || []);
        } else {
          setMatches([]);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.error || 'Failed to load league');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, isAuthenticated]);

  const eloDiff = (after, before) => {
    if (after == null || before == null) return null;
    const diff = after - before;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}`;
  };

  const refreshLeagueData = async () => {
    try {
      const [leagueRes, membersRes] = await Promise.all([
        leaguesAPI.getById(id),
        isAuthenticated ? leaguesAPI.getMembers(id) : Promise.resolve({ data: { members: [] } }),
      ]);
      setLeague(leagueRes.data.league);
      setUserMembership(leagueRes.data.user_membership);
      setMembers(membersRes.data.members || []);
    } catch (e) {
      // Keep previous state; surface error softly
      console.error('Refresh league data failed', e);
    }
  };

  const handleLeave = async () => {
    try {
      setLeaveLoading(true);
      const res = await leaguesAPI.leave(id);
      toast.success(res.data?.message || 'Left league');
      await refreshLeagueData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to leave league';
      toast.error(msg);
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast.error('Invite code is required');
      return;
    }
    try {
      setJoinLoading(true);
      const res = await leaguesAPI.join(id, inviteCode.trim());
      toast.success(res.data?.message || 'Joined league');
      setInviteCode('');
      await refreshLeagueData();
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || 'Failed to join league';
      if (status === 404) {
        toast.error('Invalid or expired invite code');
      } else if (status === 400) {
        toast.error('Invite code required');
      } else if (status === 409) {
        toast.error('You are already a member of this league');
        // Still refresh in case membership changed concurrently
        await refreshLeagueData();
      } else {
        toast.error(msg);
      }
    } finally {
      setJoinLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteUsername.trim()) {
      toast.error('Username is required');
      return;
    }
    try {
      setInviteLoading(true);
      setInviteResult(null);
      const res = await leaguesAPI.invite(id, { username: inviteUsername.trim() });
      const { message, invite_code, expires_at } = res.data || {};
      toast.success(message || 'Invitation sent');
      setInviteResult({ invite_code, expires_at });
      setInviteUsername('');
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || 'Failed to send invite';
      if (status === 404) {
        toast.error('User not found');
      } else if (status === 409) {
        toast.error('User is already a member or has a pending invite');
      } else if (status === 403) {
        toast.error('Only league admins can invite users');
      } else {
        toast.error(msg);
      }
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription className="text-red-500">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!league) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{league.name}</h1>
          <p className="text-muted-foreground">Created by {league.created_by_username} • {format(new Date(league.created_at), 'PPP')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            {league.is_public ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {league.is_public ? 'Public' : 'Private'}
          </Badge>
          {league.season && <Badge variant="outline">Season: {league.season}</Badge>}
        </div>
      </div>

      {league.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{league.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overview</CardTitle>
            <CardDescription>Key stats</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div className="flex items-center gap-2"><Users className="h-4 w-4" /> Members: {league.member_count}</div>
            <div className="flex items-center gap-2"><ListChecks className="h-4 w-4" /> Matches: {league.match_count}</div>
            {userMembership && (
              <div className="flex items-center gap-2"><Trophy className="h-4 w-4" /> Your ELO: {userMembership.current_elo}</div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Leaderboard (Top {Math.min(10, leaderboard.length)})</CardTitle>
            <CardDescription>Ranked by current ELO</CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>ELO</TableHead>
                    <TableHead>W/L</TableHead>
                    <TableHead>Win%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.slice(0, 10).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.rank}</TableCell>
                      <TableCell>{p.username}</TableCell>
                      <TableCell>{p.current_elo}</TableCell>
                      <TableCell>{p.matches_won}/{p.matches_played - p.matches_won}</TableCell>
                      <TableCell>{p.win_rate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {isAuthenticated && !userMembership && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Join this league</CardTitle>
            <CardDescription>Enter your invite code to join</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleJoin}>
              <Input
                placeholder="Invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                disabled={joinLoading}
              />
              <Button type="submit" disabled={joinLoading}>
                {joinLoading ? 'Joining…' : 'Join'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isAuthenticated && userMembership && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leave this league</CardTitle>
            <CardDescription>You will lose access to members-only data</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={leaveLoading}>
                  {leaveLoading ? 'Leaving…' : 'Leave League'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave league?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will remove you from the league. You may need a new invite to rejoin.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLeave} disabled={leaveLoading}>
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {isAuthenticated && userMembership?.is_admin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a user</CardTitle>
            <CardDescription>Invite by username; generates a code valid for 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleInvite}>
              <Input
                placeholder="Username"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                disabled={inviteLoading}
              />
              <Button type="submit" disabled={inviteLoading}>
                {inviteLoading ? 'Inviting…' : 'Send Invite'}
              </Button>
            </form>
            {inviteResult?.invite_code && (
              <div className="mt-3 text-sm">
                <div className="text-muted-foreground">Invite code:</div>
                <div className="font-mono text-base">{inviteResult.invite_code}</div>
                {inviteResult.expires_at && (
                  <div className="text-muted-foreground">
                    Expires: {format(new Date(inviteResult.expires_at), 'PP p')}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
            <CardDescription>Current participants</CardDescription>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>ELO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.slice(0, 10).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.username}{m.is_league_admin ? ' (admin)' : ''}</TableCell>
                      <TableCell>{m.current_elo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {members.length > 10 && (
              <div className="pt-3">
                <Button asChild variant="outline" size="sm">
                  <Link to="#members">View all</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Matches</CardTitle>
            <CardDescription>Last 10 accepted matches</CardDescription>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Player 1</TableHead>
                    <TableHead>Player 2</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>ELO Δ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.played_at ? format(new Date(m.played_at), 'PP p') : '-'}</TableCell>
                      <TableCell>{m.player1_username}</TableCell>
                      <TableCell>{m.player2_username}</TableCell>
                      <TableCell>{m.player1_sets_won} - {m.player2_sets_won}</TableCell>
                      <TableCell>
                        P1 {eloDiff(m.player1_elo_after, m.player1_elo_before)} / P2 {eloDiff(m.player2_elo_after, m.player2_elo_before)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Members Management Section */}
      <Card id="members">
        <CardHeader>
          <CardTitle className="text-base">All Members</CardTitle>
          <CardDescription>
            Roles and basic stats. {userMembership?.is_admin ? 'As a league admin, you can invite users. Member role management will be added soon.' : 'Contact a league admin for membership changes.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>ELO</TableHead>
                  <TableHead>W/L</TableHead>
                  <TableHead>Win%</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{m.username}</span>
                        {(m.first_name || m.last_name) && (
                          <span className="text-xs text-muted-foreground">{[m.first_name, m.last_name].filter(Boolean).join(' ')}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.is_league_admin ? (
                        <Badge variant="secondary">Admin</Badge>
                      ) : (
                        <Badge variant="outline">Member</Badge>
                      )}
                    </TableCell>
                    <TableCell>{m.current_elo}</TableCell>
                    <TableCell>{m.matches_won}/{m.matches_played - m.matches_won}</TableCell>
                    <TableCell>{m.win_rate}%</TableCell>
                    <TableCell>{m.joined_at ? format(new Date(m.joined_at), 'PP') : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeagueDetailPage;

