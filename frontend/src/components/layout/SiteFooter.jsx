import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="py-8 px-4 border-t border-gray-800/30">
      <div className="max-w-5xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/img/logo.png" alt="Logo" className="h-5 w-5 group-hover:scale-105 transition-transform" />
            <span className="cyberpunk-title text-sm bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {t('app.title')}
            </span>
          </Link>
          <span className="text-gray-700">•</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/contact" className="text-gray-400 hover:text-gray-200 underline underline-offset-4">
            {t('footer.contact')}
          </Link>
          <Link to="/support" className="text-gray-400 hover:text-gray-200 underline underline-offset-4">
            {t('footer.support')}
          </Link>
        </div>
      </div>
    </footer>
  );
}

