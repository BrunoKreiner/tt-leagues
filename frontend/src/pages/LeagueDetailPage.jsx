import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { leaguesAPI, matchesAPI, badgesAPI } from '@/services/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, ListChecks, Calendar, Lock, Globe, Trophy, Swords, ChevronDown, ChevronUp } from 'lucide-react';
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
import { BadgeList } from '@/components/BadgeDisplay';
import RecordMatchForm from '@/components/RecordMatchForm';
import UserSearchSelect from '@/components/UserSearchSelect';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  const [leaderboardStatus, setLeaderboardStatus] = useState('idle');
  const [leaderboardError, setLeaderboardError] = useState(null);
  const [shouldLoadLeaderboard, setShouldLoadLeaderboard] = useState(false);
  const leaderboardSectionRef = useRef(null);
  const [members, setMembers] = useState([]);
  const [membersStatus, setMembersStatus] = useState('idle');
  const [membersError, setMembersError] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchesStatus, setMatchesStatus] = useState('idle');
  const [matchesError, setMatchesError] = useState(null);
  const { isAuthenticated, isAdmin, user } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [inviteUserId, setInviteUserId] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [invites, setInvites] = useState([]);
  const [_invitesLoading, setInvitesLoading] = useState(false);
  const [roleChanging, setRoleChanging] = useState({}); // { [userId]: true }
  const [_revokingInvite, setRevokingInvite] = useState({}); // { [inviteId]: true }
  const [eloMode, setEloMode] = useState('immediate');
  const [showRecordMatch, setShowRecordMatch] = useState(false);

  const [consolidating, setConsolidating] = useState(false);

  // Award badge (league admins + site admins)
  const [badges, setBadges] = useState([]);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [awardBadgeId, setAwardBadgeId] = useState('');
  const [awardMemberId, setAwardMemberId] = useState('');
  const [awardSeason, setAwardSeason] = useState('');
  const [awardingBadge, setAwardingBadge] = useState(false);
  const [participationLoading, setParticipationLoading] = useState(false);

  // Roster management (placeholders)
  const [placeholderDisplayName, setPlaceholderDisplayName] = useState('');
  const [creatingPlaceholder, setCreatingPlaceholder] = useState(false);
  const [assignUserByRosterId, setAssignUserByRosterId] = useState({});
  const [assigningRosterId, setAssigningRosterId] = useState(null);

  const canManageLeague = isAuthenticated && (isAdmin || userMembership?.is_admin);

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
        setLeaderboardStatus('idle');
        setLeaderboardError(null);
        setMatchesStatus('idle');
        setMatchesError(null);
        setMembersStatus('idle');
        setMembersError(null);

        const leagueRes = await leaguesAPI.getById(id, { ttlMs: 10000 });
        if (cancelled) return;

        const leagueData = leagueRes.data;
        setLeague(leagueData.league);
        setUserMembership(leagueData.user_membership);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.error || t('leagues.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, t]);

  // When league loads, populate the edit form defaults
  useEffect(() => {
    if (league) {
      form.reset({
        name: league.name || '',
        description: league.description || '',
        is_public: !!league.is_public,
        season: league.season || '',
      });
      setEloMode(league.elo_update_mode || 'immediate');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league]);

  useEffect(() => {
    const node = leaderboardSectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadLeaderboard(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!shouldLoadLeaderboard || !id) return;
    if (leaderboardStatus !== 'idle') return;
    fetchLeaderboard(1);
  }, [shouldLoadLeaderboard, id, leaderboardStatus]);

  useEffect(() => {
    if (!league || !id) return;
    if (matchesStatus !== 'idle') return;
    fetchMatches();
  }, [league, id, matchesStatus]);

  useEffect(() => {
    if (!canManageLeague || !id) return;
    if (membersStatus !== 'idle') return;
    fetchMembers();
  }, [canManageLeague, id, membersStatus]);

  const _eloDiff = (after, before) => {
    if (after == null || before == null) return null;
    const diff = after - before;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}`;
  };

  const refreshLeagueData = async () => {
    try {
      const leagueRes = await leaguesAPI.getById(id, { ttlMs: 10000 });
      setLeague(leagueRes.data.league);
      setUserMembership(leagueRes.data.user_membership);
      // Update eloMode state to match the refreshed league data
      const newEloMode = leagueRes.data.league.elo_update_mode || 'immediate';
      setEloMode(newEloMode);
      const canManage = isAuthenticated && (isAdmin || leagueRes.data.user_membership?.is_admin);
      if (canManage) {
        await fetchMembers();
      }
    } catch (e) {
      // Keep previous state; surface error softly
      console.error('Refresh league data failed', e);
      if (e?.response?.data?.error) {
        setMembersError(e.response.data.error);
      } else {
        setMembersError('Failed to load members');
      }
      setMembersStatus('error');
    }
  };

  const fetchLeaderboard = async (page = 1) => {
    try {
      setLeaderboardStatus('loading');
      setLeaderboardError(null);
      const res = await leaguesAPI.getLeaderboard(id, { page, limit: 20 }, { ttlMs: 10000 });
      const leaderboardData = res.data?.leaderboard;
      setLeaderboard(Array.isArray(leaderboardData) ? leaderboardData : []);
      const paginationData = res.data?.pagination;
      if (
        paginationData &&
        typeof paginationData.page === 'number' &&
        typeof paginationData.pages === 'number' &&
        typeof paginationData.total === 'number' &&
        typeof paginationData.limit === 'number'
      ) {
        setLeaderboardPagination(paginationData);
      } else {
        setLeaderboardPagination({ page: 1, pages: 1, total: 0, limit: 20 });
      }
      setLeaderboardStatus('loaded');
    } catch (e) {
      console.error('Failed to load leaderboard', e);
      const apiMessage = e?.response?.data?.error;
      setLeaderboardError(typeof apiMessage === 'string' && apiMessage.length > 0 ? apiMessage : t('leagues.leaderboardError'));
      setLeaderboardStatus('error');
      toast.error(t('leagues.leaderboardError'));
    }
  };

  const fetchMembers = async () => {
    try {
      setMembersStatus('loading');
      setMembersError(null);
      const res = await leaguesAPI.getMembers(id, { ttlMs: 10000 });
      const memberData = res.data?.members;
      if (Array.isArray(memberData)) {
        setMembers(memberData);
      } else {
        setMembers([]);
      }
      setMembersStatus('loaded');
    } catch (e) {
      console.error('Failed to load members', e);
      if (e?.response?.data?.error) {
        setMembersError(e.response.data.error);
      } else {
        setMembersError('Failed to load members');
      }
      setMembersStatus('error');
    }
  };

  const fetchMatches = async () => {
    try {
      setMatchesStatus('loading');
      setMatchesError(null);
      const res = await leaguesAPI.getMatches(id, { page: 1, limit: 10 }, { ttlMs: 10000 });
      const matchData = res.data?.matches;
      setMatches(Array.isArray(matchData) ? matchData : []);
      setMatchesStatus('loaded');
    } catch (e) {
      console.error('Failed to load matches', e);
      const apiMessage = e?.response?.data?.error;
      setMatchesError(typeof apiMessage === 'string' && apiMessage.length > 0 ? apiMessage : 'Failed to load matches');
      setMatchesStatus('error');
    }
  };

  const fetchInvites = async () => {
    if (!isAuthenticated || !(isAdmin || userMembership?.is_admin)) return;
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
    if (isAuthenticated && (isAdmin || userMembership?.is_admin)) {
      fetchInvites();
    } else {
      setInvites([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAuthenticated, isAdmin, userMembership?.is_admin]);

  const fetchBadges = async () => {
    try {
      setLoadingBadges(true);
      const res = await badgesAPI.getAll({ page: 1, limit: 100 });
      setBadges(res.data?.badges || []);
    } catch (e) {
      console.error('Failed to load badges', e);
      setBadges([]);
    } finally {
      setLoadingBadges(false);
    }
  };

  useEffect(() => {
    if (!canManageLeague) return;
    fetchBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageLeague]);

  useEffect(() => {
    if (!league) return;
    setAwardSeason(league.season || '');
  }, [league]);

  const handleAwardBadge = async (e) => {
    e.preventDefault();
    if (!awardMemberId || !awardBadgeId) {
      toast.error('Please select a user and a badge');
      return;
    }
    try {
      setAwardingBadge(true);
      const selectedBadge = badges.find((b) => String(b.id) === String(awardBadgeId));
      await badgesAPI.awardToUser(parseInt(awardMemberId), {
        badge_id: parseInt(awardBadgeId),
        league_id: parseInt(id),
        season: awardSeason?.trim() || undefined,
      });
      toast.success(`Badge "${selectedBadge?.name || 'selected'}" awarded successfully`);
      setAwardMemberId('');
      setAwardBadgeId('');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to award badge';
      toast.error(msg);
    } finally {
      setAwardingBadge(false);
    }
  };

  const handleCreatePlaceholder = async () => {
    const name = placeholderDisplayName.trim();
    if (!name) {
      toast.error('Please enter a placeholder name');
      return;
    }
    try {
      setCreatingPlaceholder(true);
      await leaguesAPI.createRosterMember(Number(id), name);
      setPlaceholderDisplayName('');
      toast.success('Placeholder member added');
      await refreshLeagueData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to add placeholder member';
      toast.error(msg);
    } finally {
      setCreatingPlaceholder(false);
    }
  };

  const handleAssignRoster = async (rosterId) => {
    const userId = assignUserByRosterId?.[rosterId];
    if (!userId) {
      toast.error('Please select a user to assign');
      return;
    }
    try {
      setAssigningRosterId(rosterId);
      await leaguesAPI.assignRosterMember(Number(id), rosterId, Number(userId));
      toast.success('Roster entry assigned');
      setAssignUserByRosterId((prev) => {
        const next = { ...(prev || {}) };
        delete next[rosterId];
        return next;
      });
      await refreshLeagueData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to assign roster entry';
      toast.error(msg);
    } finally {
      setAssigningRosterId(null);
    }
  };

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

  const handleParticipationToggle = async (nextValue) => {
    if (!id || !user?.id) return;
    try {
      setParticipationLoading(true);
      const res = await leaguesAPI.setParticipation(id, nextValue);
      if (res?.data?.message) {
        toast.success(res.data.message);
      } else {
        toast.success('Participation updated');
      }
      setMembers((prev) =>
        prev.map((member) =>
          member.user_id === user.id
            ? { ...member, is_participating: nextValue }
            : member
        )
      );
      if (leaderboardStatus !== 'idle') {
        await fetchLeaderboard(leaderboardPagination.page);
      }
    } catch (err) {
      if (err?.response?.data?.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error('Failed to update participation');
      }
    } finally {
      setParticipationLoading(false);
    }
  };

  const _handleRevokeInvite = async (inviteId) => {
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

  const _handleUpdate = async (values) => {
    try {
      setUpdateLoading(true);
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        is_public: !!values.is_public,
        season: values.season?.trim() || undefined,
        elo_update_mode: eloMode,
      };
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
    if (!inviteUserId) {
      toast.error(t('leagues.userRequired'));
      return;
    }
    try {
      setInviteLoading(true);
      setInviteResult(null);
      const res = await leaguesAPI.invite(id, { user_id: inviteUserId });
      const { message, invite_code, expires_at } = res.data || {};
      toast.success(message || t('leagues.inviteSent'));
      setInviteResult({ invite_code, expires_at });
      setInviteUserId(null);
      // Refresh invites list
      fetchInvites();
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || err.response?.data?.details || t('leagues.inviteError');
      console.error('Invite error:', err);
      if (status === 404) {
        toast.error(msg || t('leagues.userNotFound'));
      } else if (status === 409) {
        toast.error(msg || t('leagues.userAlreadyMember'));
      } else if (status === 403) {
        toast.error(msg || t('leagues.onlyAdminsInvite'));
      } else if (status === 400) {
        toast.error(msg || 'Invalid request');
      } else {
        toast.error(msg || 'Failed to invite user. Please check the console for details.');
      }
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="cyberpunk-title text-3xl text-blue-300">{league.name}</h1>
          <p className="cyberpunk-text text-gray-400">{t('leagues.createdBy', { user: '' })}<Link to={`/app/profile/${league.created_by_username}`} className="text-blue-400 hover:text-blue-300">{league.created_by_username}</Link> • {format(new Date(league.created_at), 'PPP')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {league.description && (
            <span className="max-w-full text-sm text-gray-300 px-2 py-1 bg-gray-800 rounded border border-gray-700 break-words">
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
      {matchesStatus === 'loading' || matchesStatus === 'idle' ? (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="sm" />
        </div>
      ) : matchesStatus === 'error' ? (
        <p className="text-sm text-red-400">{matchesError && matchesError.length > 0 ? matchesError : 'Failed to load matches'}</p>
      ) : matches.length === 0 ? (
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
                      {m.player1_username ? (
                        <Link to={`/app/profile/${m.player1_username}`} className="text-blue-400 hover:text-blue-300 font-medium">
                          {m.player1_display_name || m.player1_username}
                        </Link>
                      ) : (
                        <span className="text-blue-400 font-medium">{m.player1_display_name}</span>
                      )}
                      <span className="text-gray-300 font-bold">{m.player1_sets_won}</span>
                      <span className="text-gray-500">:</span>
                      <span className="text-gray-300 font-bold">{m.player2_sets_won}</span>
                      {m.player2_username ? (
                        <Link to={`/app/profile/${m.player2_username}`} className="text-blue-400 hover:text-blue-300 font-medium">
                          {m.player2_display_name || m.player2_username}
                        </Link>
                      ) : (
                        <span className="text-blue-400 font-medium">{m.player2_display_name}</span>
                      )}
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
      <div className="grid gap-6 lg:grid-cols-3 min-w-0">
        {/* Leaderboard - Takes 2/3 width */}
        <div className="lg:col-span-2 min-w-0" ref={leaderboardSectionRef}>
          <Card className="vg-card">
            <CardHeader className="py-4">
              <CardTitle className="cyberpunk-subtitle text-lg">{t('leagues.leaderboard')}</CardTitle>
              <CardDescription className="text-gray-400">{t('leagues.rankedByElo', { count: leaderboardPagination.total })}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 min-w-0">
              {leaderboardStatus === 'loading' || leaderboardStatus === 'idle' ? (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner size="sm" />
                </div>
              ) : leaderboardStatus === 'error' ? (
                <p className="text-sm text-red-400">
                  {typeof leaderboardError === 'string' && leaderboardError.length > 0
                    ? leaderboardError
                    : t('leagues.leaderboardError')}
                </p>
              ) : leaderboard.length === 0 ? (
                <p className="text-sm text-gray-400">{t('leagues.noPlayers')}</p>
              ) : (
                <>
                  {/* Mobile leaderboard: compact single-row stats */}
                  <div className="sm:hidden space-y-2">
                    {leaderboard.map((p) => (
                      <div
                        key={p.roster_id}
                        className="rounded-lg border border-gray-800 bg-gray-900/30 p-2"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="shrink-0">
                            {p.rank <= 3 ? (
                              <MedalIcon rank={p.rank} size={p.rank === 1 ? 36 : 32} />
                            ) : (
                              <div className="h-8 w-8 rounded-full border border-gray-800 bg-gray-900/60 flex items-center justify-center">
                                <span className="text-gray-200 text-sm font-bold">{p.rank}.</span>
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                {p.avatar_url ? (
                                  <img 
                                    src={p.avatar_url} 
                                    alt="" 
                                    className="w-6 h-6 rounded-full object-cover border border-gray-700 shrink-0"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 shrink-0">
                                    {(p.display_name || p.username || 'U').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                {p.username ? (
                                  <Link
                                    to={`/app/profile/${p.username}`}
                                    className="min-w-0 truncate text-blue-400 hover:text-blue-300 font-medium text-sm"
                                    title={p.display_name || p.username}
                                  >
                                    {p.display_name || p.username}
                                  </Link>
                                ) : (
                                  <span className="min-w-0 truncate text-blue-400 font-medium text-sm" title={p.display_name}>
                                    {p.display_name}
                                  </span>
                                )}
                              </div>
                              <div className="shrink-0 text-sm text-gray-200 font-semibold tabular-nums whitespace-nowrap">
                                {t('leagues.elo')}: {p.current_elo}
                              </div>
                            </div>

                            <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
                              <div className="flex items-center gap-2 text-[11px] text-gray-300 tabular-nums whitespace-nowrap min-w-0">
                                <span className="text-gray-400">{t('leagues.wl')}:</span>
                                <span>{p.matches_won}/{p.matches_played - p.matches_won}</span>
                                <span className="text-gray-600">•</span>
                                <span className="text-gray-400">{t('leagues.winPercent')}:</span>
                                <span>{p.win_rate}%</span>
                              </div>
                              <div className="shrink-0">
                                {p.user_id ? (
                                  <EloSparkline userId={p.user_id} leagueId={id} width={72} height={14} points={15} />
                                ) : p.roster_id ? (
                                  <EloSparkline rosterId={p.roster_id} leagueId={id} width={72} height={14} points={15} />
                                ) : (
                                  <span className="text-xs text-gray-500">—</span>
                                )}
                              </div>
                            </div>

                            {p.badges && p.badges.length > 0 && (
                              <BadgeList
                                badges={p.badges}
                                size="sm"
                                showDate={false}
                                showLeague={false}
                                className="mt-1 flex-nowrap overflow-x-auto scrollbar-hide gap-1 pb-1"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop/tablet leaderboard: compact single-row stats */}
                  <div className="hidden sm:block overflow-x-auto max-w-full">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="px-3 py-2 font-medium w-16 text-center">{t('leagues.rank')}</th>
                          <th className="px-3 py-2 font-medium">{t('leagues.player')}</th>
                          <th className="px-3 py-2 font-medium">{t('leagues.elo')}</th>
                          <th className="px-3 py-2 font-medium">{t('leagues.trend')}</th>
                          <th className="px-3 py-2 font-medium whitespace-nowrap">{t('leagues.wl')} / {t('leagues.winPercent')}</th>
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
                              <div className="flex items-center gap-2 min-w-0">
                                {p.avatar_url ? (
                                  <img 
                                    src={p.avatar_url} 
                                    alt="" 
                                    className="w-7 h-7 rounded-full object-cover border border-gray-700 shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 shrink-0">
                                    {(p.display_name || p.username || 'U').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                {p.username ? (
                                  <Link to={`/app/profile/${p.username}`} className="text-blue-400 hover:text-blue-300 font-medium truncate">
                                    {p.display_name || p.username}
                                  </Link>
                                ) : (
                                  <span className="text-blue-400 font-medium truncate" title="No user assigned">
                                    {p.display_name || 'No user assigned'}
                                  </span>
                                )}
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
                            <td className="px-3 py-2 text-gray-200 font-medium tabular-nums whitespace-nowrap align-middle">{p.current_elo}</td>
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
                              <span className="text-gray-300">{p.matches_won}/{p.matches_played - p.matches_won}</span>
                              <span className="text-gray-600"> • </span>
                              <span className="text-gray-300">{p.win_rate}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {leaderboardPagination.pages > 1 && leaderboardPagination.pages > 0 && leaderboardPagination.page > 0 && (
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
                          {leaderboardPagination.page > 1 ? (
                            <PaginationItem>
                              <PaginationPrevious 
                                href="#" 
                                onClick={(e) => { 
                                  e.preventDefault(); 
                                  fetchLeaderboard(leaderboardPagination.page - 1); 
                                }} 
                              />
                            </PaginationItem>
                          ) : null}
                          <PaginationItem>
                            <PaginationLink isActive>{leaderboardPagination.page}</PaginationLink>
                          </PaginationItem>
                          <span className="px-1 self-center text-sm text-gray-400">{t('leagues.of')} {leaderboardPagination.pages}</span>
                          {leaderboardPagination.page < leaderboardPagination.pages ? (
                            <PaginationItem>
                              <PaginationNext 
                                href="#" 
                                onClick={(e) => { 
                                  e.preventDefault(); 
                                  fetchLeaderboard(leaderboardPagination.page + 1); 
                                }} 
                              />
                            </PaginationItem>
                          ) : null}
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
        <div className="space-y-4 min-w-0">
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

      {/* Record Match Section - Collapsible */}
      {isAuthenticated && userMembership && (
        <Card className="vg-card">
          <Collapsible open={showRecordMatch} onOpenChange={setShowRecordMatch}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="cyberpunk-subtitle flex items-center gap-2 text-lg">
                    <Swords className="h-5 w-5 text-blue-400" />
                    {t('recordMatch.title')}
                  </CardTitle>
                  {showRecordMatch ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <CardDescription className="text-gray-400">
                  {t('recordMatch.subtitle')}
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <RecordMatchForm
                  initialLeagueId={parseInt(id)}
                  hideLeagueSelector={true}
                  leagueName={league.name}
                  allowAdminMatchForOthers={canManageLeague}
                  onSuccess={() => {
                    setShowRecordMatch(false);
                    // Refresh matches and leaderboard
                    fetchMatches();
                    fetchLeaderboard(leaderboardPagination.page);
                  }}
                />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Members List and Admin Panel - Side by Side (kept last in DOM) */}
      {canManageLeague ? (
        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          {/* Members List - Left */}
          <Card id="members" className="vg-card">
            <CardHeader className="py-4">
              <CardTitle className="cyberpunk-subtitle text-lg">{t('leagues.members')}</CardTitle>
              <CardDescription className="text-gray-400">{t('leagues.manageRoles')}</CardDescription>
            </CardHeader>
            <CardContent>
              {membersStatus === 'loading' || membersStatus === 'idle' ? (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner size="sm" />
                </div>
              ) : membersStatus === 'error' ? (
                <p className="text-sm text-red-400">
                  {typeof membersError === 'string' && membersError.length > 0
                    ? membersError
                    : 'Failed to load members'}
                </p>
              ) : members.length === 0 ? (
                <p className="text-sm text-gray-400">{t('leagues.noMembers')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700">
                        <th className="px-2 sm:px-3 py-2 font-medium">{t('leagues.user')}</th>
                        <th className="px-2 sm:px-3 py-2 font-medium">{t('leagues.role')}</th>
                        <th className="px-2 sm:px-3 py-2 font-medium hidden md:table-cell">{t('leagues.joined')}</th>
                        <th className="px-2 sm:px-3 py-2 font-medium text-right">{t('table.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.roster_id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                          <td className="px-3 sm:px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {m.username ? (
                                  <Link to={`/app/profile/${m.username}`} className="text-blue-400 hover:text-blue-300">
                                    {m.display_name}
                                  </Link>
                                ) : (
                                  <span className="text-blue-400">{m.display_name}</span>
                                )}
                              </span>
                              {!m.is_participating && (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                  <Badge variant="outline">Not participating</Badge>
                                </span>
                              )}
                              {m.username && (
                                <span className="text-xs text-gray-500">@{m.username}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 sm:px-3 py-2">
                            {m.is_league_admin ? (
                              <Badge variant="secondary">{t('leagues.admin')}</Badge>
                            ) : (
                              <Badge variant="outline">{t('leagues.member')}</Badge>
                            )}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-gray-300 hidden md:table-cell">{m.joined_at ? format(new Date(m.joined_at), 'PP') : '-'}</td>
                          <td className="px-2 sm:px-3 py-2 text-right">
                            {!m.user_id ? (
                              <span className="text-xs text-gray-500">—</span>
                            ) : m.is_league_admin ? (
                              <div className="flex flex-col items-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDemote(m.user_id, m.display_name)}
                                  disabled={!!roleChanging[m.user_id] || members.filter((x) => x.is_league_admin && x.user_id).length <= 1}
                                >
                                  {roleChanging[m.user_id] ? t('status.updating') : t('leagues.demote')}
                                </Button>
                                {m.user_id === user?.id && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleParticipationToggle(!m.is_participating)}
                                    disabled={participationLoading}
                                  >
                                    {participationLoading
                                      ? t('status.updating')
                                      : m.is_participating
                                        ? 'Leave leaderboard'
                                        : 'Join leaderboard'}
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handlePromote(m.user_id, m.display_name)}
                                disabled={!!roleChanging[m.user_id]}
                              >
                                {roleChanging[m.user_id] ? t('status.updating') : t('leagues.promote')}
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
              <CardTitle className="cyberpunk-subtitle text-lg">Manage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Roster management (placeholders) */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">Roster management (placeholders)</h4>
                <div className="flex gap-2">
                  <Input
                    value={placeholderDisplayName}
                    onChange={(e) => setPlaceholderDisplayName(e.target.value)}
                    placeholder="e.g. Alex (unassigned)"
                    disabled={creatingPlaceholder}
                  />
                  <Button
                    type="button"
                    onClick={handleCreatePlaceholder}
                    disabled={creatingPlaceholder}
                  >
                    {creatingPlaceholder ? 'Adding...' : 'Add'}
                  </Button>
                </div>

                {members.filter((m) => !m.user_id).length === 0 ? (
                  <div className="text-xs text-gray-500">No unassigned placeholders.</div>
                ) : (
                  <div className="space-y-2">
                    {members.filter((m) => !m.user_id).map((m) => (
                      <div key={m.roster_id} className="flex flex-col gap-2 rounded-md border border-gray-800 p-2">
                        <div className="text-sm text-blue-400">
                          <span className="font-medium">{m.display_name}</span>
                          <span className="text-xs text-gray-500"> (roster #{m.roster_id})</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex-1 min-w-0">
                            <UserSearchSelect
                              value={assignUserByRosterId?.[m.roster_id] || ''}
                              onValueChange={(userId) => {
                                const nextUserId = userId ? String(userId) : '';
                                setAssignUserByRosterId((prev) => ({
                                  ...(prev || {}),
                                  [m.roster_id]: nextUserId,
                                }));
                              }}
                              placeholder="Search and select user..."
                              disabled={assigningRosterId === m.roster_id}
                              excludeUserIds={members.map((x) => x.user_id).filter(Boolean)}
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={() => handleAssignRoster(m.roster_id)}
                            disabled={assigningRosterId === m.roster_id}
                            className="w-full sm:w-auto"
                          >
                            {assigningRosterId === m.roster_id ? 'Assigning...' : 'Assign'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Award Badge */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">Award Badge</h4>
                <form className="flex flex-col gap-2" onSubmit={handleAwardBadge}>
                  <Select value={awardMemberId} onValueChange={setAwardMemberId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.filter((m) => m.user_id).map((m) => (
                        <SelectItem key={m.user_id} value={String(m.user_id)}>
                          {m.display_name || m.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={awardBadgeId} onValueChange={setAwardBadgeId} disabled={loadingBadges}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={loadingBadges ? 'Loading badges...' : 'Select badge'} />
                    </SelectTrigger>
                    <SelectContent>
                      {badges.length === 0 ? (
                        <SelectItem disabled value="0">
                          No badges available
                        </SelectItem>
                      ) : (
                        badges.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Input
                    value={awardSeason}
                    onChange={(ev) => setAwardSeason(ev.target.value)}
                    placeholder="Season (optional)"
                    disabled={awardingBadge}
                  />
                  <Button type="submit" disabled={awardingBadge || !awardMemberId || !awardBadgeId}>
                    {awardingBadge ? 'Awarding...' : 'Award Badge'}
                  </Button>
                </form>
              </div>

              {/* Invite Users */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">Invite Users</h4>
                <form className="flex flex-col sm:flex-row gap-2" onSubmit={handleInvite}>
                  <div className="flex-1 min-w-0">
                    <UserSearchSelect
                      value={inviteUserId ? String(inviteUserId) : ''}
                      onValueChange={(userId) => setInviteUserId(userId ? parseInt(userId) : null)}
                      placeholder="Search and select user..."
                      disabled={inviteLoading}
                      excludeUserIds={members.map(m => m.user_id).filter(Boolean)}
                    />
                  </div>
                  <Button type="submit" disabled={inviteLoading || !inviteUserId} className="w-full sm:w-auto">
                    {inviteLoading ? t('status.inviting') : 'Send Invite'}
                  </Button>
                </form>
                {inviteResult?.invite_code && (
                  <div className="text-sm bg-gray-800 p-3 rounded border border-gray-700">
                    <div className="text-gray-400 mb-1">Invite Code:</div>
                    <div className="font-mono text-blue-400 text-lg">{inviteResult.invite_code}</div>
                    {inviteResult.expires_at && (
                      <div className="text-xs text-gray-500 mt-1">
                        Expires: {format(new Date(inviteResult.expires_at), 'PPp')}
                      </div>
                    )}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
      ) : null}
    </div>
  );
};

export default LeagueDetailPage;

