import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="py-10 px-4 border-t border-gray-800/20 mt-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-500">
        <div className="flex items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/img/logo.png" alt="Logo" className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
            <span className="cyberpunk-title text-xs bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {t('app.title')}
            </span>
          </Link>
          <span className="text-gray-700/60">•</span>
          <span className="text-gray-600">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/contact" className="text-gray-500 hover:text-gray-300 transition-colors duration-200 underline underline-offset-4 decoration-gray-700 hover:decoration-gray-500">
            {t('footer.contact')}
          </Link>
          <Link to="/support" className="text-gray-500 hover:text-gray-300 transition-colors duration-200 underline underline-offset-4 decoration-gray-700 hover:decoration-gray-500">
            {t('footer.support')}
          </Link>
        </div>
      </div>
    </footer>
  );
}

