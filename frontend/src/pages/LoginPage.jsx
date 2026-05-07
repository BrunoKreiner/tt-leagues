import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import PublicHeader from '@/components/layout/PublicHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { BrandMark } from '@/components/layout/Brand';
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
      <PublicHeader />

      <div className="flex-1 grid md:grid-cols-2">
        {/* Editorial left */}
        <div
          className="relative px-6 md:px-16 py-14 md:py-20 flex flex-col items-center justify-center gap-8 text-center"
          style={{ borderRight: '1px solid var(--line-soft)' }}
        >
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center justify-center text-white shrink-0">
              <BrandMark size={64} />
            </span>
            <h1
              className="font-sans font-bold leading-[0.95]"
              style={{
                fontSize: 'clamp(44px, 5.6vw, 72px)',
                letterSpacing: '-0.04em',
                color: '#ffffff',
              }}
            >
              leagues<span style={{ color: 'var(--accent)' }}>.lol</span>
            </h1>
          </div>
          <p
            className="display"
            style={{
              fontSize: 'clamp(20px, 2.4vw, 28px)',
              fontStyle: 'italic',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--fg-2)',
            }}
          >
            {t('auth.login.tagline')}
          </p>
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
