import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Brand from '@/components/layout/Brand';
import SiteFooter from '@/components/layout/SiteFooter';
import { useTranslation } from 'react-i18next';

const LoginPage = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    website: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading, error } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.website) return;
    const data = { ...formData };
    delete data.website;
    await login(data);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="backdrop-blur-md"
        style={{ background: 'oklch(0.17 0.008 60 / 0.78)', borderBottom: '1px solid var(--line-soft)' }}
      >
        <div className="max-w-[1140px] mx-auto px-6 md:px-12">
          <div className="flex justify-between items-center h-16">
            <Brand />
            <Button asChild variant="ghost" size="sm">
              <Link to="/register">{t('auth.getStarted')}</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 grid md:grid-cols-2">
        {/* Editorial left */}
        <div
          className="relative px-6 md:px-16 py-14 md:py-20 flex flex-col justify-between gap-12"
          style={{ borderRight: '1px solid var(--line-soft)' }}
        >
          <div>
            <div className="eyebrow dotted">{t('auth.login.eyebrow')}</div>
            <h1
              className="display mt-4"
              style={{
                fontSize: 'clamp(40px, 5.4vw, 56px)',
                lineHeight: '1.02',
                letterSpacing: '-0.03em',
              }}
            >
              {t('auth.login.titleLine1')}
              <br />
              <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>{t('auth.login.titleLine2')}</em>
            </h1>
            <p className="text-[16px] leading-[1.5] text-[var(--fg-2)] max-w-[420px] mt-5">
              {t('auth.login.lede')}
            </p>
          </div>
          <div className="font-mono text-[11px] text-[var(--fg-3)] tracking-[0.1em] uppercase">
            {t('auth.login.statline')}
          </div>
        </div>

        {/* Form right */}
        <div className="px-6 md:px-16 py-14 md:py-20 flex items-center justify-center">
          <form onSubmit={handleSubmit} className="w-full max-w-[380px]">
            <h2 className="text-[26px] font-bold tracking-tight mb-1.5">{t('auth.login.formTitle')}</h2>
            <p className="text-[14px] text-[var(--fg-3)] mb-7">
              {t('auth.login.formSub')}{' '}
              <Link to="/register" className="text-[var(--accent)] hover:underline">
                {t('auth.login.createAccount')}
              </Link>
              .
            </p>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="tt-field-label">
                  {t('auth.login.username')}
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="tt-field-input"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="tt-field-label">
                  {t('auth.login.password')}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="tt-field-input pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Honeypot */}
            <div style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
              <Label htmlFor="website">Website (leave blank)</Label>
              <Input
                id="website"
                name="website"
                type="text"
                value={formData.website || ''}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-2)] rounded-full font-bold py-6 text-[15px] tt-btn-primary mt-7"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  {t('auth.login.signingIn')}
                </>
              ) : (
                t('auth.login.submit')
              )}
            </Button>

            <div className="text-center mt-5 text-[13px] text-[var(--fg-3)]">
              {t('auth.login.forgotPassword')}
            </div>
          </form>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default LoginPage;
