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

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Max 200 characters'),
  description: z.string().max(1000, 'Max 1000 characters').optional().or(z.literal('')),
  is_public: z.boolean().default(true),
  season: z.string().max(100, 'Max 100 characters').optional().or(z.literal('')),
});

const AdminPage = () => {
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
      toast.success('League created');
      navigate(`/leagues/${data.league.id}`);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || 'Failed to create league';
      if (status === 409) {
        toast.error('League name already exists');
        form.setError('name', { message: 'League name already exists' });
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
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users, leagues, and system settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PlusCircle className="h-5 w-5 mr-2" />
            Create League
          </CardTitle>
          <CardDescription>Create a new league. You will be added as league admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                name="name"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="League name" {...field} />
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
                      <Textarea placeholder="Optional description" rows={4} {...field} />
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
                        <Input placeholder="e.g., 2025 Spring" {...field} />
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
                        <FormLabel className="mb-1">Public League</FormLabel>
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

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create League'}
                </Button>
                <Button type="button" variant="outline" onClick={() => form.reset()} disabled={submitting}>
                  Reset
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Match Approvals</CardTitle>
          <CardDescription>Approve or reject matches awaiting admin action.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPending ? (
            <div className="py-8"><LoadingSpinner /></div>
          ) : pending.length === 0 ? (
            <div className="text-sm text-muted-foreground">No pending matches</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">When</th>
                    <th className="text-left font-medium px-3 py-2">League</th>
                    <th className="text-left font-medium px-3 py-2">Players</th>
                    <th className="text-left font-medium px-3 py-2">Result</th>
                    <th className="text-left font-medium px-3 py-2">Actions</th>
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
                          <Button size="sm" onClick={() => acceptMatch(m.id)}>Accept</Button>
                          <Button size="sm" variant="outline" onClick={() => rejectMatch(m.id)}>Reject</Button>
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
              <span>Total: {total}</span>
              <span>Page {page} / {pages}</span>
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
            Coming Soon
          </CardTitle>
          <CardDescription>More admin features will be added here.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will provide admin tools for managing users, approving matches, and monitoring system activity.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPage;

