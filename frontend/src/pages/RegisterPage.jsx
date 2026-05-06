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

const RegisterPage = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    email: '',
    website: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const { register, loading, error } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (validationErrors[e.target.name]) {
      setValidationErrors({ ...validationErrors, [e.target.name]: '' });
    }
  };

  const validateForm = () => {
    const errors = {};
    if (formData.username.length < 3) errors.username = t('auth.validation.usernameMin');
    if (formData.password.length < 6) errors.password = t('auth.validation.passwordMin');
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = t('auth.validation.passwordMismatch');
    if (!formData.first_name.trim()) errors.first_name = t('auth.validation.firstNameRequired');
    if (!formData.last_name.trim()) errors.last_name = t('auth.validation.lastNameRequired');
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) errors.email = t('auth.validation.emailInvalid');
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.website) return;
    if (!validateForm()) return;
    const data = { ...formData };
    delete data.confirmPassword;
    delete data.website;
    if (!data.email) delete data.email;
    await register(data);
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
              <Link to="/login">{t('auth.logIn')}</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 grid md:grid-cols-2">
        <div
          className="relative px-6 md:px-16 py-14 md:py-20 flex flex-col justify-between gap-12"
          style={{ borderRight: '1px solid var(--line-soft)' }}
        >
          <div>
            <div className="eyebrow dotted">{t('auth.register.eyebrow')}</div>
            <h1
              className="display mt-4"
              style={{
                fontSize: 'clamp(40px, 5.4vw, 56px)',
                lineHeight: '1.02',
                letterSpacing: '-0.03em',
              }}
            >
              {t('auth.register.titleLine1pre')}{' '}
              <span style={{ color: 'var(--accent)' }}>1200</span>.
              <br />
              <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>{t('auth.register.titleLine2')}</em>
            </h1>
            <p className="text-[16px] leading-[1.5] text-[var(--fg-2)] max-w-[420px] mt-5">
              {t('auth.register.lede')}
            </p>
          </div>
          <div className="font-mono text-[11px] text-[var(--fg-3)] tracking-[0.1em] uppercase">
            {t('auth.register.statline')}
          </div>
        </div>

        <div className="px-6 md:px-16 py-14 md:py-20 flex items-center justify-center">
          <form onSubmit={handleSubmit} className="w-full max-w-[420px]">
            <h2 className="text-[26px] font-bold tracking-tight mb-1.5">{t('auth.register.formTitle')}</h2>
            <p className="text-[14px] text-[var(--fg-3)] mb-7">
              {t('auth.register.formSub')}{' '}
              <Link to="/login" className="text-[var(--accent)] hover:underline">
                {t('auth.logIn')}
              </Link>
              .
            </p>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name" className="tt-field-label">
                    {t('auth.register.firstName')}
                  </Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    className="tt-field-input"
                    placeholder="Lina"
                    autoComplete="given-name"
                  />
                  {validationErrors.first_name && (
                    <p className="text-xs text-[var(--bad)]">{validationErrors.first_name}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name" className="tt-field-label">
                    {t('auth.register.lastName')}
                  </Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                    className="tt-field-input"
                    placeholder="Vogel"
                    autoComplete="family-name"
                  />
                  {validationErrors.last_name && (
                    <p className="text-xs text-[var(--bad)]">{validationErrors.last_name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="username" className="tt-field-label">
                  {t('auth.register.handle')}
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="tt-field-input"
                  placeholder="forehand_friend"
                  autoComplete="username"
                />
                {validationErrors.username && (
                  <p className="text-xs text-[var(--bad)]">{validationErrors.username}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="tt-field-label">
                  {t('auth.register.email')}
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="tt-field-input"
                  placeholder="you@club.com"
                  autoComplete="email"
                />
                {validationErrors.email && (
                  <p className="text-xs text-[var(--bad)]">{validationErrors.email}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="tt-field-label">
                  {t('auth.register.password')}
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
                    placeholder={t('auth.register.passwordPlaceholder')}
                    autoComplete="new-password"
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
                {validationErrors.password && (
                  <p className="text-xs text-[var(--bad)]">{validationErrors.password}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="tt-field-label">
                  {t('auth.register.confirmPassword')}
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="tt-field-input pr-10"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {validationErrors.confirmPassword && (
                  <p className="text-xs text-[var(--bad)]">{validationErrors.confirmPassword}</p>
                )}
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
                  {t('auth.register.creating')}
                </>
              ) : (
                t('auth.register.submit')
              )}
            </Button>
          </form>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default RegisterPage;
