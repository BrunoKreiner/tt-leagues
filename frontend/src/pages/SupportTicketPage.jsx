import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SiteFooter from '@/components/layout/SiteFooter';
import { ticketsAPI } from '@/services/api';
import { toast } from 'sonner';

const schema = z.object({
  category: z.enum(['bug_report', 'feature_request', 'question', 'account', 'other']),
  subject: z.string().max(200, 'Max 200 characters').optional().or(z.literal('')),
  email: z.string().email('Must be a valid email').max(255, 'Max 255 characters').optional().or(z.literal('')),
  message: z.string().min(1, 'Message is required').max(5000, 'Max 5000 characters'),
});

const categoryLabels = {
  bug_report: 'Report a bug',
  feature_request: 'New feature idea',
  question: 'Question',
  account: 'Account / login issue',
  other: 'Other',
};

export default function SupportTicketPage() {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'bug_report',
      subject: '',
      email: '',
      message: '',
    },
  });

  const onSubmit = async (values) => {
    try {
      setSubmitting(true);
      const payload = {
        category: values.category,
        subject: values.subject?.trim() || undefined,
        email: values.email?.trim() || undefined,
        message: values.message.trim(),
      };

      await ticketsAPI.create(payload);
      toast.success('Ticket sent. Thank you!');
      form.reset({
        category: 'bug_report',
        subject: '',
        email: '',
        message: '',
      });
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to send ticket';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const category = form.watch('category');

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-white">Support</h1>
              <p className="text-sm text-gray-400">
                Send feedback to the site admin. You can report bugs, suggest features, or ask questions.
              </p>
            </div>

            <Card className="vg-card">
              <CardHeader>
                <CardTitle className="text-gray-100">Submit a ticket</CardTitle>
                <CardDescription>
                  Category: <span className="text-gray-200">{categoryLabels[category]}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Category</Label>
                      <Select
                        value={form.getValues('category')}
                        onValueChange={(v) => form.setValue('category', v, { shouldValidate: true })}
                        disabled={submitting}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(categoryLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.category && (
                        <div className="text-sm text-red-400">{form.formState.errors.category.message}</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ticket-email" className="text-gray-300">Email (optional)</Label>
                      <Input
                        id="ticket-email"
                        type="email"
                        placeholder="you@example.com"
                        disabled={submitting}
                        {...form.register('email')}
                      />
                      {form.formState.errors.email && (
                        <div className="text-sm text-red-400">{form.formState.errors.email.message}</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ticket-subject" className="text-gray-300">Subject (optional)</Label>
                    <Input
                      id="ticket-subject"
                      placeholder="Short summary"
                      disabled={submitting}
                      {...form.register('subject')}
                    />
                    {form.formState.errors.subject && (
                      <div className="text-sm text-red-400">{form.formState.errors.subject.message}</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ticket-message" className="text-gray-300">Message</Label>
                    <Textarea
                      id="ticket-message"
                      placeholder="Describe the issue or idea in detail…"
                      rows={8}
                      disabled={submitting}
                      {...form.register('message')}
                    />
                    {form.formState.errors.message && (
                      <div className="text-sm text-red-400">{form.formState.errors.message.message}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Sending…' : 'Send ticket'}
                    </Button>
                    <Button asChild variant="ghost" disabled={submitting}>
                      <Link to="/">Back to landing</Link>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

