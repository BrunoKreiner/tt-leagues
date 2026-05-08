import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, ListChecks, Calendar, Globe } from 'lucide-react';
import { leaguesAPI } from '@/services/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PublicHeader from '@/components/layout/PublicHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const compareLeagues = (a, b, sort) => {
  switch (sort) {
    case 'created_desc':
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    case 'last_match_desc': {
      const aHas = a.last_match_at != null;
      const bHas = b.last_match_at != null;
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (!aHas && !bHas) return 0;
      return new Date(b.last_match_at).getTime() - new Date(a.last_match_at).getTime();
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

const matchesQuery = (league, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = typeof league?.name === 'string' ? league.name.toLowerCase() : '';
  const desc = typeof league?.description === 'string' ? league.description.toLowerCase() : '';
  const season = typeof league?.season === 'string' ? league.season.toLowerCase() : '';
  return name.includes(q) || desc.includes(q) || season.includes(q);
};

const PublicLeaguesPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('last_match_desc');

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await leaguesAPI.getAll({ page: 1, limit: 500 }, { ttlMs: 30000 });
        if (cancelled) return;
        const all = Array.isArray(res.data?.leagues) ? res.data.leagues : [];
        setLeagues(all.filter((l) => !!l.is_public));
      } catch (err) {
        if (cancelled) return;
        console.error('PublicLeaguesPage fetch error:', err);
        setError(err.response?.data?.error || 'Failed to load leagues');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const next = leagues.filter((l) => matchesQuery(l, query));
    next.sort((a, b) => compareLeagues(a, b, sort));
    return next;
  }, [leagues, query, sort]);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="pt-12 pb-20 md:pt-16 md:pb-24">
          <div className="max-w-[1140px] mx-auto px-6 md:px-12">
            <h1
              className="display leading-[1.02] mb-6"
              style={{ fontSize: 'clamp(36px, 4.6vw, 56px)' }}
            >
              {t('landing.public.title')}
            </h1>
            <p
              className="text-[15px] text-[var(--fg-3)] max-w-[640px] mb-10"
              style={{ fontFamily: '"Inter Tight", sans-serif' }}
            >
              {leagues.length} {leagues.length === 1 ? t('leagues.publicOneCount') : t('leagues.publicManyCount')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <div className="flex-1">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('leagues.searchPublicPlaceholder')}
                />
              </div>
              <div className="sm:w-72">
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('sort.label')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_match_desc">{t('sort.matchUpdatedDesc')}</SelectItem>
                    <SelectItem value="created_desc">{t('sort.createdDesc')}</SelectItem>
                    <SelectItem value="members_desc">{t('sort.membersDesc')}</SelectItem>
                    <SelectItem value="members_asc">{t('sort.membersAsc')}</SelectItem>
                    <SelectItem value="matches_desc">{t('sort.matchesDesc')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <LoadingSpinner size="md" />
              </div>
            ) : error ? (
              <p className="text-[var(--bad)] py-8">{error}</p>
            ) : filtered.length === 0 ? (
              <div className="ph h-24">
                <span>
                  {leagues.length === 0
                    ? t('landing.public.empty')
                    : t('leagues.noPublicMatchSearch')}
                </span>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((l) => (
                  <Link
                    key={l.id}
                    to={`/league/${l.id}`}
                    className="tt-card p-6 flex flex-col gap-3 transition-transform hover:-translate-y-0.5 hover:border-[var(--accent)]"
                    style={{ borderRadius: 'var(--r-lg)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="display text-[22px] leading-[1.15] truncate">
                        {l.name}
                      </h3>
                      <span className="chip flex items-center gap-1 shrink-0">
                        <Globe className="h-3 w-3" />
                        {t('leagues.public')}
                      </span>
                    </div>
                    {l.description && (
                      <p className="text-[14px] text-[var(--fg-3)] line-clamp-2">
                        {l.description}
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-3 font-mono text-[11px] text-[var(--fg-3)] uppercase tracking-wider">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {l.member_count || 0} {t('leagues.members')}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="h-3.5 w-3.5" />
                        {l.match_count || 0} {t('leagues.matches')}
                      </span>
                      {l.season && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {l.season}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default PublicLeaguesPage;
