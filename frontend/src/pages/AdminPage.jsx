import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { leaguesAPI, matchesAPI } from '@/services/api';
import { toast } from 'sonner';
import { Shield, PlusCircle } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useTranslation } from 'react-i18next';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Max 200 characters'),
  description: z.string().max(1000, 'Max 1000 characters').optional().or(z.literal('')),
  is_public: z.boolean().default(true),
  season: z.string().max(100, 'Max 100 characters').optional().or(z.literal('')),
});

const AdminPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Pending matches state (admin approvals)
  const [pending, setPending] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

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

  useEffect(() => {
    fetchPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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
                      <td className="px-3 py-2">{m.player1_username} vs {m.player2_username}</td>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            {t('admin.comingSoon')}
          </CardTitle>
          <CardDescription>{t('admin.comingSoonDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t('admin.moreAdminCopy')}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPage;

