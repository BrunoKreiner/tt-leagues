import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SiteFooter from '@/components/layout/SiteFooter';

export default function ContactPage() {
  const toEmail = 'brunokreiner@hotmail.ch';
  const [name, setName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const mailtoHref = useMemo(() => {
    const bodyLines = [
      `From: ${name}`.trim(),
      `Reply-to: ${fromEmail}`.trim(),
      '',
      message,
    ].filter((l) => l != null).join('\n');

    const params = new URLSearchParams({
      subject: subject.trim() || 'Contact',
      body: bodyLines,
    });
    return `mailto:${toEmail}?${params.toString()}`;
  }, [name, fromEmail, subject, message]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-white">Contact</h1>
              <p className="text-sm text-gray-400">
                Send a message — it will open your email client addressed to <span className="text-gray-200">{toEmail}</span>.
              </p>
            </div>

            <Card className="vg-card">
              <CardHeader>
                <CardTitle className="text-gray-100">Message</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    window.location.href = mailtoHref;
                  }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name" className="text-gray-300">Name</Label>
                      <Input
                        id="contact-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-email" className="text-gray-300">Email</Label>
                      <Input
                        id="contact-email"
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        placeholder="you@example.com"
                        type="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-subject" className="text-gray-300">Subject</Label>
                    <Input
                      id="contact-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="What’s this about?"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-message" className="text-gray-300">Message</Label>
                    <Textarea
                      id="contact-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Write your message…"
                      rows={6}
                      required
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit">Open email</Button>
                    <Button asChild variant="outline">
                      <a href={mailtoHref}>Open in mail app</a>
                    </Button>
                    <Button asChild variant="ghost">
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

