import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { matchesAPI } from '@/services/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

export default function MatchesPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('all'); // all | accepted | pending
  const [loading, setLoading] = useState(true);

  const me = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);

  const fetchData = async (opts = {}) => {
    const nextPage = opts.page ?? page;
    const nextStatus = opts.status ?? status;
    try {
      setLoading(true);
      const res = await matchesAPI.getAll({ page: nextPage, limit: PAGE_SIZE, status: nextStatus });
      setItems(res.data.matches || []);
      setPages(res.data.pagination?.pages || 1);
      setTotal(res.data.pagination?.total || 0);
    } catch (e) {
      console.error('Failed to load matches', e);
      toast.error(t('matches.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  const canPrev = page > 1;
  const canNext = page < pages;

  const youVsLabel = (m) => {
    const myUsername = me?.username;
    if (!myUsername) return `${m.player1_username} vs ${m.player2_username}`;
    if (m.player1_username === myUsername) return `You vs ${m.player2_username}`;
    if (m.player2_username === myUsername) return `${m.player1_username} vs You`;
    return `${m.player1_username} vs ${m.player2_username}`;
  };

  const yourEloDelta = (m) => {
    if (!m.is_accepted) return null;
    const myUsername = me?.username;
    if (!myUsername) return null;
    if (m.player1_username === myUsername && m.player1_elo_after != null && m.player1_elo_before != null) {
      return m.player1_elo_after - m.player1_elo_before;
    }
    if (m.player2_username === myUsername && m.player2_elo_after != null && m.player2_elo_before != null) {
      return m.player2_elo_after - m.player2_elo_before;
    }
    return null;
  };

  const formatWhen = (m) => {
    const ts = m.played_at || m.created_at;
    if (!ts) return '-';
    try {
      return format(new Date(ts), 'PP p');
    } catch {
      return String(ts);
    }
  };

  return (
    <div className="px-4 py-6 mx-auto w-full max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('nav.matches')}</h1>
          <p className="text-sm text-muted-foreground">{t('common.totalN', { count: total })}</p>
        </div>
        <div>
          <Button asChild>
            <Link to="/matches/record">{t('cta.recordMatch')}</Link>
          </Button>
        </div>
      </div>

      <Tabs value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
        <TabsList>
          <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
          <TabsTrigger value="accepted">{t('status.accepted')}</TabsTrigger>
          <TabsTrigger value="pending">{t('status.pending')}</TabsTrigger>
        </TabsList>

        <TabsContent value={status} className="mt-4">
          {loading ? (
            <div className="py-10"><LoadingSpinner /></div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('matches.empty')}</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">{t('table.when')}</th>
                    <th className="text-left font-medium px-3 py-2">{t('table.league')}</th>
                    <th className="text-left font-medium px-3 py-2">{t('table.players')}</th>
                    <th className="text-left font-medium px-3 py-2">{t('table.result')}</th>
                    <th className="text-left font-medium px-3 py-2">{t('table.status')}</th>
                    <th className="text-left font-medium px-3 py-2">{t('table.elo')}</th>
                    <th className="text-left font-medium px-3 py-2">{t('table.yourDeltaElo')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => {
                    const delta = yourEloDelta(m);
                    const deltaFmt = delta == null ? '-' : (delta > 0 ? `+${delta}` : `${delta}`);
                    return (
                      <tr key={m.id} className="border-t">
                        <td className="px-3 py-2"><Link to={`/matches/${m.id}`}>{formatWhen(m)}</Link></td>
                        <td className="px-3 py-2"><Link to={`/matches/${m.id}`}>{m.league_name}</Link></td>
                        <td className="px-3 py-2"><Link to={`/matches/${m.id}`}>{youVsLabel(m)}</Link></td>
                        <td className="px-3 py-2"><Link to={`/matches/${m.id}`}>{m.player1_sets_won}-{m.player2_sets_won}</Link></td>
                        <td className="px-3 py-2">{m.is_accepted ? t('status.accepted') : t('status.pending')}</td>
                        <td className="px-3 py-2">
                          {m.is_accepted ? (
                            m.elo_applied ? (
                              <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs">{t('elo.applied')}</span>
                            ) : (
                              <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs bg-amber-50">{t('elo.deferred')}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{deltaFmt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6">
            <Pagination>
              <PaginationContent>
                {canPrev && (
                  <PaginationItem>
                    <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }} />
                  </PaginationItem>
                )}

                <PaginationItem>
                  <PaginationLink isActive>{page}</PaginationLink>
                </PaginationItem>
                <span className="px-1 self-center text-sm text-muted-foreground">/ {pages}</span>

                {canNext && (
                  <PaginationItem>
                    <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(pages, p + 1)); }} />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

