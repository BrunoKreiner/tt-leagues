import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { leaguesAPI } from '@/services/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Users, ListChecks, Calendar, Lock, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LeaguesPage = () => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [myQuery, setMyQuery] = useState('');
  const [publicQuery, setPublicQuery] = useState('');
  const [mySort, setMySort] = useState('created_desc');
  const [publicSort, setPublicSort] = useState('created_desc');

  useEffect(() => {
    let cancelled = false;
    const fetchLeagues = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch all pages so we can filter/split client-side.
        const PAGE_LIMIT = 50;
        const first = await leaguesAPI.getAll({ page: 1, limit: PAGE_LIMIT });
        const firstData = first.data;
        const firstLeagues = firstData.leagues || [];
        const pagesTotal = Number(firstData.pagination?.pages || 1);

        let all = firstLeagues;
        if (pagesTotal > 1) {
          const restPages = Array.from({ length: pagesTotal - 1 }).map((_, idx) => idx + 2);
          const rest = await Promise.all(restPages.map((p) => leaguesAPI.getAll({ page: p, limit: PAGE_LIMIT })));
          const restLeagues = rest.flatMap((r) => r.data.leagues || []);
          all = [...firstLeagues, ...restLeagues];
        }

        if (cancelled) return;
        setLeagues(all);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.error || 'Failed to load leagues');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLeagues();
    return () => { cancelled = true; };
  }, []);

  const matchesQuery = (league, query) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const name = typeof league?.name === 'string' ? league.name.toLowerCase() : '';
    const desc = typeof league?.description === 'string' ? league.description.toLowerCase() : '';
    const season = typeof league?.season === 'string' ? league.season.toLowerCase() : '';
    return name.includes(q) || desc.includes(q) || season.includes(q);
  };

  const myLeagues = useMemo(
    () => (leagues || []).filter((l) => !!l.is_member),
    [leagues]
  );

  const publicLeagues = useMemo(
    () => (leagues || []).filter((l) => !!l.is_public && !l.is_member),
    [leagues]
  );

  const myFiltered = useMemo(
    () => myLeagues.filter((l) => matchesQuery(l, myQuery)),
    [myLeagues, myQuery]
  );

  const compareLeagues = (a, b, sort) => {
    switch (sort) {
      case 'created_desc': {
        const at = new Date(a.created_at).getTime();
        const bt = new Date(b.created_at).getTime();
        return bt - at;
      }
      case 'last_match_desc': {
        const aHas = a.last_match_at != null;
        const bHas = b.last_match_at != null;
        if (aHas !== bHas) return aHas ? -1 : 1;
        if (!aHas && !bHas) return 0;
        const at = new Date(a.last_match_at).getTime();
        const bt = new Date(b.last_match_at).getTime();
        return bt - at;
      }
      case 'members_desc':
        return Number(b.member_count) - Number(a.member_count);
      case 'members_asc':
        return Number(a.member_count) - Number(b.member_count);
      case 'matches_desc':
        return Number(b.match_count) - Number(a.match_count);
      default:
        return 0;
    }
  };

  const mySorted = useMemo(() => {
    const next = [...myFiltered];
    next.sort((a, b) => compareLeagues(a, b, mySort));
    return next;
  }, [myFiltered, mySort]);

  const publicFiltered = useMemo(
    () => publicLeagues.filter((l) => matchesQuery(l, publicQuery)),
    [publicLeagues, publicQuery]
  );

  const publicSorted = useMemo(() => {
    const next = [...publicFiltered];
    next.sort((a, b) => compareLeagues(a, b, publicSort));
    return next;
  }, [publicFiltered, publicSort]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('nav.leagues')}</h1>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link to="/app/admin">{t('admin.createLeague')}</Link>
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('common.error')}</CardTitle>
            <CardDescription className="text-red-500">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : leagues.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="h-5 w-5 mr-2" />
              {t('leagues.empty')}
            </CardTitle>
            <CardDescription>{t('leagues.emptyHint')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-10">
          {/* My leagues */}
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">My Leagues</h2>
                <p className="text-sm text-gray-500">{myLeagues.length} total</p>
              </div>
              <div className="w-full sm:w-[520px] flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    value={myQuery}
                    onChange={(e) => setMyQuery(e.target.value)}
                    placeholder="Search your leagues…"
                  />
                </div>
                <div className="sm:w-64">
                  <Select value={mySort} onValueChange={setMySort}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('sort.label')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_desc">{t('sort.createdDesc')}</SelectItem>
                      <SelectItem value="last_match_desc">{t('sort.matchUpdatedDesc')}</SelectItem>
                      <SelectItem value="members_desc">{t('sort.membersDesc')}</SelectItem>
                      <SelectItem value="members_asc">{t('sort.membersAsc')}</SelectItem>
                      <SelectItem value="matches_desc">{t('sort.matchesDesc')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {mySorted.length === 0 ? (
              <div className="text-sm text-gray-500">No leagues match your search.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mySorted.map((l) => (
                  <Card
                    key={l.id}
                    className="vg-card cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => window.location.href = `/app/leagues/${l.id}`}
                  >
                    <CardHeader className="space-y-1">
                      <div className="flex items-center justify-between">
                        <CardTitle className="cyberpunk-subtitle text-xl truncate text-blue-400">
                          {l.name}
                        </CardTitle>
                        <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                          {l.is_public ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                          {l.is_public ? t('leagues.public') : t('leagues.private')}
                        </Badge>
                      </div>
                      {l.description ? (
                        <CardDescription className="line-clamp-2 text-gray-400">{l.description}</CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent className="mt-auto">
                      <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {l.member_count} {t('leagues.members')}</span>
                        <span className="flex items-center gap-1"><ListChecks className="h-4 w-4" /> {l.match_count} {t('leagues.matches')}</span>
                        {l.season ? (
                          <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {l.season}</span>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Public leagues */}
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Public leagues</h2>
                <p className="text-sm text-gray-500">{publicLeagues.length} total</p>
              </div>
              <div className="w-full sm:w-[520px] flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    value={publicQuery}
                    onChange={(e) => setPublicQuery(e.target.value)}
                    placeholder="Search public leagues…"
                  />
                </div>
                <div className="sm:w-64">
                  <Select value={publicSort} onValueChange={setPublicSort}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('sort.label')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_desc">{t('sort.createdDesc')}</SelectItem>
                      <SelectItem value="last_match_desc">{t('sort.matchUpdatedDesc')}</SelectItem>
                      <SelectItem value="members_desc">{t('sort.membersDesc')}</SelectItem>
                      <SelectItem value="members_asc">{t('sort.membersAsc')}</SelectItem>
                      <SelectItem value="matches_desc">{t('sort.matchesDesc')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {publicSorted.length === 0 ? (
              <div className="text-sm text-gray-500">No public leagues match your search.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {publicSorted.map((l) => (
                  <Card
                    key={l.id}
                    className="vg-card cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => window.location.href = `/app/leagues/${l.id}`}
                  >
                    <CardHeader className="space-y-1">
                      <div className="flex items-center justify-between">
                        <CardTitle className="cyberpunk-subtitle text-xl truncate text-blue-400">
                          {l.name}
                        </CardTitle>
                        <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                          <Globe className="h-3.5 w-3.5" />
                          {t('leagues.public')}
                        </Badge>
                      </div>
                      {l.description ? (
                        <CardDescription className="line-clamp-2 text-gray-400">{l.description}</CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent className="mt-auto">
                      <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {l.member_count} {t('leagues.members')}</span>
                        <span className="flex items-center gap-1"><ListChecks className="h-4 w-4" /> {l.match_count} {t('leagues.matches')}</span>
                        {l.season ? (
                          <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {l.season}</span>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default LeaguesPage;

