import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SiteFooter from '@/components/layout/SiteFooter';
import { useTranslation } from 'react-i18next';
import { Turnstile } from 'react-turnstile';

const RegisterPage = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    email: '',
    website: '', // Honeypot field
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaError, setCaptchaError] = useState(false);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileRef = useRef(null);
  const { register, loading, error } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    
    // Clear validation error for this field
    if (validationErrors[e.target.name]) {
      setValidationErrors({
        ...validationErrors,
        [e.target.name]: '',
      });
    }
  };

  const validateForm = () => {
    const errors = {};

    if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters long';
    }

    if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      errors.last_name = 'Last name is required';
    }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check honeypot field
    if (formData.website) {
      // Bot detected - silently fail
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    // Check CAPTCHA - REQUIRED
    if (!captchaToken) {
      if (turnstileRef.current) {
        try {
          turnstileRef.current.execute();
          // Wait for token
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!captchaToken) {
            setCaptchaError(true);
            return;
          }
        } catch (error) {
          console.error('Turnstile execution error:', error);
          setCaptchaError(true);
          return;
        }
      } else {
        setCaptchaError(true);
        return;
      }
    }

    const registrationData = { ...formData };
    delete registrationData.confirmPassword;
    delete registrationData.website; // Remove honeypot field
    if (!registrationData.email) {
      delete registrationData.email; // omit empty email so BE treats it as truly optional
    }
    
    // Add CAPTCHA token - REQUIRED
    registrationData.captchaToken = captchaToken;
    
    await register(registrationData);
  };

  const handleCaptchaSuccess = (token) => {
    setCaptchaToken(token);
    setCaptchaError(false);
    setTurnstileReady(true);
  };

  const handleCaptchaError = (error) => {
    console.error('Turnstile error:', error);
    setCaptchaError(true);
    setCaptchaToken(null);
    setTurnstileReady(false);
  };

  const handleCaptchaExpire = () => {
    setCaptchaToken(null);
    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  };

  // Auto-execute Turnstile on mount (invisible mode)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (turnstileRef.current) {
        try {
          turnstileRef.current.execute();
        } catch (error) {
          console.error('Turnstile execution error:', error);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800">
      <header className="border-b border-gray-800/60 bg-gradient-to-r from-gray-900/95 via-gray-900/98 to-gray-900/95 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2 group">
              <img src="/img/logo.png" alt="Logo" className="h-8 w-8 group-hover:scale-105 transition-transform" />
              <span className="cyberpunk-title text-lg bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {t('app.title')}
              </span>
            </Link>
            <Button variant="ghost" size="sm" asChild className="text-gray-400 hover:text-white">
              <Link to="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md vg-card no-hover">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-blue-300">Register</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-gray-300">First Name</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    placeholder="John"
                  />
                  {validationErrors.first_name && (
                    <p className="text-sm text-red-600">{validationErrors.first_name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-gray-300">Last Name</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                    placeholder="Doe"
                  />
                  {validationErrors.last_name && (
                    <p className="text-sm text-red-600">{validationErrors.last_name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-300">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  placeholder="player123"
                />
                {validationErrors.username && (
                  <p className="text-sm text-red-600">{validationErrors.username}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">Email (optional)</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                />
                {validationErrors.email && (
                  <p className="text-sm text-red-600">{validationErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {validationErrors.password && (
                  <p className="text-sm text-red-600">{validationErrors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-300">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {validationErrors.confirmPassword && (
                  <p className="text-sm text-red-600">{validationErrors.confirmPassword}</p>
                )}
              </div>

              {/* Honeypot field - hidden from users */}
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

              {/* Cloudflare Turnstile - Invisible Mode */}
              {Turnstile && (
                <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
                  <Turnstile
                    ref={turnstileRef}
                    sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
                    onSuccess={handleCaptchaSuccess}
                    onError={handleCaptchaError}
                    onExpire={handleCaptchaExpire}
                    options={{
                      theme: 'dark',
                      size: 'invisible'
                    }}
                  />
                </div>
              )}
              {captchaError && (
                <p className="text-sm text-red-600 text-center">Please complete the security verification</p>
              )}

              <Button type="submit" className="w-full hover:scale-100 hover:shadow-sm" disabled={loading}>
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Registering...
                  </>
                ) : (
                  'Register'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-gray-400">Already have an account? </span>
              <Link to="/login" className="text-blue-400 hover:text-blue-300 underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <SiteFooter />
    </div>
  );
};

export default RegisterPage;

