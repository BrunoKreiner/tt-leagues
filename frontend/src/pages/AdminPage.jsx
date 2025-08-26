import { useState } from 'react';
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
import { leaguesAPI } from '@/services/api';
import { toast } from 'sonner';
import { Shield, PlusCircle } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Max 200 characters'),
  description: z.string().max(1000, 'Max 1000 characters').optional().or(z.literal('')),
  is_public: z.boolean().default(true),
  season: z.string().max(100, 'Max 100 characters').optional().or(z.literal('')),
});

const AdminPage = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      is_public: true,
      season: '',
    },
  });

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

