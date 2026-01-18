import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const TtcBadenWettingenWikiPage = () => {
  const { i18n } = useTranslation();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mt-8">
            <h1 className="cyberpunk-title text-3xl text-blue-300">
              <span className="inline-flex items-start gap-2">
                <span>TTC Baden-Wettingen</span>
                <sup className="text-sm font-semibold text-blue-400 inline-block -skew-y-3">wiki</sup>
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
            <h2 className="cyberpunk-subtitle text-xl">Material</h2>
            <p className="text-sm text-gray-300 leading-relaxed">
              Bevor du neues Material kaufst, kontaktiere bitte{' '}
              <a
                href="mailto:brunokreiner@hotmail.ch"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                brunokreiner@hotmail.ch
              </a>{' '}
              oder die{' '}
              <Link to="/support" className="text-blue-400 hover:text-blue-300 underline">
                Support-Seite
              </Link>{' '}
              im Footer. Wir koennen alles rund um Material uebernehmen und deutlich guenstiger
              verkaufen als offizielle Shops, zum Beispiel nationale Stores. Wir verkaufen auch
              gebrauchtes Material und kaufen im Ausland mit Rabatten bzw. in groesseren Mengen ein.
              (Offizielle Shop-Seite folgt bald.)
            </p>
          </section>

          <section id="trainingsplan-jugend" className="space-y-4 scroll-mt-24">
            <h2 className="cyberpunk-subtitle text-xl">Trainingsplan Jugend</h2>
            <p className="text-sm text-gray-400">Trainingsplan fuer Anfaenger und Fortgeschrittene</p>

            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-gray-200">Montag</h3>
                <p className="text-sm text-gray-300">18:00 - 20:30</p>
                <p className="text-sm text-gray-300">
                  Baden -&gt;{' '}
                  <a
                    href="https://share.google/DJjlIIBNnQcPDDbqa"
                    className="text-blue-400 hover:text-blue-300 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    BBB Martinsberg
                  </a>
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-gray-200">Dienstag</h3>
                <p className="text-sm text-gray-300">17:30 - 19:30</p>
                <p className="text-sm text-gray-300">
                  Wettingen -&gt;{' '}
                  <a
                    href="https://maps.app.goo.gl/j2an2j8ggnKDAjFP9"
                    className="text-blue-400 hover:text-blue-300 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Schulhaus Dorf
                  </a>
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-gray-200">Donnerstag</h3>
                <p className="text-sm text-gray-300">17:30 - 19:30</p>
                <p className="text-sm text-gray-300">
                  Wettingen -&gt;{' '}
                  <a
                    href="https://maps.app.goo.gl/j2an2j8ggnKDAjFP9"
                    className="text-blue-400 hover:text-blue-300 underline"
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
            <h2 className="cyberpunk-subtitle text-xl">Demnächst auf dieser Seite</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
              <li>Liste der Trainingserfolge</li>
              <li>Trainingsplaene</li>
              <li>Trainingsmoral beim TTC Baden-Wettingen</li>
            </ul>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 h-fit">
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-200">Kapitel</div>
            <nav className="text-sm text-gray-400">
              <ul className="space-y-2">
                <li>
                  <a href="#material" className="hover:text-blue-300">Material</a>
                </li>
                <li>
                  <a href="#trainingsplan-jugend" className="hover:text-blue-300">Trainingsplan Jugend</a>
                </li>
                <li>
                  <a href="#demnaechst" className="hover:text-blue-300">Demnächst</a>
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
