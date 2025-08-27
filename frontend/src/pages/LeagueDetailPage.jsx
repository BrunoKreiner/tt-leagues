import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { leaguesAPI, matchesAPI } from '@/services/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, ListChecks, Calendar, Lock, Globe, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import EloSparkline from '@/components/EloSparkline';
import { useTranslation } from 'react-i18next';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination';
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

const editSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Max 200 characters'),
  description: z.string().max(1000, 'Max 1000 characters').optional().or(z.literal('')),
  is_public: z.boolean().default(true),
  season: z.string().max(100, 'Max 100 characters').optional().or(z.literal('')),
});

const LeagueDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [league, setLeague] = useState(null);
  const [userMembership, setUserMembership] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardPagination, setLeaderboardPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [members, setMembers] = useState([]);
  const [matches, setMatches] = useState([]);
  const { isAuthenticated } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [invites, setInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [roleChanging, setRoleChanging] = useState({}); // { [userId]: true }
  const [revokingInvite, setRevokingInvite] = useState({}); // { [inviteId]: true }
  const [eloMode, setEloMode] = useState('immediate');

  const [consolidating, setConsolidating] = useState(false);

  const form = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: '',
      description: '',
      is_public: true,
      season: '',
    },
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const leagueP = leaguesAPI.getById(id);
        const leaderboardP = leaguesAPI.getLeaderboard(id, { page: 1, limit: 20 });
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
          setError(err?.response?.data?.error || t('leagues.loadError'));
          return;
        }

        const leagueData = leagueRes.value.data;
        setLeague(leagueData.league);
        setUserMembership(leagueData.user_membership);

        if (leaderboardRes.status === 'fulfilled') {
          setLeaderboard(leaderboardRes.value.data.leaderboard || []);
          setLeaderboardPagination(leaderboardRes.value.data.pagination || { page: 1, pages: 1, total: 0, limit: 20 });
        } else {
          setLeaderboard([]);
          setLeaderboardPagination({ page: 1, pages: 1, total: 0, limit: 20 });
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

  // When league loads, populate the edit form defaults
  useEffect(() => {
    if (league) {
      console.log('League data loaded:', league);
      console.log('Current elo_update_mode:', league.elo_update_mode);
      form.reset({
        name: league.name || '',
        description: league.description || '',
        is_public: !!league.is_public,
        season: league.season || '',
      });
      setEloMode(league.elo_update_mode || 'immediate');
      console.log('Set eloMode to:', league.elo_update_mode || 'immediate');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league]);

  const eloDiff = (after, before) => {
    if (after == null || before == null) return null;
    const diff = after - before;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}`;
  };

  const refreshLeagueData = async () => {
    try {
      console.log('Refreshing league data...');
      const [leagueRes, membersRes] = await Promise.all([
        leaguesAPI.getById(id),
        isAuthenticated ? leaguesAPI.getMembers(id) : Promise.resolve({ data: { members: [] } }),
      ]);
      console.log('Refreshed league data:', leagueRes.data.league);
      setLeague(leagueRes.data.league);
      setUserMembership(leagueRes.data.user_membership);
      setMembers(membersRes.data.members || []);
      // Update eloMode state to match the refreshed league data
      const newEloMode = leagueRes.data.league.elo_update_mode || 'immediate';
      console.log('Setting eloMode to:', newEloMode);
      setEloMode(newEloMode);
    } catch (e) {
      // Keep previous state; surface error softly
      console.error('Refresh league data failed', e);
    }
  };

  const fetchLeaderboard = async (page = 1) => {
    try {
      const res = await leaguesAPI.getLeaderboard(id, { page, limit: 20 });
      setLeaderboard(res.data.leaderboard || []);
      setLeaderboardPagination(res.data.pagination || { page: 1, pages: 1, total: 0, limit: 20 });
    } catch (e) {
      console.error('Failed to load leaderboard', e);
      toast.error(t('leagues.leaderboardError'));
    }
  };

  const fetchInvites = async () => {
    if (!isAuthenticated || !userMembership?.is_admin) return;
    try {
      setInvitesLoading(true);
      const res = await leaguesAPI.listInvites(id, { status: 'pending' });
      setInvites(res.data?.invites || []);
    } catch (e) {
      console.error('Failed to load invites', e);
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    // Load pending invites when user is an admin
    if (isAuthenticated && userMembership?.is_admin) {
      fetchInvites();
    } else {
      setInvites([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAuthenticated, userMembership?.is_admin]);

  const handlePromote = async (userId, username) => {
    if (!window.confirm(`Promote ${username} to admin?`)) return;
    try {
      setRoleChanging((m) => ({ ...m, [userId]: true }));
      const res = await leaguesAPI.promoteMember(id, userId);
      toast.success(res.data?.message || t('leagues.promoted'));
      await refreshLeagueData();
    } catch (err) {
      const msg = err.response?.data?.error || t('leagues.promoteError');
      toast.error(msg);
    } finally {
      setRoleChanging((m) => ({ ...m, [userId]: false }));
    }
  };

  const handleDemote = async (userId, username) => {
    const adminCount = members.filter((m) => m.is_league_admin).length;
    if (adminCount <= 1) {
      toast.error('Cannot demote the last remaining admin');
      return;
    }
    if (!window.confirm(`Demote ${username} to member?`)) return;
    try {
      setRoleChanging((m) => ({ ...m, [userId]: true }));
      const res = await leaguesAPI.demoteMember(id, userId);
      toast.success(res.data?.message || 'Admin demoted to member');
      await refreshLeagueData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to demote admin';
      toast.error(msg);
    } finally {
      setRoleChanging((m) => ({ ...m, [userId]: false }));
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    if (!window.confirm(t('leagues.revokeConfirm'))) return;
    try {
      setRevokingInvite((m) => ({ ...m, [inviteId]: true }));
      const res = await leaguesAPI.revokeInvite(id, inviteId);
      toast.success(res.data?.message || t('leagues.inviteRevoked'));
      await fetchInvites();
    } catch (err) {
      const msg = err.response?.data?.error || t('leagues.revokeError');
      toast.error(msg);
    } finally {
      setRevokingInvite((m) => ({ ...m, [inviteId]: false }));
    }
  };

  const handleUpdate = async (values) => {
    try {
      setUpdateLoading(true);
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        is_public: !!values.is_public,
        season: values.season?.trim() || undefined,
        elo_update_mode: eloMode,
      };
      console.log('Updating league with payload:', payload);
      console.log('Current eloMode state:', eloMode);
      await leaguesAPI.update(id, payload);
      toast.success(t('leagues.updated'));
      // Add a small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      await refreshLeagueData();
    } catch (err) {
      console.error('League update error:', err);
      console.error('Error response:', err.response);
      const status = err.response?.status;
      const msg = err.response?.data?.error || t('leagues.updateError');
      if (status === 409) {
        toast.error(t('admin.nameExists'));
        form.setError('name', { message: t('admin.nameExists') });
      } else if (status === 403) {
        toast.error(t('leagues.onlyAdminsEdit'));
      } else {
        toast.error(msg);
      }
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleLeave = async () => {
    try {
      setLeaveLoading(true);
      const res = await leaguesAPI.leave(id);
      toast.success(res.data?.message || t('leagues.left'));
      await refreshLeagueData();
    } catch (err) {
      const msg = err.response?.data?.error || t('leagues.leaveError');
      toast.error(msg);
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast.error(t('leagues.inviteCodeRequired'));
      return;
    }
    try {
      setJoinLoading(true);
      const res = await leaguesAPI.join(id, inviteCode.trim());
      toast.success(res.data?.message || t('notifications.joinedLeague'));
      setInviteCode('');
      await refreshLeagueData();
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || t('leagues.joinError');
      if (status === 404) {
        toast.error(t('leagues.inviteInvalid'));
      } else if (status === 400) {
        toast.error(t('leagues.inviteCodeRequired'));
      } else if (status === 409) {
        toast.error(t('leagues.alreadyMember'));
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
      toast.error(t('leagues.usernameRequired'));
      return;
    }
    try {
      setInviteLoading(true);
      setInviteResult(null);
      const res = await leaguesAPI.invite(id, { username: inviteUsername.trim() });
      const { message, invite_code, expires_at } = res.data || {};
      toast.success(message || t('leagues.inviteSent'));
      setInviteResult({ invite_code, expires_at });
      setInviteUsername('');
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || t('leagues.inviteError');
      if (status === 404) {
        toast.error(t('leagues.userNotFound'));
      } else if (status === 409) {
        toast.error(t('leagues.userAlreadyMember'));
      } else if (status === 403) {
        toast.error(t('leagues.onlyAdminsInvite'));
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
          <p className="text-muted-foreground">{t('leagues.createdBy', { user: league.created_by_username })} • {format(new Date(league.created_at), 'PPP')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            {league.is_public ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {league.is_public ? t('leagues.public') : t('leagues.private')}
          </Badge>
          {league.season && <Badge variant="outline">{t('admin.season')}: {league.season}</Badge>}
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
        {/* Leaderboard first */}
        <Card className="md:col-span-2">
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('leagues.leaderboard')}</CardTitle>
            <CardDescription>Ranked by current ELO • {leaderboardPagination.total} players</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('leagues.noPlayers')}</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>ELO</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead>W/L</TableHead>
                      <TableHead>Win%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.rank}</TableCell>
                        <TableCell>{p.username}</TableCell>
                        <TableCell>{p.current_elo}</TableCell>
                        <TableCell>
                          <EloSparkline userId={p.id} leagueId={id} width={50} height={16} points={15} />
                        </TableCell>
                        <TableCell>{p.matches_won}/{p.matches_played - p.matches_won}</TableCell>
                        <TableCell>{p.win_rate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {leaderboardPagination.pages > 1 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                      <span>Showing {((leaderboardPagination.page - 1) * leaderboardPagination.limit) + 1} - {Math.min(leaderboardPagination.page * leaderboardPagination.limit, leaderboardPagination.total)} of {leaderboardPagination.total}</span>
                      <span>Page {leaderboardPagination.page} / {leaderboardPagination.pages}</span>
                    </div>
                    <Pagination>
                      <PaginationContent>
                        {leaderboardPagination.page > 1 && (
                          <PaginationItem>
                            <PaginationPrevious 
                              href="#" 
                              onClick={(e) => { 
                                e.preventDefault(); 
                                fetchLeaderboard(leaderboardPagination.page - 1); 
                              }} 
                            />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink isActive>{leaderboardPagination.page}</PaginationLink>
                        </PaginationItem>
                        <span className="px-1 self-center text-sm text-muted-foreground">/ {leaderboardPagination.pages}</span>
                        {leaderboardPagination.page < leaderboardPagination.pages && (
                          <PaginationItem>
                            <PaginationNext 
                              href="#" 
                              onClick={(e) => { 
                                e.preventDefault(); 
                                fetchLeaderboard(leaderboardPagination.page + 1); 
                              }} 
                            />
                          </PaginationItem>
                        )}
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Compact overview beside leaderboard */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('common.overview')}</CardTitle>
            <CardDescription>Key stats</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground space-y-2">
            <div className="flex items-center gap-2"><Users className="h-4 w-4" /> {t('leagues.membersLabel')}: {league.member_count}</div>
            <div className="flex items-center gap-2"><ListChecks className="h-4 w-4" /> {t('leagues.matchesLabel')}: {league.match_count}</div>
            {userMembership && (
              <div className="flex items-center gap-2"><Trophy className="h-4 w-4" /> Your ELO: {userMembership.current_elo}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {isAuthenticated && !userMembership && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('leagues.joinThisLeague')}</CardTitle>
            <CardDescription>Enter your invite code to join</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleJoin}>
              <Input
                placeholder={t('leagues.inviteCodePlaceholder')}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                disabled={joinLoading}
              />
              <Button type="submit" disabled={joinLoading}>
                {joinLoading ? t('status.joining') : t('actions.join')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isAuthenticated && userMembership && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('leagues.leaveThisLeague')}</CardTitle>
            <CardDescription>You will lose access to members-only data</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={leaveLoading}>
                  {leaveLoading ? t('status.leaving') : t('leagues.leaveLeague')}
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
            <CardTitle className="text-base">{t('leagues.editLeague')}</CardTitle>
            <CardDescription>Update name, description, visibility, season, and ELO update mode</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-6">
                <FormField
                  name="name"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.leagueNamePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="description"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('admin.descriptionPlaceholder')} rows={4} {...field} />
                      </FormControl>
                      <FormDescription>Up to 1000 characters.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    name="season"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Season</FormLabel>
                        <FormControl>
                          <Input placeholder={t('admin.seasonPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    name="is_public"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <FormLabel className="mb-1">{t('admin.publicLeague')}</FormLabel>
                          <FormDescription>
                            Public leagues are visible to all users. Private leagues require membership.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <FormLabel>ELO Update Mode</FormLabel>
                    <div className="text-xs text-muted-foreground mb-2">
                      {t('leagues.eloModeHelp')}
                    </div>
                    <Select onValueChange={(v) => setEloMode(v)} value={eloMode}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('leagues.selectEloMode')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">{t('leagues.eloImmediate')}</SelectItem>
                        <SelectItem value="weekly">{t('leagues.eloWeekly')}</SelectItem>
                        <SelectItem value="monthly">{t('leagues.eloMonthly')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">
                      {t('leagues.eloModeDesc')}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={updateLoading}>
                    {updateLoading ? t('status.saving') : t('actions.saveChanges')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => form.reset()} disabled={updateLoading}>
                    {t('actions.reset')}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {isAuthenticated && userMembership?.is_admin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('leagues.inviteUser')}</CardTitle>
            <CardDescription>Invite by username; generates a code valid for 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleInvite}>
              <Input
                placeholder={t('profile.username')}
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                disabled={inviteLoading}
              />
              <Button type="submit" disabled={inviteLoading}>
                {inviteLoading ? t('status.inviting') : t('leagues.sendInvite')}
              </Button>
            </form>
            {inviteResult?.invite_code && (
              <div className="mt-3 text-sm">
                <div className="text-muted-foreground">{t('leagues.inviteCodeLabel')}:</div>
                <div className="font-mono text-base">{inviteResult.invite_code}</div>
                {inviteResult.expires_at && (
                  <div className="text-muted-foreground">
                    {t('leagues.expires')}: {format(new Date(inviteResult.expires_at), 'PP p')}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAuthenticated && userMembership?.is_admin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('leagues.eloConsolidation')}</CardTitle>
            <CardDescription>
              Apply deferred ELO updates for accepted matches. Only available for leagues with weekly/monthly consolidation mode.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={consolidating}
              onClick={async () => {
                console.log('Consolidation button clicked for league:', id);
                try {
                  setConsolidating(true);
                  console.log('Making consolidation API call...');
                  const res = await matchesAPI.consolidateLeague(id);
                  console.log('Consolidation response:', res);
                  toast.success(res.data?.message || t('leagues.consolidationComplete'));
                  await refreshLeagueData();
                } catch (e) {
                  console.error('Consolidation error:', e);
                  console.error('Error response:', e?.response);
                  console.error('Error data:', e?.response?.data);
                  toast.error(e?.response?.data?.error || t('leagues.consolidationError'));
                } finally {
                  setConsolidating(false);
                }
              }}
            >
              {consolidating ? 'Consolidating…' : 'Consolidate ELO'}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  console.log('Testing debug endpoint for league:', id);
                  const res = await matchesAPI.debugConsolidation(id);
                  console.log('Debug endpoint response:', res);
                  console.log('Debug data:', res.data);
                  toast.success(`Debug: ${res.data.matchesToConsolidate} matches to consolidate`);
                } catch (e) {
                  console.error('Debug endpoint error:', e);
                  console.error('Debug error response:', e?.response?.data);
                  toast.error(`Debug endpoint failed: ${e.message}`);
                }
              }}
            >
              Debug
            </Button>
          </CardContent>
        </Card>
      )}

      {isAuthenticated && userMembership?.is_admin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Invites</CardTitle>
            <CardDescription>Revoke invites that should no longer be valid</CardDescription>
          </CardHeader>
          <CardContent>
            {invitesLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : invites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invites.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Invited By</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.invited_username}</TableCell>
                      <TableCell>{inv.invited_by_username}</TableCell>
                      <TableCell>{inv.expires_at ? format(new Date(inv.expires_at), 'PP p') : '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeInvite(inv.id)}
                          disabled={!!revokingInvite[inv.id]}
                        >
                          {revokingInvite[inv.id] ? 'Revoking…' : 'Revoke'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {/* Remove mid-page members list to reduce duplication and clutter */}
        <Card className="md:col-span-3">
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
                      <TableCell>
                        <Link to={`/matches/${m.id}`}>{m.played_at ? format(new Date(m.played_at), 'PP p') : '-'}</Link>
                      </TableCell>
                      <TableCell>
                        <Link to={`/matches/${m.id}`}>{m.player1_username}</Link>
                      </TableCell>
                      <TableCell>
                        <Link to={`/matches/${m.id}`}>{m.player2_username}</Link>
                      </TableCell>
                      <TableCell>
                        <Link to={`/matches/${m.id}`}>{m.player1_sets_won} - {m.player2_sets_won}</Link>
                      </TableCell>
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

      {/* Members Management Section — visible to admins only and moved to end */}
      {isAuthenticated && userMembership?.is_admin && (
        <Card id="members">
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
            <CardDescription>Manage roles and review member stats</CardDescription>
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
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">
                        {m.is_league_admin ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDemote(m.id, m.username)}
                            disabled={!!roleChanging[m.id] || members.filter((x) => x.is_league_admin).length <= 1}
                          >
                            {roleChanging[m.id] ? 'Updating…' : 'Demote'}
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePromote(m.id, m.username)}
                            disabled={!!roleChanging[m.id]}
                          >
                            {roleChanging[m.id] ? 'Updating…' : 'Promote'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LeagueDetailPage;

