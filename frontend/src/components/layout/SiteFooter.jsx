import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Brand from '@/components/layout/Brand';

export default function SiteFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="pt-14 pb-20 text-[var(--fg-3)]" style={{ borderTop: '1px solid var(--line-soft)' }}>
      <div className="tt-container">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between sm:items-end">
          <div>
            <Brand />
            <p className="mt-3.5 text-[13px] text-[var(--fg-3)] max-w-[320px] leading-relaxed">
              {t('landing.footer.tagline')}
            </p>
          </div>
          <div className="flex flex-wrap gap-12 text-[13px]">
            <div>
              <div className="eyebrow mb-2.5">{t('landing.footer.product')}</div>
              <div className="grid gap-2 text-[var(--fg-2)]">
                <Link to="/" className="hover:text-[var(--fg)]">{t('landing.footer.features')}</Link>
                <Link to="/wiki/ttc-baden-wettingen" className="hover:text-[var(--fg)]">
                  TTC Baden-Wettingen <sup className="text-[10px] text-[var(--accent)]">wiki</sup>
                </Link>
                <Link to="/login" className="hover:text-[var(--fg)]">{t('auth.logIn')}</Link>
                <Link to="/register" className="hover:text-[var(--fg)]">{t('auth.getStarted')}</Link>
              </div>
            </div>
            <div>
              <div className="eyebrow mb-2.5">{t('landing.footer.project')}</div>
              <div className="grid gap-2 text-[var(--fg-2)]">
                <a href="https://github.com/BrunoKreiner/tt-leagues" target="_blank" rel="noreferrer" className="hover:text-[var(--fg)]">
                  GitHub
                </a>
                <Link to="/contact" className="hover:text-[var(--fg)]">{t('footer.contact')}</Link>
                <Link to="/support" className="hover:text-[var(--fg)]">{t('footer.support')}</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="hairline mt-10 mb-4" />

        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-[var(--fg-4)] font-mono text-[11px]">
          <span>© {year} leagues.lol · MIT</span>
          <span>v2 · est. ELO 1200</span>
        </div>
      </div>
    </footer>
  );
}
