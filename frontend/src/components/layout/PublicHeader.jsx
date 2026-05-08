import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookOpen, Menu, X } from 'lucide-react';
import Brand from '@/components/layout/Brand';

/**
 * Shared sticky header for public pages (Landing, Login, Register).
 * Section anchor links smooth-scroll within the page when on / ,
 * otherwise navigate to / + hash (LandingPage scrolls to the hash on mount).
 */
export default function PublicHeader() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Close drawer on route change
  useEffect(() => {
    close();
  }, [location.pathname, close]);

  // Lock body scroll + ESC to close while drawer is open
  useEffect(() => {
    const onEscape = (e) => {
      if (e.key === 'Escape' && open) close();
    };
    if (open) {
      document.addEventListener('keydown', onEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, close]);

  const goSection = (id) => {
    if (location.pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate('/#' + id);
    }
  };

  return (
    <>
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{
          background: 'oklch(0.17 0.008 60 / 0.78)',
          borderBottom: '1px solid var(--line-soft)',
        }}
      >
        <div className="tt-container">
          <div className="flex items-center gap-7 h-16">
            <Brand />
            <nav className="hidden md:flex items-center gap-6 text-[14px] text-[var(--fg-2)]">
              <a
                onClick={() => goSection('how')}
                className="cursor-pointer hover:text-[var(--fg)] transition-colors"
              >
                {t('landing.nav.howItWorks')}
              </a>
              <a
                onClick={() => goSection('public')}
                className="cursor-pointer hover:text-[var(--fg)] transition-colors"
              >
                {t('landing.nav.publicLeagues')}
              </a>
              <Link
                to="/wiki/ttc-baden-wettingen"
                className="hover:text-[var(--fg)] transition-colors inline-flex items-center gap-1"
              >
                <BookOpen className="h-4 w-4" />
                <span className="inline-flex items-start gap-1">
                  <span>TTC BW</span>
                  <sup className="text-[10px] font-semibold text-[var(--accent)]">wiki</sup>
                </span>
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="font-mono text-[11px] tracking-wider uppercase">
                      {i18n.language === 'de' ? 'DE' : 'EN'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>
                      {t('language.english')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => i18n.changeLanguage('de')}>
                      {t('language.german')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">{t('auth.logIn')}</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-2)] font-bold rounded-full"
                >
                  <Link to="/register">{t('auth.getStarted')}</Link>
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen((v) => !v)}
                className="md:hidden h-10 w-10 p-0 flex items-center justify-center"
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
              >
                {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'oklch(0.10 0.005 50 / 0.6)', backdropFilter: 'blur(4px)' }}
        onClick={close}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <aside
        className={`fixed right-0 top-0 bottom-0 z-50 flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: 'min(82vw, 340px)',
          background: 'var(--bg-2)',
          borderLeft: '1px solid var(--line-soft)',
          boxShadow: '-20px 0 60px -10px oklch(0.10 0 0 / 0.5)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: 'var(--line-soft)' }}
        >
          <span className="eyebrow dotted">Menu</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={close}
            className="h-9 w-9 rounded-full p-0 border"
            style={{ background: 'var(--bg-3)', borderColor: 'var(--line)' }}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          <a
            onClick={() => {
              close();
              goSection('how');
            }}
            className="flex items-center gap-3.5 px-6 py-3.5 text-[15px] hover:bg-[var(--bg-3)]/50 cursor-pointer min-h-[44px]"
          >
            {t('landing.nav.howItWorks')}
          </a>
          <a
            onClick={() => {
              close();
              goSection('public');
            }}
            className="flex items-center gap-3.5 px-6 py-3.5 text-[15px] hover:bg-[var(--bg-3)]/50 cursor-pointer min-h-[44px]"
          >
            {t('landing.nav.publicLeagues')}
          </a>
          <Link
            to="/wiki/ttc-baden-wettingen"
            onClick={close}
            className="flex items-center gap-3.5 px-6 py-3.5 text-[15px] hover:bg-[var(--bg-3)]/50 min-h-[44px]"
          >
            <BookOpen className="h-4 w-4" />
            <span className="inline-flex items-start gap-1">
              <span>TTC Baden-Wettingen</span>
              <sup className="text-[10px] font-semibold text-[var(--accent)]">wiki</sup>
            </span>
          </Link>
        </nav>
        <div
          className="px-6 py-5 border-t flex flex-col gap-3"
          style={{ borderColor: 'var(--line-soft)' }}
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">{t('language.label', 'Language')}</span>
            <div className="inline-flex rounded-full border" style={{ borderColor: 'var(--line)' }}>
              <button
                type="button"
                onClick={() => i18n.changeLanguage('en')}
                className={`px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded-l-full transition-colors ${
                  i18n.language !== 'de'
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'text-[var(--fg-3)] hover:text-[var(--fg)]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => i18n.changeLanguage('de')}
                className={`px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded-r-full transition-colors ${
                  i18n.language === 'de'
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'text-[var(--fg-3)] hover:text-[var(--fg)]'
                }`}
              >
                DE
              </button>
            </div>
          </div>
          <Button
            asChild
            className="w-full bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-2)] font-bold rounded-full"
          >
            <Link to="/register" onClick={close}>
              {t('auth.getStarted')}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full rounded-full">
            <Link to="/login" onClick={close}>
              {t('auth.logIn')}
            </Link>
          </Button>
        </div>
      </aside>
    </>
  );
}
