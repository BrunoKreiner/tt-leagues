import { Link } from 'react-router-dom';

const TtcBadenWettingenWikiPage = () => {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="cyberpunk-title text-3xl text-blue-300">TTC Baden-Wettingen Wiki</h1>
      </header>

      <section className="space-y-3">
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

      <section className="space-y-4">
        <h2 className="cyberpunk-subtitle text-xl">Trainingsplan Jugend</h2>
        <p className="text-sm text-gray-400">Trainingsplan fuer Anfaenger und Fortgeschrittene</p>

        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-gray-200">Montag</h3>
            <p className="text-sm text-gray-300">18:00 - 20:30</p>
            <p className="text-sm text-gray-300">
              Baden -{' '}
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
              Wettingen -{' '}
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
              Wettingen -{' '}
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

      <section className="space-y-3">
        <h2 className="cyberpunk-subtitle text-xl">Demnaechst auf dieser Seite</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
          <li>Liste der Trainingserfolge</li>
          <li>Trainingsplaene</li>
          <li>Trainingsmoral beim TTC Baden-Wettingen</li>
        </ul>
      </section>
    </div>
  );
};

export default TtcBadenWettingenWikiPage;
