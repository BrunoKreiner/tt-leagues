import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { leaguesAPI } from '@/services/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination';
import { Trophy, Users, ListChecks, Calendar, Lock, Globe } from 'lucide-react';

const LeaguesPage = () => {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });

  const page = Number(searchParams.get('page') || 1);
  const limit = 10;

  useEffect(() => {
    let cancelled = false;
    const fetchLeagues = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await leaguesAPI.getAll({ page, limit });
        if (cancelled) return;
        setLeagues(data.leagues || []);
        setPagination(data.pagination || { page, pages: 1, total: 0, limit });
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.error || 'Failed to load leagues');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLeagues();
    return () => { cancelled = true; };
  }, [page]);

  const goToPage = (nextPage) => {
    setSearchParams({ page: String(nextPage) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leagues</h1>
          <p className="text-muted-foreground">Browse and join table tennis leagues.</p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link to="/admin">Create League</Link>
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription className="text-red-500">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : leagues.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="h-5 w-5 mr-2" />
              No leagues yet
            </CardTitle>
            <CardDescription>Check back later or create one if you're an admin.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leagues.map((l) => (
            <Card key={l.id} className="flex flex-col">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl truncate">
                    <Link to={`/leagues/${l.id}`} className="hover:underline">{l.name}</Link>
                  </CardTitle>
                  <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                    {l.is_public ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {l.is_public ? 'Public' : 'Private'}
                  </Badge>
                </div>
                {l.description && (
                  <CardDescription className="line-clamp-2">{l.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="mt-auto">
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {l.member_count} members</span>
                  <span className="flex items-center gap-1"><ListChecks className="h-4 w-4" /> {l.match_count} matches</span>
                  {l.season && (
                    <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {l.season}</span>
                  )}
                </div>
                <div className="pt-4">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/leagues/${l.id}`}>View details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && pagination.pages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => goToPage(Math.max(1, pagination.page - 1))} />
            </PaginationItem>
            {/* Simple 1..N pager */}
            {Array.from({ length: pagination.pages }).map((_, idx) => {
              const p = idx + 1;
              return (
                <PaginationItem key={p}>
                  <PaginationLink isActive={p === pagination.page} onClick={() => goToPage(p)}>
                    {p}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext onClick={() => goToPage(Math.min(pagination.pages, pagination.page + 1))} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default LeaguesPage;

