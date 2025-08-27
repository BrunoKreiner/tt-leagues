import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { notificationsAPI, leaguesAPI } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Bell, UserPlus } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination';

const PAGE_SIZE = 10;

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // all | unread
  const [loading, setLoading] = useState(true);
  const [acceptLoading, setAcceptLoading] = useState({});
  const [deleteLoading, setDeleteLoading] = useState({});
  const [markingAll, setMarkingAll] = useState(false);

  const fetchData = async (opts = {}) => {
    const nextPage = opts.page ?? page;
    const nextFilter = opts.filter ?? filter;
    try {
      setLoading(true);
      const res = await notificationsAPI.getAll({
        page: nextPage,
        limit: PAGE_SIZE,
        unread_only: nextFilter === 'unread',
      });
      setItems(res.data.notifications || []);
      setPages(res.data.pagination?.pages || 1);
      setTotal(res.data.pagination?.total || 0);
      setUnreadCount(res.data.unread_count || 0);
    } catch (e) {
      console.error('Failed to load notifications', e);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter]);

  const handleMarkRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      await fetchData();
    } catch (e) {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await notificationsAPI.markAllAsRead();
      // if filter=unread, go back to page 1 since it may be empty now
      setPage(1);
      await fetchData({ page: 1 });
    } catch (e) {
      toast.error('Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleAcceptInvite = async (n) => {
    const leagueId = n.related_id;
    if (!leagueId) {
      toast.error('Missing league reference');
      return;
    }
    try {
      setAcceptLoading((s) => ({ ...s, [n.id]: true }));
      const res = await leaguesAPI.join(leagueId);
      toast.success(res.data?.message || 'Joined league');
      await notificationsAPI.markAsRead(n.id);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to accept invite';
      toast.error(msg);
    } finally {
      setAcceptLoading((s) => ({ ...s, [n.id]: false }));
    }
  };

  const handleDenyInvite = async (n) => {
    try {
      await notificationsAPI.markAsRead(n.id);
      await fetchData();
    } catch (e) {
      toast.error('Failed to deny (mark as read)');
    }
  };

  const handleDelete = async (id) => {
    try {
      setDeleteLoading((s) => ({ ...s, [id]: true }));
      await notificationsAPI.delete(id);
      toast.success('Notification deleted');
      await fetchData();
    } catch (e) {
      toast.error('Failed to delete notification');
    } finally {
      setDeleteLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const canPrev = page > 1;
  const canNext = page < pages;

  return (
    <div className="px-4 py-6 mx-auto w-full max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unreadCount} unread • {total} total</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => { setPage(1); setFilter('all'); }}
          >
            All
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            onClick={() => { setPage(1); setFilter('unread'); }}
          >
            Unread
          </Button>
          <Button variant="secondary" onClick={handleMarkAllRead} disabled={markingAll || unreadCount === 0}>
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-10"><LoadingSpinner /></div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No notifications</div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <div key={n.id} className={`p-3 rounded-md border ${!n.is_read ? 'bg-muted/40' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-muted-foreground">
                  {n.type === 'league_invite' ? (
                    <UserPlus className="h-5 w-5" />
                  ) : (
                    <Bell className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</div>
                      <div className="text-sm text-muted-foreground">{n.message}</div>
                      {n.created_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!n.is_read && (
                        <Button variant="ghost" size="sm" onClick={() => handleMarkRead(n.id)}>Read</Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(n.id)}
                        disabled={!!deleteLoading[n.id]}
                      >
                        {deleteLoading[n.id] ? 'Deleting…' : 'Delete'}
                      </Button>
                    </div>
                  </div>

                  {n.type === 'league_invite' && (
                    <div className="mt-3 flex items-center gap-2">
                      {!n.is_read ? (
                        <>
                          <Button size="sm" onClick={() => handleAcceptInvite(n)} disabled={!!acceptLoading[n.id]}>
                            {acceptLoading[n.id] ? 'Joining…' : 'Accept'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDenyInvite(n)}>
                            Deny
                          </Button>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">Invite handled</div>
                      )}
                      {n.related_id && (
                        <Link to={`/leagues/${n.related_id}`} className="text-xs text-primary underline">
                          View league
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
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

            {/* Simple numeric pages (optional) */}
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
    </div>
  );
}
