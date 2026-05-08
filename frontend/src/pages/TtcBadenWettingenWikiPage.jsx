import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from '@/components/ui/button';

const TtcBadenWettingenWikiPage = () => {
  const { i18n, t } = useTranslation();

  return (
    <div className="tt-container py-8 md:py-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--fg)]">
              <span className="inline-flex items-start gap-2">
                <span>TTC Baden-Wettingen</span>
                <sup className="text-sm font-semibold text-[var(--accent)] inline-block -skew-y-3">wiki</sup>
              </span>
            </h1>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={i18n.language === 'de' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => i18n.changeLanguage('de')}
              >
                DE
              </Button>
              <Button
                type="button"
                variant={i18n.language === 'en' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => i18n.changeLanguage('en')}
              >
                EN
              </Button>
            </div>
          </header>

          <section id="material" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-semibold text-[var(--fg)]">{t('wiki.material.title')}</h2>
            <p className="text-sm text-[var(--fg-2)] leading-relaxed">
              <Trans
                i18nKey="wiki.material.text"
                components={{
                  email: (
                    <a
                      href="mailto:brunokreiner@hotmail.ch"
                      className="text-[var(--accent)] hover:opacity-80 underline"
                    />
                  ),
                  support: (
                    <Link to="/support" className="text-[var(--accent)] hover:opacity-80 underline" />
                  )
                }}
              />
            </p>
          </section>

          <section id="trainingsplan-jugend" className="space-y-4 scroll-mt-24">
            <h2 className="text-xl font-semibold text-[var(--fg)]">{t('wiki.trainingsplanJugend.title')}</h2>

            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[var(--fg)]">{t('wiki.trainingsplanJugend.monday')}</h3>
                <p className="text-sm text-[var(--fg-2)]">18:00 - 20:30</p>
                <p className="text-sm text-[var(--fg-2)]">
                  {t('wiki.trainingsplanJugend.baden')} -&gt;{' '}
                  <a
                    href="https://share.google/DJjlIIBNnQcPDDbqa"
                    className="text-[var(--accent)] hover:opacity-80 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    BBB Martinsberg
                  </a>
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[var(--fg)]">{t('wiki.trainingsplanJugend.tuesday')}</h3>
                <p className="text-sm text-[var(--fg-2)]">17:30 - 19:30</p>
                <p className="text-sm text-[var(--fg-2)]">
                  {t('wiki.trainingsplanJugend.wettingen')} -&gt;{' '}
                  <a
                    href="https://maps.app.goo.gl/j2an2j8ggnKDAjFP9"
                    className="text-[var(--accent)] hover:opacity-80 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Schulhaus Dorf
                  </a>
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[var(--fg)]">{t('wiki.trainingsplanJugend.thursday')}</h3>
                <p className="text-sm text-[var(--fg-2)]">17:30 - 19:30</p>
                <p className="text-sm text-[var(--fg-2)]">
                  {t('wiki.trainingsplanJugend.wettingen')} -&gt;{' '}
                  <a
                    href="https://maps.app.goo.gl/j2an2j8ggnKDAjFP9"
                    className="text-[var(--accent)] hover:opacity-80 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Schulhaus Dorf
                  </a>
                </p>
              </div>
            </div>
          </section>

          <section id="demnaechst" className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-semibold text-[var(--fg)]">{t('wiki.demnaechst.title')}</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--fg-2)]">
              <li>{t('wiki.demnaechst.item1')}</li>
              <li>{t('wiki.demnaechst.item2')}</li>
              <li>{t('wiki.demnaechst.item3')}</li>
            </ul>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 h-fit">
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--line-soft)' }}
          >
            <div className="eyebrow dotted">{t('wiki.chapters')}</div>
            <nav className="text-sm text-[var(--fg-3)]">
              <ul className="space-y-2">
                <li>
                  <a href="#material" className="hover:text-[var(--accent)] transition-colors">{t('wiki.material.title')}</a>
                </li>
                <li>
                  <a href="#trainingsplan-jugend" className="hover:text-[var(--accent)] transition-colors">{t('wiki.trainingsplanJugend.title')}</a>
                </li>
                <li>
                  <a href="#demnaechst" className="hover:text-[var(--accent)] transition-colors">{t('wiki.demnaechst.title')}</a>
                </li>
              </ul>
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TtcBadenWettingenWikiPage;
