import { useEffect, useState, useMemo } from 'react';
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
import MedalIcon from '@/components/MedalIcon';
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

// Note: Schema depends on translations, so build it inside the component where `t` is available

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

  const editSchema = useMemo(() => (
    z.object({
      name: z
        .string()
        .min(1, t('common.validation.nameRequired'))
        .max(200, t('common.validation.max200Chars')),
      description: z
        .string()
        .max(1000, t('common.validation.max1000Chars'))
        .optional()
        .or(z.literal('')),
      is_public: z.boolean().default(true),
      season: z
        .string()
        .max(100, t('common.validation.max100Chars'))
        .optional()
        .or(z.literal('')),
    })
  ), [t]);

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
                 setError(err.response?.data?.error || t('leagues.loadError'));
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
    if (!window.confirm(t('leagues.promoteConfirm', { username }))) return;
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
      toast.error(t('leagues.cannotDemoteLastAdmin'));
      return;
    }
    if (!window.confirm(t('leagues.demoteConfirm', { username }))) return;
    try {
      setRoleChanging((m) => ({ ...m, [userId]: true }));
      const res = await leaguesAPI.demoteMember(id, userId);
      toast.success(res.data?.message || t('leagues.adminDemoted'));
      await refreshLeagueData();
    } catch (err) {
      const msg = err.response?.data?.error || t('leagues.demoteAdminError');
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
                     <CardTitle>{t('common.error')}</CardTitle>
          <CardDescription className="text-red-500">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!league) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="cyberpunk-title text-3xl text-blue-300">{league.name}</h1>
          <p className="cyberpunk-text text-gray-400">{t('leagues.createdBy', { user: '' })}<Link to={`/profile/${league.created_by_username}`} className="text-blue-400 hover:text-blue-300">{league.created_by_username}</Link> • {format(new Date(league.created_at), 'PPP')}</p>
        </div>
        <div className="flex items-center gap-2">
          {league.description && (
            <span className="text-sm text-gray-300 px-2 py-1 bg-gray-800 rounded border border-gray-700">
              {league.description}
            </span>
          )}
          <Badge variant="secondary" className="flex items-center gap-1">
            {league.is_public ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {league.is_public ? t('leagues.public') : t('leagues.private')}
          </Badge>
          {league.season && <Badge variant="outline">{t('admin.season')}: {league.season}</Badge>}
          {isAuthenticated && userMembership && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={leaveLoading}>
                  {leaveLoading ? t('status.leaving') : t('leagues.leaveLeague')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('dialog.leaveLeague')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('dialog.leaveLeagueDesc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('dialog.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLeave} disabled={leaveLoading}>
                    {t('dialog.confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Recent Matches - Minimal */}
      {matches.length === 0 ? (
        <p className="text-sm text-gray-400">{t('leagues.noMatchesYet')}</p>
      ) : (
        <div className="relative mx-4">
          {/* Left Arrow */}
          <button 
            className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 text-gray-400 hover:text-gray-300 text-2xl font-bold bg-gray-900/80 rounded-full w-8 h-8 flex items-center justify-center"
            onClick={() => {
              const container = document.getElementById('matches-scroll');
              if (container) container.scrollLeft -= 300;
            }}
          >
            ‹
          </button>
          
          {/* Right Arrow */}
          <button 
            className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 text-gray-400 hover:text-gray-300 text-2xl font-bold bg-gray-900/80 rounded-full w-8 h-8 flex items-center justify-center"
            onClick={() => {
              const container = document.getElementById('matches-scroll');
              if (container) container.scrollLeft += 300;
            }}
          >
            ›
          </button>
          
          {/* Matches Container */}
          <div 
            id="matches-scroll"
            className="overflow-x-auto scrollbar-hide px-10"
            style={{ scrollBehavior: 'smooth' }}
          >
            <div className="flex gap-4 min-w-max py-3 justify-center">
              {matches.map((m) => {
                const player1Won = m.player1_sets_won > m.player2_sets_won;
                const player2Won = m.player2_sets_won > m.player1_sets_won;
                
                return (
                  <div key={m.id} className="flex flex-col items-center min-w-fit px-2">
                    {/* Score Line */}
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <Link to={`/profile/${m.player1_username}`} className="text-blue-400 hover:text-blue-300 font-medium">
                        {m.player1_username}
                      </Link>
                      <span className="text-gray-300 font-bold">{m.player1_sets_won}</span>
                      <span className="text-gray-500">:</span>
                      <span className="text-gray-300 font-bold">{m.player2_sets_won}</span>
                      <Link to={`/profile/${m.player2_username}`} className="text-blue-400 hover:text-blue-300 font-medium">
                        {m.player2_username}
                      </Link>
                    </div>
                    
                    {/* ELO Points Line */}
                    <div className="flex items-center gap-2 whitespace-nowrap mt-1">
                      {m.elo_applied ? (
                        <>
                          <span className={`text-xs font-medium ${player1Won ? 'text-green-400' : player2Won ? 'text-red-400' : 'text-gray-400'}`}>
                            {m.player1_elo_before || 'N/A'}
                            {m.player1_elo_after && m.player1_elo_before && (
                              <span className={m.player1_elo_after > m.player1_elo_before ? 'text-green-400' : 'text-red-400'}>
                                {m.player1_elo_after > m.player1_elo_before ? ' (+' : ' ('}
                                {m.player1_elo_after - m.player1_elo_before}
                                {m.player1_elo_after > m.player1_elo_before ? ')' : ')'}
                              </span>
                            )}
                          </span>
                          <span className="text-gray-500 text-xs">vs</span>
                          <span className={`text-xs font-medium ${player2Won ? 'text-green-400' : player1Won ? 'text-red-400' : 'text-gray-400'}`}>
                            {m.player2_elo_before || 'N/A'}
                            {m.player2_elo_after && m.player2_elo_before && (
                              <span className={m.player2_elo_after > m.player2_elo_before ? 'text-green-400' : 'text-red-400'}>
                                {m.player2_elo_after > m.player2_elo_before ? ' (+' : ' ('}
                                {m.player2_elo_after - m.player2_elo_before}
                                {m.player2_elo_after > m.player2_elo_before ? ')' : ')'}
                              </span>
                            )}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-yellow-400 font-medium">Pending ELO calculation</span>
                      )}
                    </div>
                    
                    {/* Date and League Line */}
                    <div className="text-xs text-gray-500 mt-1 text-center">
                      {m.played_at ? format(new Date(m.played_at), 'MMM d') : '-'} • {league.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Leaderboard - Takes 2/3 width */}
        <div className="lg:col-span-2">
          <Card className="vg-card">
            <CardHeader className="py-4">
              <CardTitle className="cyberpunk-subtitle text-lg">{t('leagues.leaderboard')}</CardTitle>
              <CardDescription className="text-gray-400">{t('leagues.rankedByElo', { count: leaderboardPagination.total })}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-gray-400">{t('leagues.noPlayers')}</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-base">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="px-3 py-2 font-medium text-lg">{t('leagues.rank')}</th>
                          <th className="px-3 py-2 font-medium">{t('leagues.player')}</th>
                          <th className="px-3 py-2 font-medium">{t('leagues.elo')}</th>
                          <th className="px-3 py-2 font-medium">{t('leagues.trend')}</th>
                          <th className="px-3 py-2 font-medium">{t('leagues.wl')}</th>
                          <th className="px-3 py-2 font-medium">{t('leagues.winPercent')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((p) => (
                          <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                            <td className="px-3 py-4">
                              {p.rank <= 3 ? (
                                <MedalIcon rank={p.rank} size={48} userAvatar={p.avatar_url} />
                              ) : (
                                <span className="text-gray-300 text-2xl font-bold">{p.rank}</span>
                              )}
                            </td>
                            <td className="px-3 py-4">
                              <Link to={`/profile/${p.username}`} className="text-blue-400 hover:text-blue-300 text-lg">{p.username}</Link>
                            </td>
                            <td className="px-3 py-4 text-gray-300 text-lg">{p.current_elo}</td>
                            <td className="px-3 py-4">
                              <EloSparkline userId={p.id} leagueId={id} width={50} height={16} points={15} />
                            </td>
                            <td className="px-3 py-4 text-gray-300 text-lg">{p.matches_won}/{p.matches_played - p.matches_won}</td>
                            <td className="px-3 py-4 text-gray-300 text-lg">{p.win_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {leaderboardPagination.pages > 1 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                        <span>{t('leagues.showing', { 
                          start: ((leaderboardPagination.page - 1) * leaderboardPagination.limit) + 1, 
                          end: Math.min(leaderboardPagination.page * leaderboardPagination.limit, leaderboardPagination.total), 
                          total: leaderboardPagination.total 
                        })}</span>
                        <span>{t('leagues.page', { current: leaderboardPagination.page, total: leaderboardPagination.pages })}</span>
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
                          <span className="px-1 self-center text-sm text-gray-400">{t('leagues.of')} {leaderboardPagination.pages}</span>
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
        </div>

        {/* Sidebar - Takes 1/3 width */}
        <div className="space-y-4">
          {/* Overview */}
          <Card className="vg-card">
            <CardHeader className="py-3">
              <CardTitle className="cyberpunk-subtitle text-sm">{t('common.overview')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-gray-300 space-y-2">
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-blue-400" /> {t('leagues.membersLabel')}: {league.member_count}</div>
              <div className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-green-400" /> {t('leagues.matchesLabel')}: {league.match_count}</div>
              {userMembership && (
                <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-400" /> {t('leagues.yourElo', { elo: userMembership.current_elo })}</div>
              )}
            </CardContent>
          </Card>

          {/* Join League */}
          {isAuthenticated && !userMembership && (
            <Card className="vg-card">
              <CardHeader className="py-3">
                <CardTitle className="cyberpunk-subtitle text-sm">{t('leagues.joinThisLeague')}</CardTitle>
                <CardDescription className="text-gray-400 text-xs">{t('leagues.joinDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-2" onSubmit={handleJoin}>
                  <Input
                    placeholder={t('leagues.inviteCodePlaceholder')}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    disabled={joinLoading}
                  />
                  <Button type="submit" disabled={joinLoading} size="sm">
                    {joinLoading ? t('status.joining') : t('actions.join')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}


        </div>
      </div>

      {/* Members List and Admin Panel - Side by Side */}
      {isAuthenticated && userMembership?.is_admin && (
        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          {/* Members List - Left */}
          <Card id="members" className="vg-card">
            <CardHeader className="py-4">
              <CardTitle className="cyberpunk-subtitle text-lg">{t('leagues.members')}</CardTitle>
              <CardDescription className="text-gray-400">{t('leagues.manageRoles')}</CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-gray-400">{t('leagues.noMembers')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700">
                        <th className="px-3 py-2 font-medium">{t('leagues.user')}</th>
                        <th className="px-3 py-2 font-medium">{t('leagues.role')}</th>
                        <th className="px-3 py-2 font-medium">{t('leagues.joined')}</th>
                        <th className="px-3 py-2 font-medium text-right">{t('table.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                          <td className="px-3 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                <Link to={`/profile/${m.username}`} className="text-blue-400 hover:text-blue-300">{m.username}</Link>
                              </span>
                              {(m.first_name || m.last_name) && (
                                <span className="text-xs text-gray-500">{[m.first_name, m.last_name].filter(Boolean).join(' ')}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {m.is_league_admin ? (
                              <Badge variant="secondary">{t('leagues.admin')}</Badge>
                            ) : (
                              <Badge variant="outline">{t('leagues.member')}</Badge>
                            )}
                          </td>
                          <td className="px-3 py-3 text-gray-300">{m.joined_at ? format(new Date(m.joined_at), 'PP') : '-'}</td>
                          <td className="px-3 py-3 text-right">
                            {m.is_league_admin ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDemote(m.id, m.username)}
                                disabled={!!roleChanging[m.id] || members.filter((x) => x.is_league_admin).length <= 1}
                              >
                                {roleChanging[m.id] ? t('status.updating') : t('leagues.demote')}
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handlePromote(m.id, m.username)}
                                disabled={!!roleChanging[m.id]}
                              >
                                {roleChanging[m.id] ? t('status.updating') : t('leagues.promote')}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin Panel - Right */}
          <Card className="vg-card">
            <CardHeader className="pb-2">
              <CardTitle className="cyberpunk-subtitle text-lg">Admin Panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Invite Users */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">Invite Users</h4>
                <form className="flex gap-2" onSubmit={handleInvite}>
                  <Input
                    placeholder={t('profile.username')}
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    disabled={inviteLoading}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={inviteLoading}>
                    {inviteLoading ? t('status.inviting') : 'Send Invite'}
                  </Button>
                </form>
                {inviteResult?.invite_code && (
                  <div className="text-sm bg-gray-800 p-3 rounded border border-gray-700">
                    <div className="text-gray-400 mb-1">Invite Code:</div>
                    <div className="font-mono text-blue-400 text-lg">{inviteResult.invite_code}</div>
                  </div>
                )}
              </div>

              {/* ELO Update Mode */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">ELO Update Mode</h4>
                <Select value={eloMode} onValueChange={setEloMode}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={updateLoading}
                  onClick={async () => {
                    try {
                      setUpdateLoading(true);
                      await leaguesAPI.update(id, { elo_update_mode: eloMode });
                      toast.success('ELO update mode updated');
                      await refreshLeagueData();
                    } catch (e) {
                      toast.error(e?.response?.data?.error || 'Failed to update ELO mode');
                    } finally {
                      setUpdateLoading(false);
                    }
                  }}
                  className="w-full"
                >
                  {updateLoading ? 'Updating...' : 'Update ELO Mode'}
                </Button>
              </div>

              {/* ELO Consolidation */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">ELO Management</h4>
                <Button
                  variant="outline"
                  disabled={consolidating}
                  onClick={async () => {
                    try {
                      setConsolidating(true);
                      const res = await matchesAPI.consolidateLeague(id);
                      toast.success(res.data?.message || t('leagues.consolidationComplete'));
                      await refreshLeagueData();
                    } catch (e) {
                      toast.error(e?.response?.data?.error || t('leagues.consolidationError'));
                    } finally {
                      setConsolidating(false);
                    }
                  }}
                  className="w-full"
                >
                  {consolidating ? t('leagues.consolidating') : 'Consolidate ELO'}
                </Button>
              </div>

              {/* Quick Stats */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">Quick Stats</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-800 p-3 rounded border border-gray-700">
                    <div className="text-gray-400">Pending Invites</div>
                    <div className="text-2xl font-bold text-blue-400">{invites.length}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border border-gray-700">
                    <div className="text-gray-400">Total Members</div>
                    <div className="text-2xl font-bold text-green-400">{members.length}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LeagueDetailPage;

