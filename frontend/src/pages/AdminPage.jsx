import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { leaguesAPI, matchesAPI, badgesAPI, ticketsAPI } from '@/services/api';
import { toast } from 'sonner';
import { Shield, PlusCircle, Award, Edit, Trash2, Gift } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import InlineImageCropper from '@/components/InlineImageCropper';
import UserSearchSelect from '@/components/UserSearchSelect';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Select as UiSelect, SelectContent as UiSelectContent, SelectItem as UiSelectItem, SelectTrigger as UiSelectTrigger, SelectValue as UiSelectValue } from '@/components/ui/select';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Max 200 characters'),
  description: z.string().max(1000, 'Max 1000 characters').optional().or(z.literal('')),
  is_public: z.boolean().default(true),
  season: z.string().max(100, 'Max 100 characters').optional().or(z.literal('')),
});

const badgeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Max 200 characters'),
  description: z.string().max(1000, 'Max 1000 characters').optional().or(z.literal('')),
  icon: z.string().min(1, 'Icon is required'),
  badge_type: z.string().min(1, 'Badge type is required'),
  image_url: z.string().nullable().optional().or(z.literal('')),
  visibility: z.enum(['public', 'private']).optional(),
});

const badgeIcons = ['trophy', 'star', 'fire', 'comeback', 'target', 'award', 'medal', 'crown', 'calendar', 'users', 'trending', 'heart'];
const badgeTypes = ['league_winner', 'tournament_winner', 'achievement'];

const ticketCategoryLabels = {
  bug_report: 'Report a bug',
  feature_request: 'New feature idea',
  question: 'Question',
  account: 'Account / login issue',
  other: 'Other',
};

const AdminPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Pending matches state (admin approvals)
  const [pending, setPending] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Badge management state
  const [badges, setBadges] = useState([]);
  const [loadingBadges, setLoadingBadges] = useState(true);
  const [badgePage, setBadgePage] = useState(1);
  const [badgePages, setBadgePages] = useState(1);
  const [badgeTotal, setBadgeTotal] = useState(0);
  const [badgeSort, setBadgeSort] = useState('created_desc');
  const [editingBadge, setEditingBadge] = useState(null);
  const [badgeFormOpen, setBadgeFormOpen] = useState(false);
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [selectedBadgeForAward, setSelectedBadgeForAward] = useState(null);
  const [awardUserId, setAwardUserId] = useState('');
  const [awardLeagueId, setAwardLeagueId] = useState('');
  const [awardSeason, setAwardSeason] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [leagues, setLeagues] = useState([]);
  const [badgeUsers, setBadgeUsers] = useState([]);
  const [loadingBadgeUsers, setLoadingBadgeUsers] = useState(false);
  const [uploadedImageSrc, setUploadedImageSrc] = useState(null);

  // Support tickets (site admin)
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketPages, setTicketPages] = useState(1);
  const [ticketTotal, setTicketTotal] = useState(0);
  const [ticketStatusFilter, setTicketStatusFilter] = useState('open');
  const [updatingTicketId, setUpdatingTicketId] = useState(null);

  const [awardLeagueMembers, setAwardLeagueMembers] = useState([]);
  const [loadingAwardLeagueMembers, setLoadingAwardLeagueMembers] = useState(false);

  // League roster management (placeholders + assignment)
  const [rosterLeagueId, setRosterLeagueId] = useState('');
  const [rosterMembers, setRosterMembers] = useState([]);
  const [loadingRosterMembers, setLoadingRosterMembers] = useState(false);
  const [placeholderDisplayName, setPlaceholderDisplayName] = useState('');
  const [creatingPlaceholder, setCreatingPlaceholder] = useState(false);
  const [assignUserByRosterId, setAssignUserByRosterId] = useState({});
  const [assigningRosterId, setAssigningRosterId] = useState(null);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      is_public: true,
      season: '',
    },
  });

  const fetchPending = async (opts = {}) => {
    const nextPage = opts.page ?? page;
    try {
      setLoadingPending(true);
      const { data } = await matchesAPI.getPending({ page: nextPage, limit: 10 });
      setPending(data.matches || []);
      setPages(data.pagination?.pages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (e) {
      console.error('Failed to load pending matches', e);
      toast.error('Failed to load pending matches');
    } finally {
      setLoadingPending(false);
    }
  };

  const badgeForm = useForm({
    resolver: zodResolver(badgeSchema),
    defaultValues: {
      name: '',
      description: '',
      icon: 'trophy',
      badge_type: 'achievement',
      image_url: '',
      visibility: 'private',
    },
  });

  useEffect(() => {
    fetchPending();
    fetchBadges();
    fetchLeagues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    fetchBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgePage, badgeSort]);

  useEffect(() => {
    if (!user?.is_admin) return;
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.is_admin, ticketPage, ticketStatusFilter]);

  const fetchBadges = async (opts = {}) => {
    const nextPage = opts.page ?? badgePage;
    const nextSort = opts.sort ?? badgeSort;
    try {
      setLoadingBadges(true);
      const { data } = await badgesAPI.getAll({ page: nextPage, limit: 20, sort: nextSort });
      setBadges(data.badges || []);
      setBadgePages(data.pagination?.pages || 1);
      setBadgeTotal(data.pagination?.total || 0);
    } catch (e) {
      console.error('Failed to load badges', e);
      toast.error('Failed to load badges');
    } finally {
      setLoadingBadges(false);
    }
  };

  const fetchLeagues = async () => {
    try {
      const { data } = await leaguesAPI.getAll({ page: 1, limit: 100 });
      setLeagues(data.leagues || []);
    } catch (e) {
      console.error('Failed to load leagues', e);
    }
  };

  const fetchTickets = async (opts = {}) => {
    const nextPage = opts.page ?? ticketPage;
    const nextStatus = opts.status ?? ticketStatusFilter;
    try {
      setLoadingTickets(true);
      const params = { page: nextPage, limit: 20 };
      if (nextStatus !== 'all') {
        params.status = nextStatus;
      }
      const { data } = await ticketsAPI.getAll(params);
      setTickets(data.tickets || []);
      setTicketPages(data.pagination?.pages || 1);
      setTicketTotal(data.pagination?.total || 0);
    } catch (e) {
      console.error('Failed to load tickets', e);
      toast.error('Failed to load tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  const updateTicketStatus = async (ticketId, status) => {
    try {
      setUpdatingTicketId(ticketId);
      await ticketsAPI.updateStatus(ticketId, status);
      toast.success('Ticket updated');
      await fetchTickets({ page: ticketPage });
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to update ticket';
      toast.error(msg);
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const fetchAwardLeagueMembers = async (leagueId) => {
    if (!leagueId) {
      setAwardLeagueMembers([]);
      return;
    }
    try {
      setLoadingAwardLeagueMembers(true);
      const { data } = await leaguesAPI.getMembers(Number(leagueId));
      const members = (data.members || []).filter((m) => m.user_id != null);
      setAwardLeagueMembers(members);
    } catch (e) {
      console.error('Failed to load award league members', e);
      toast.error('Failed to load league members for awarding');
      setAwardLeagueMembers([]);
    } finally {
      setLoadingAwardLeagueMembers(false);
    }
  };

  const fetchRosterMembers = async (leagueId) => {
    if (!leagueId) {
      setRosterMembers([]);
      return;
    }
    try {
      setLoadingRosterMembers(true);
      const { data } = await leaguesAPI.getMembers(Number(leagueId));
      setRosterMembers(data.members || []);
    } catch (e) {
      console.error('Failed to load roster members', e);
      toast.error('Failed to load roster members');
      setRosterMembers([]);
    } finally {
      setLoadingRosterMembers(false);
    }
  };

  const handleCreatePlaceholder = async () => {
    if (!rosterLeagueId) {
      toast.error('Please select a league first');
      return;
    }
    const name = placeholderDisplayName.trim();
    if (!name) {
      toast.error('Please enter a name for the placeholder');
      return;
    }
    try {
      setCreatingPlaceholder(true);
      await leaguesAPI.createRosterMember(Number(rosterLeagueId), name);
      setPlaceholderDisplayName('');
      toast.success('Placeholder member added');
      await fetchRosterMembers(rosterLeagueId);
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to create placeholder member';
      toast.error(msg);
    } finally {
      setCreatingPlaceholder(false);
    }
  };

  const handleAssignRoster = async (rosterId) => {
    if (!rosterLeagueId) {
      toast.error('Please select a league first');
      return;
    }
    const userId = assignUserByRosterId?.[rosterId];
    if (!userId) {
      toast.error('Please select a user to assign');
      return;
    }
    try {
      setAssigningRosterId(rosterId);
      await leaguesAPI.assignRosterMember(Number(rosterLeagueId), rosterId, Number(userId));
      toast.success('Roster entry assigned');
      setAssignUserByRosterId((prev) => {
        const next = { ...(prev || {}) };
        delete next[rosterId];
        return next;
      });
      await fetchRosterMembers(rosterLeagueId);
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to assign roster entry';
      toast.error(msg);
    } finally {
      setAssigningRosterId(null);
    }
  };

  const adminLeagues = (leagues || []).filter((l) => Number(l.is_league_admin) === 1);
  const rosterAssignedUserIds = rosterMembers.filter((m) => m.user_id != null).map((m) => m.user_id);

  const handleCreateBadge = async (values) => {
    try {
      setSubmitting(true);
      // Ensure image_url is empty string instead of null
      const payload = {
        ...values,
        image_url: values.image_url || ''
      };
      if (!user?.is_admin) {
        // Non-site-admins can only create private badges; backend enforces too.
        delete payload.visibility;
      } else {
        payload.visibility = values.visibility || 'public';
      }
      await badgesAPI.create(payload);
      toast.success('Badge created successfully');
      badgeForm.reset();
      setUploadedImageSrc(null);
      setBadgeFormOpen(false);
      fetchBadges();
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to create badge';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditBadge = async (values) => {
    try {
      setSubmitting(true);
      // Ensure image_url is empty string instead of null
      const payload = {
        name: values.name,
        description: values.description,
        icon: values.icon,
        badge_type: values.badge_type,
        image_url: values.image_url || ''
      };
      await badgesAPI.update(editingBadge.id, payload);
      toast.success('Badge updated successfully');
      badgeForm.reset();
      setEditingBadge(null);
      setUploadedImageSrc(null);
      setBadgeFormOpen(false);
      fetchBadges();
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to update badge';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBadge = async (badgeId) => {
    try {
      await badgesAPI.delete(badgeId);
      toast.success('Badge deleted successfully');
      fetchBadges();
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to delete badge';
      toast.error(msg);
    }
  };

  const handleAwardBadge = async () => {
    if (!selectedBadgeForAward || !awardLeagueId || !awardUserId) {
      toast.error('Please select a badge, league, and user');
      return;
    }
    try {
      setAwarding(true);
      await badgesAPI.awardToUser(parseInt(awardUserId), {
        badge_id: selectedBadgeForAward.id,
        league_id: parseInt(awardLeagueId),
        season: awardSeason || undefined,
      });
      toast.success(`Badge "${selectedBadgeForAward.name}" awarded successfully`);
      setAwardDialogOpen(false);
      setAwardUserId('');
      setAwardLeagueId('');
      setAwardSeason('');
      setSelectedBadgeForAward(null);
      setAwardLeagueMembers([]);
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to award badge';
      toast.error(msg);
    } finally {
      setAwarding(false);
    }
  };

  const fetchBadgeUsers = async (badgeId) => {
    try {
      setLoadingBadgeUsers(true);
      const res = await badgesAPI.getUsers(badgeId);
      setBadgeUsers(res.data.users || []);
    } catch (e) {
      console.error('Failed to fetch badge users:', e);
      setBadgeUsers([]);
    } finally {
      setLoadingBadgeUsers(false);
    }
  };

  const handleRevokeBadge = async (userId, badgeId, username) => {
    if (!window.confirm(`Remove this badge from ${username}?`)) return;
    try {
      await badgesAPI.removeFromUser(userId, badgeId);
      toast.success(`Badge removed from ${username}`);
      if (editingBadge) {
        fetchBadgeUsers(editingBadge.id);
      }
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to remove badge';
      toast.error(msg);
    }
  };

  const openEditBadge = (badge) => {
    setEditingBadge(badge);
    setUploadedImageSrc(null);
    badgeForm.reset({
      name: badge.name,
      description: badge.description || '',
      icon: badge.icon || 'trophy',
      badge_type: badge.badge_type || 'achievement',
      image_url: badge.image_url || '',
      visibility: badge.visibility || (user?.is_admin ? 'public' : 'private'),
    });
    setBadgeFormOpen(true);
    if (user?.is_admin || (badge.visibility === 'private' && badge.created_by === user?.id)) {
      fetchBadgeUsers(badge.id);
    }
  };

  const openCreateBadge = () => {
    setEditingBadge(null);
    setUploadedImageSrc(null);
    badgeForm.reset({
      name: '',
      description: '',
      icon: 'trophy',
      badge_type: 'achievement',
      image_url: '',
      visibility: user?.is_admin ? 'public' : 'private',
    });
    setBadgeFormOpen(true);
  };

  const openAwardDialog = (badge) => {
    setSelectedBadgeForAward(badge);
    setAwardUserId('');
    setAwardLeagueId('');
    setAwardSeason('');
    setAwardLeagueMembers([]);
    setAwardDialogOpen(true);
  };

  const acceptMatch = async (id) => {
    try {
      await matchesAPI.accept(id);
      toast.success('Match accepted');
      fetchPending({ page });
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to accept match';
      toast.error(msg);
    }
  };

  const rejectMatch = async (id) => {
    const input = window.prompt('Optional reason for rejection (press Cancel to abort):');
    if (input === null) return; // user canceled
    const reason = input?.trim() || undefined;
    try {
      await matchesAPI.reject(id, reason);
      toast.success('Match rejected');
      fetchPending({ page });
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to reject match';
      toast.error(msg);
    }
  };

  const onSubmit = async (values) => {
    try {
      setSubmitting(true);
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        is_public: !!values.is_public,
        season: values.season?.trim() || undefined,
      };
      const { data } = await leaguesAPI.create(payload);
      toast.success(t('admin.created'));
      navigate(`/leagues/${data.league.id}`);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || t('admin.createError');
      if (status === 409) {
        toast.error(t('admin.nameExists'));
        form.setError('name', { message: t('admin.nameExists') });
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('admin.panelTitle')}</h1>
        <p className="text-muted-foreground">{t('admin.panelSubtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PlusCircle className="h-5 w-5 mr-2" />
            {t('admin.createLeague')}
          </CardTitle>
          <CardDescription>{t('admin.createLeagueDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                name="name"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.name')}</FormLabel>
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
                    <FormLabel>{t('common.description')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder={t('admin.descriptionPlaceholder')} rows={4} {...field} />
                    </FormControl>
                    <FormDescription>{t('admin.descriptionHint')}</FormDescription>
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
                      <FormLabel>{t('admin.season')}</FormLabel>
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
                          {t('admin.publicLeagueHint')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? t('status.creating') : t('admin.createLeague')}
                </Button>
                <Button type="button" variant="outline" onClick={() => form.reset()} disabled={submitting}>
                  {t('actions.reset')}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Roster management (placeholders)
          </CardTitle>
          <CardDescription>
            Add placeholder members to a league (no account yet), then assign them to real users later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {adminLeagues.length === 0 && (
            <div className="rounded-md border border-yellow-700/40 bg-yellow-900/10 p-3 text-sm text-yellow-200">
              You’re not a league admin yet — create a league first to manage rosters.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm font-medium mb-1">League</div>
              <Select
                value={rosterLeagueId || undefined}
                onValueChange={(value) => {
                  setRosterLeagueId(value || '');
                  setAssignUserByRosterId({});
                  fetchRosterMembers(value || '');
                }}
                disabled={adminLeagues.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a league" />
                </SelectTrigger>
                <SelectContent>
                  {adminLeagues.map((league) => (
                    <SelectItem key={league.id} value={String(league.id)}>
                      {league.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">Add placeholder member</div>
              <div className="flex gap-2">
                <Input
                  value={placeholderDisplayName}
                  onChange={(e) => setPlaceholderDisplayName(e.target.value)}
                  placeholder="e.g. Alex (unassigned)"
                  disabled={adminLeagues.length === 0 || !rosterLeagueId || creatingPlaceholder}
                />
                <Button
                  type="button"
                  onClick={handleCreatePlaceholder}
                  disabled={adminLeagues.length === 0 || !rosterLeagueId || creatingPlaceholder}
                >
                  {creatingPlaceholder ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {rosterLeagueId ? `Members: ${rosterMembers.length}` : 'Select a league to manage its roster.'}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fetchRosterMembers(rosterLeagueId)}
              disabled={!rosterLeagueId || loadingRosterMembers}
            >
              {loadingRosterMembers ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {loadingRosterMembers ? (
            <div className="py-6"><LoadingSpinner /></div>
          ) : !rosterLeagueId ? null : rosterMembers.length === 0 ? (
            <div className="text-sm text-muted-foreground">No roster members found for this league.</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Display name</th>
                    <th className="text-left font-medium px-3 py-2">Assigned user</th>
                    <th className="text-left font-medium px-3 py-2">ELO</th>
                    <th className="text-left font-medium px-3 py-2">Assign</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterMembers.map((m) => {
                    const isAssigned = m.user_id != null;
                    return (
                      <tr key={m.roster_id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium">{m.display_name}</div>
                          <div className="text-xs text-muted-foreground">Roster ID: {m.roster_id}</div>
                        </td>
                        <td className="px-3 py-2">
                          {isAssigned ? (
                            m.username ? (
                              <Link
                                to={`/app/profile/${m.username}`}
                                className="text-blue-400 hover:text-blue-300 underline hover:no-underline"
                              >
                                {m.username}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">Assigned (no username)</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{m.current_elo}</td>
                        <td className="px-3 py-2">
                          {isAssigned ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex gap-2 items-center min-w-[420px]">
                              <UserSearchSelect
                                value={assignUserByRosterId?.[m.roster_id] || ''}
                                onValueChange={(userId) => {
                                  const nextUserId = userId ? String(userId) : '';
                                  setAssignUserByRosterId((prev) => ({
                                    ...(prev || {}),
                                    [m.roster_id]: nextUserId,
                                  }));
                                }}
                                placeholder="Select user to assign..."
                                excludeUserIds={rosterAssignedUserIds}
                                disabled={assigningRosterId === m.roster_id}
                              />
                              <Button
                                type="button"
                                onClick={() => handleAssignRoster(m.roster_id)}
                                disabled={assigningRosterId === m.roster_id}
                              >
                                {assigningRosterId === m.roster_id ? 'Assigning...' : 'Assign'}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.pendingApprovals')}</CardTitle>
          <CardDescription>{t('admin.pendingApprovalsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPending ? (
            <div className="py-8"><LoadingSpinner /></div>
          ) : pending.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('admin.noPending')}</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">{t('table.when')}</th>
                    <th className="text-left font-medium px-3 py-2">{t('table.league')}</th>
                    <th className="text-left font-medium px-3 py-2">{t('table.players')}</th>
                    <th className="text-left font-medium px-3 py-2">{t('table.result')}</th>
                    <th className="text-left font-medium px-3 py-2">{t('table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="px-3 py-2">{(() => { try { return format(new Date(m.played_at || m.created_at), 'PP p'); } catch { return String(m.played_at || m.created_at || '-'); } })()}</td>
                      <td className="px-3 py-2">{m.league_name}</td>
                      <td className="px-3 py-2">
                        <Link to={`/app/profile/${m.player1_username}`} className="text-blue-400 hover:text-blue-300 underline hover:no-underline">{m.player1_username}</Link>
                        {' vs '}
                        <Link to={`/app/profile/${m.player2_username}`} className="text-blue-400 hover:text-blue-300 underline hover:no-underline">{m.player2_username}</Link>
                      </td>
                      <td className="px-3 py-2">{m.player1_sets_won}-{m.player2_sets_won}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => acceptMatch(m.id)}>{t('actions.accept')}</Button>
                          <Button size="sm" variant="outline" onClick={() => rejectMatch(m.id)}>{t('actions.reject')}</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>{t('common.totalN', { count: total })}</span>
              <span>{t('common.pageOf', { page, pages })}</span>
            </div>
            <Pagination>
              <PaginationContent>
                {page > 1 && (
                  <PaginationItem>
                    <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }} />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink isActive>{page}</PaginationLink>
                </PaginationItem>
                <span className="px-1 self-center text-sm text-muted-foreground">/ {pages}</span>
                {page < pages && (
                  <PaginationItem>
                    <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(pages, p + 1)); }} />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      {/* Badge Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
          <CardTitle className="flex items-center">
                <Award className="h-5 w-5 mr-2" />
                Badge Management
          </CardTitle>
              <CardDescription>Create, edit, and award badges to users</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-64">
                <UiSelect
                  value={badgeSort}
                  onValueChange={(v) => {
                    setBadgePage(1);
                    setBadgeSort(v);
                  }}
                >
                  <UiSelectTrigger>
                    <UiSelectValue placeholder="Sort" />
                  </UiSelectTrigger>
                  <UiSelectContent>
                    <UiSelectItem value="created_desc">Most recent created</UiSelectItem>
                    <UiSelectItem value="last_awarded_desc">Most recent awards</UiSelectItem>
                    <UiSelectItem value="awarded_desc">Most awarded</UiSelectItem>
                    <UiSelectItem value="awarded_asc">Least awarded</UiSelectItem>
                  </UiSelectContent>
                </UiSelect>
              </div>
            <Dialog open={badgeFormOpen} onOpenChange={setBadgeFormOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateBadge}><PlusCircle className="h-4 w-4 mr-2" />Create Badge</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl bg-gray-900 border-2 border-gray-700">
                <DialogHeader>
                  <DialogTitle>{editingBadge ? 'Edit Badge' : 'Create Badge'}</DialogTitle>
                  <DialogDescription>
                    {editingBadge ? 'Update badge details' : 'Create a new badge to award to users'}
                  </DialogDescription>
                </DialogHeader>
                <Form {...badgeForm}>
                  <form onSubmit={badgeForm.handleSubmit(editingBadge ? handleEditBadge : handleCreateBadge)} className="space-y-4">
                    <FormField
                      name="name"
                      control={badgeForm.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Badge name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      name="description"
                      control={badgeForm.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Badge description" rows={3} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        name="icon"
                        control={badgeForm.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Icon</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select icon" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {badgeIcons.map((icon) => (
                                  <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name="badge_type"
                        control={badgeForm.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Badge Type</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {badgeTypes.map((type) => (
                                  <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {user?.is_admin && (
                      <FormField
                        name="visibility"
                        control={badgeForm.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Visibility</FormLabel>
                            <Select
                              value={field.value || 'public'}
                              onValueChange={field.onChange}
                              disabled={!!editingBadge} // immutable after creation
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select visibility" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="public">Public (global)</SelectItem>
                                <SelectItem value="private">Private (only me)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Public badges show up in everyone&apos;s badge list. Private badges are only visible to you.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      name="image_url"
                      control={badgeForm.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Badge Image (optional)</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              {!uploadedImageSrc && !field.value && (
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="w-full border border-gray-600 rounded px-2 py-1 bg-gray-800 text-gray-200 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer cursor-pointer"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (e) => {
                                        setUploadedImageSrc(e.target.result);
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              )}
                              {uploadedImageSrc && (
                                <InlineImageCropper
                                  imageSrc={uploadedImageSrc}
                                  onCrop={(cropped) => {
                                    field.onChange(cropped || '');
                                    setUploadedImageSrc(null);
                                  }}
                                  onCancel={() => {
                                    setUploadedImageSrc(null);
                                  }}
                                  onRemove={() => {
                                    setUploadedImageSrc(null);
                                    field.onChange('');
                                  }}
                                />
                              )}
                              {field.value && !uploadedImageSrc && (
                                <div className="space-y-2">
                                  <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                                    <img src={field.value} alt="Badge preview" className="w-full h-full object-contain" />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setUploadedImageSrc(field.value);
                                      }}
                                    >
                                      Edit Image
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="text-red-400 hover:text-red-300"
                                      onClick={() => {
                                        field.onChange('');
                                      }}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="w-full border border-gray-600 rounded px-2 py-1 bg-gray-800 text-gray-200 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer cursor-pointer"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (e) => {
                                          setUploadedImageSrc(e.target.result);
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                </div>
                              )}
                              <FormDescription>
                                Upload an image for this badge. It will be cropped to 128x128 (1:1 ratio) and stored as base64.
                              </FormDescription>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {(editingBadge && (user?.is_admin || (editingBadge?.visibility === 'private' && editingBadge?.created_by === user?.id))) && (
                      <div className="space-y-2">
                        <FormLabel>Users with this badge ({badgeUsers.length})</FormLabel>
                        {loadingBadgeUsers ? (
                          <div className="text-sm text-muted-foreground py-2">Loading...</div>
                        ) : badgeUsers.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-2">No users have this badge yet.</div>
                        ) : (
                          <div className="border border-gray-700 rounded-lg max-h-60 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 z-10 bg-muted/40 text-muted-foreground">
                                <tr>
                                  <th className="text-left font-medium px-3 py-2">User</th>
                                  <th className="text-left font-medium px-3 py-2">League</th>
                                  <th className="text-left font-medium px-3 py-2">Earned</th>
                                  <th className="text-right font-medium px-3 py-2">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {badgeUsers.map((user) => (
                                  <tr key={user.user_badge_id} className="border-t border-gray-700">
                                    <td className="px-3 py-2">
                                      <Link to={`/app/profile/${user.username}`} className="text-blue-400 hover:text-blue-300 underline hover:no-underline">{user.username}</Link>
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">{user.league_name || 'Global'}</td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                      {user.earned_at ? format(new Date(user.earned_at), 'MMM d, yyyy') : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                        onClick={() => handleRevokeBadge(user.id, editingBadge.id, user.username)}
                                      >
                                        Revoke
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setBadgeFormOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={submitting}>
                        {submitting ? 'Saving...' : editingBadge ? 'Update Badge' : 'Create Badge'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBadges ? (
            <div className="py-8"><LoadingSpinner /></div>
          ) : badges.length === 0 ? (
            <div className="text-sm text-muted-foreground">No badges created yet. Create your first badge!</div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Image</th>
                      <th className="text-left font-medium px-3 py-2">Name</th>
                      <th className="text-left font-medium px-3 py-2">Scope</th>
                      <th className="text-left font-medium px-3 py-2">Icon</th>
                      <th className="text-left font-medium px-3 py-2">Type</th>
                      <th className="text-left font-medium px-3 py-2">Times Awarded</th>
                      <th className="text-left font-medium px-3 py-2">Created</th>
                      <th className="text-right font-medium px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {badges.map((badge) => (
                      <tr key={badge.id} className="border-t">
                        <td className="px-3 py-3">
                          {badge.image_url ? (
                            <div className="w-12 h-12 rounded overflow-hidden border border-gray-600 flex items-center justify-center bg-gray-800">
                              <img 
                                src={badge.image_url} 
                                alt={badge.name}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div className="hidden text-xs text-muted-foreground items-center justify-center w-full h-full">
                                No image
                              </div>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded border border-gray-600 flex items-center justify-center bg-gray-800 text-xs text-muted-foreground">
                              {badge.icon || 'N/A'}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{badge.name}</div>
                          {badge.description && (
                            <div className="text-xs text-muted-foreground mt-1">{badge.description}</div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={badge.visibility === 'public' ? 'text-green-400' : 'text-blue-400'}>
                            {badge.visibility === 'public' ? 'Public' : 'Private'}
                          </span>
                        </td>
                        <td className="px-3 py-3">{badge.icon}</td>
                        <td className="px-3 py-3">{badge.badge_type?.replace('_', ' ') || '-'}</td>
                        <td className="px-3 py-3">{badge.times_awarded || 0}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {badge.created_at ? format(new Date(badge.created_at), 'MMM d, yyyy') : '-'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {(() => {
                              const canManageBadge =
                                (badge.visibility === 'public' && user?.is_admin) ||
                                (badge.visibility === 'private' && badge.created_by === user?.id);
                              const canAwardBadge =
                                badge.visibility === 'public' || badge.created_by === user?.id;
                              return (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => openEditBadge(badge)} disabled={!canManageBadge}>
                                    <Edit className="h-3 w-3 mr-1" />Edit
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openAwardDialog(badge)} disabled={!canAwardBadge}>
                                    <Gift className="h-3 w-3 mr-1" />Award
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                        disabled={!canManageBadge}
                                      >
                                        <Trash2 className="h-3 w-3 mr-1" />Delete
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="bg-gray-900 border-2 border-gray-700">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Badge</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete "{badge.name}"?
                                          {badge.times_awarded > 0 && ` This badge has been awarded to ${badge.times_awarded} user(s) and cannot be deleted.`}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteBadge(badge.id)}
                                          disabled={badge.times_awarded > 0}
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {badgePages > 1 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <span>Total: {badgeTotal}</span>
                    <span>Page {badgePage} of {badgePages}</span>
                  </div>
                  <Pagination>
                    <PaginationContent>
                      {badgePage > 1 && (
                        <PaginationItem>
                          <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setBadgePage((p) => Math.max(1, p - 1)); }} />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink isActive>{badgePage}</PaginationLink>
                      </PaginationItem>
                      <span className="px-1 self-center text-sm text-muted-foreground">/ {badgePages}</span>
                      {badgePage < badgePages && (
                        <PaginationItem>
                          <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setBadgePage((p) => Math.min(badgePages, p + 1)); }} />
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

      {user?.is_admin && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Support tickets</CardTitle>
                <CardDescription>Anonymous tickets sent from the footer Support page</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={ticketStatusFilter}
                  onValueChange={(v) => {
                    setTicketPage(1);
                    setTicketStatusFilter(v);
                  }}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fetchTickets({ page: ticketPage })}
                  disabled={loadingTickets}
                >
                  {loadingTickets ? 'Refreshing…' : 'Refresh'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTickets ? (
              <div className="py-8"><LoadingSpinner /></div>
            ) : tickets.length === 0 ? (
              <div className="text-sm text-muted-foreground">No tickets found.</div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Created</th>
                        <th className="text-left font-medium px-3 py-2">Category</th>
                        <th className="text-left font-medium px-3 py-2">Subject</th>
                        <th className="text-left font-medium px-3 py-2">Email</th>
                        <th className="text-left font-medium px-3 py-2">Message</th>
                        <th className="text-left font-medium px-3 py-2">Status</th>
                        <th className="text-right font-medium px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => (
                        <tr key={t.id} className="border-t">
                          <td className="px-3 py-3 text-muted-foreground">
                            {(() => {
                              try { return format(new Date(t.created_at), 'PP p'); } catch { return String(t.created_at || '-'); }
                            })()}
                          </td>
                          <td className="px-3 py-3">{ticketCategoryLabels[t.category]}</td>
                          <td className="px-3 py-3">
                            <div className="max-w-[220px] truncate">{t.subject || '—'}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="max-w-[220px] truncate text-muted-foreground">{t.email || '—'}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="max-w-[520px] whitespace-pre-wrap break-words">
                              {t.message?.length > 300 ? `${t.message.slice(0, 300)}…` : t.message}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={t.status === 'open' ? 'text-yellow-300' : 'text-green-400'}>
                              {t.status}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {t.status === 'open' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateTicketStatus(t.id, 'closed')}
                                  disabled={updatingTicketId === t.id}
                                >
                                  {updatingTicketId === t.id ? 'Closing…' : 'Close'}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateTicketStatus(t.id, 'open')}
                                  disabled={updatingTicketId === t.id}
                                >
                                  {updatingTicketId === t.id ? 'Reopening…' : 'Reopen'}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {ticketPages > 1 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                      <span>Total: {ticketTotal}</span>
                      <span>Page {ticketPage} of {ticketPages}</span>
                    </div>
                    <Pagination>
                      <PaginationContent>
                        {ticketPage > 1 && (
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setTicketPage((p) => Math.max(1, p - 1));
                              }}
                            />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink isActive>{ticketPage}</PaginationLink>
                        </PaginationItem>
                        <span className="px-1 self-center text-sm text-muted-foreground">/ {ticketPages}</span>
                        {ticketPage < ticketPages && (
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setTicketPage((p) => Math.min(ticketPages, p + 1));
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
      )}

      {/* Award Badge Dialog */}
      <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <DialogContent className="bg-gray-900 border-2 border-gray-700">
          <DialogHeader>
            <DialogTitle>Award Badge: {selectedBadgeForAward?.name}</DialogTitle>
            <DialogDescription>
              Award this badge to a user in a league you admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {adminLeagues.length === 0 && (
              <div className="rounded-md border border-yellow-700/40 bg-yellow-900/10 p-3 text-sm text-yellow-200">
                You’re not a league admin yet — create a league first to award badges.
              </div>
            )}
            <div>
              <label className="text-sm font-medium">League</label>
              <Select 
                value={awardLeagueId || undefined} 
                onValueChange={(value) => {
                  const next = value || '';
                  setAwardLeagueId(next);
                  setAwardUserId('');
                  fetchAwardLeagueMembers(next);
                }}
                disabled={awarding || adminLeagues.length === 0}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder={
                    adminLeagues.length === 0
                      ? 'You are not an admin in any league'
                      : 'Select league'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {adminLeagues.length === 0 ? (
                    <SelectItem disabled value="0">
                      No leagues available
                    </SelectItem>
                  ) : (
                    adminLeagues.map((league) => (
                      <SelectItem key={league.id} value={String(league.id)}>
                        {league.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">User</label>
              <Select
                value={awardUserId || undefined}
                onValueChange={(value) => setAwardUserId(value || '')}
                disabled={awarding || adminLeagues.length === 0 || !awardLeagueId || loadingAwardLeagueMembers}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder={
                    !awardLeagueId
                      ? 'Select a league first'
                      : loadingAwardLeagueMembers
                      ? 'Loading league members...'
                      : awardLeagueMembers.length === 0
                      ? 'No eligible users in this league'
                      : 'Select user'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {awardLeagueMembers.map((m) => (
                    <SelectItem key={m.user_id} value={String(m.user_id)}>
                      {m.username ? `${m.username} (${m.display_name})` : m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Season (optional)</label>
              <Input
                value={awardSeason}
                onChange={(e) => setAwardSeason(e.target.value)}
                placeholder="e.g., 2025"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAwardDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAwardBadge} disabled={awarding || !awardLeagueId || !awardUserId}>
              {awarding ? 'Awarding...' : 'Award Badge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;

