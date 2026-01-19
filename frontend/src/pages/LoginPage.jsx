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

const LoginPage = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    website: '', // Honeypot field
  });
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaError, setCaptchaError] = useState(false);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileRef = useRef(null);
  const { login, loading, error } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check honeypot field
    if (formData.website) {
      // Bot detected - silently fail
      return;
    }
    
    // Check CAPTCHA - REQUIRED
    if (!captchaToken) {
      if (turnstileRef.current) {
        try {
          // Try to execute if not already executed
          turnstileRef.current.execute();
          // Wait a bit longer for the token callback
          await new Promise(resolve => setTimeout(resolve, 1500));
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

    const loginData = { ...formData };
    delete loginData.website; // Remove honeypot field
    loginData.captchaToken = captchaToken;
    
    await login(loginData);
  };

  const handleCaptchaSuccess = (token) => {
    console.log('Turnstile success, token received');
    setCaptchaToken(token);
    setCaptchaError(false);
    setTurnstileReady(true);
  };

  const handleCaptchaError = (error) => {
    console.error('Turnstile error:', error);
    setCaptchaError(true);
    setCaptchaToken(null);
    setTurnstileReady(false);
    // Try to reset and execute again
    if (turnstileRef.current) {
      setTimeout(() => {
        try {
          turnstileRef.current.reset();
          turnstileRef.current.execute();
        } catch (e) {
          console.error('Failed to reset Turnstile:', e);
        }
      }, 1000);
    }
  };

  const handleCaptchaExpire = () => {
    setCaptchaToken(null);
    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  };

  // In invisible mode, Turnstile executes automatically on mount
  // No need to manually execute - it will call onSuccess when ready

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
            <Button size="sm" asChild className="bg-blue-600 hover:bg-blue-500 hover:scale-100">
              <Link to="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md vg-card no-hover">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-blue-300">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-300">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  placeholder="Enter your username"
                />
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
              {captchaError && (
                <p className="text-sm text-red-600 text-center">Please complete the security verification</p>
              )}

              <Button type="submit" className="w-full hover:scale-100 hover:shadow-sm" disabled={loading}>
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-gray-400">Don't have an account? </span>
              <Link to="/register" className="text-blue-400 hover:underline">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <SiteFooter />
    </div>
  );
};

export default LoginPage;

