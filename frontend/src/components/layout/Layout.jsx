import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Home,
  Trophy,
  Swords,
  Zap,
  User,
  Settings,
  LogOut,
  Bell,
  Shield,
  UserPlus,
  BookOpen,
  Plus,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { notificationsAPI, leaguesAPI } from '@/services/api';
import MobileMenu from './MobileMenu';
import HamburgerButton from './HamburgerButton';
import { useTranslation } from 'react-i18next';
import SiteFooter from '@/components/layout/SiteFooter';
import Brand from '@/components/layout/Brand';

const Layout = () => {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [acceptLoading, setAcceptLoading] = useState({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: t('nav.dashboard'), href: '/app/dashboard', icon: Home },
    { name: t('nav.leagues'), href: '/app/leagues', icon: Trophy },
    { name: t('nav.matches'), href: '/app/matches', icon: Swords },
    { name: t('nav.quickMatch'), href: '/app/quick-match', icon: Zap },
    ...(isAdmin ? [{ name: t('nav.admin'), href: '/app/admin', icon: Shield }] : []),
    {
      name: 'TTC Baden-Wettingen',
      label: (
        <span className="inline-flex items-start gap-1">
          <span>TTC Baden-Wettingen</span>
          <sup className="text-[10px] font-semibold text-[var(--accent)] inline-block -skew-y-3">wiki</sup>
        </span>
      ),
      href: '/wiki/ttc-baden-wettingen',
      icon: BookOpen,
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((open) => !open);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const getUserInitials = (u) => {
    if (!u) return 'U';
    return (
      `${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase() ||
      u.username?.[0]?.toUpperCase() ||
      'U'
    );
  };

  const fetchNotifications = async () => {
    try {
      setNotifLoading(true);
      const res = await notificationsAPI.getAll({ limit: 10 });
      setNotifications(res.data?.notifications || []);
      setUnreadCount(res.data?.unread_count || 0);
    } catch (e) {
      console.error('Failed to load notifications', e);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 60000);
    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  // Reserve room for the mobile bottom tab bar when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      document.body.classList.add('has-tabbar');
    } else {
      document.body.classList.remove('has-tabbar');
    }
    return () => document.body.classList.remove('has-tabbar');
  }, [isAuthenticated]);

  const markAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      await fetchNotifications();
    } catch (e) {
      console.error('markAsRead failed', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      await fetchNotifications();
    } catch (e) {
      console.error('markAllAsRead failed', e);
    }
  };

  const handleAcceptInvite = async (n) => {
    const leagueId = n.related_id;
    if (!leagueId) {
      toast.error(t('notifications.missingLeague'));
      return;
    }
    try {
      setAcceptLoading((s) => ({ ...s, [n.id]: true }));
      const res = await leaguesAPI.join(leagueId);
      toast.success(res.data?.message || t('notifications.joinedLeague'));
      await markAsRead(n.id);
    } catch (err) {
      const msg = err.response?.data?.error || t('notifications.acceptError');
      toast.error(msg);
    } finally {
      setAcceptLoading((s) => ({ ...s, [n.id]: false }));
    }
  };

  const handleDenyInvite = async (n) => {
    await markAsRead(n.id);
    toast.success(t('notifications.inviteHandled'));
  };

  const isActive = (href) =>
    location.pathname === href || (href !== '/' && location.pathname.startsWith(href));

  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{
          background: 'oklch(0.17 0.008 60 / 0.78)',
          borderColor: 'var(--line-soft)',
        }}
      >
        <div className="tt-container">
          <div className="flex items-center gap-7 h-16">
            <Brand to={isAuthenticated ? '/app/dashboard' : '/'} />

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6 text-[14px] text-[var(--fg-2)]">
              {navigation.map((item) => {
                const active = isActive(item.href);
                const label = item.label ?? item.name;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`relative py-1.5 transition-colors hover:text-[var(--fg)] ${
                      active ? 'text-[var(--fg)]' : ''
                    }`}
                  >
                    {label}
                    {active && (
                      <span
                        className="absolute left-0 right-0 -bottom-[21px] h-px bg-[var(--accent)] origin-left"
                        style={{ animation: 'tt-underline-grow .4s cubic-bezier(.34,1.56,.64,1) .1s both' }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <HamburgerButton isOpen={mobileMenuOpen} onClick={toggleMobileMenu} />

              <div className="hidden md:flex items-center gap-2">
                {/* Language switcher */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="font-mono text-[11px] tracking-wider uppercase">
                      {i18n.language === 'de' ? 'DE' : 'EN'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>
                      {t('language.english')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => i18n.changeLanguage('de')}>
                      {t('language.german')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {isAuthenticated ? (
                  <>
                    <Button
                      asChild
                      size="sm"
                      className="bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-2)] font-bold rounded-full"
                    >
                      <Link to="/app/quick-match" className="inline-flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> {t('cta.recordMatch')}
                      </Link>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="relative h-9 w-9 p-0"
                          onClick={fetchNotifications}
                          aria-label={t('notifications.title')}
                        >
                          <Bell className="h-4 w-4" />
                          {unreadCount > 0 && (
                            <span
                              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[var(--accent)] text-[var(--accent-ink)] rounded-full text-[10px] font-bold flex items-center justify-center"
                            >
                              {unreadCount}
                            </span>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-96"
                        align="end"
                        forceMount
                      >
                        <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--line-soft)]">
                          <span className="eyebrow dotted">{t('notifications.title')}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={markAllAsRead}
                            disabled={notifLoading || unreadCount === 0}
                            className="h-7 px-2 text-xs"
                          >
                            {t('actions.markAllRead')}
                          </Button>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {notifLoading ? (
                            <div className="p-6 text-center text-sm text-[var(--fg-3)]">{t('common.loading')}</div>
                          ) : notifications.length === 0 ? (
                            <div className="p-6 text-center text-sm text-[var(--fg-3)]">{t('notifications.none')}</div>
                          ) : (
                            notifications.map((n) => (
                              <div
                                key={n.id}
                                className={`px-4 py-3 border-b border-[var(--line-soft)] last:border-b-0 hover:bg-[var(--bg-3)]/40 transition-colors ${
                                  !n.is_read ? 'bg-[var(--bg-3)]/20' : ''
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`mt-0.5 flex-shrink-0 ${
                                      n.type === 'league_invite' ? 'text-[var(--accent)]' : 'text-[var(--fg-3)]'
                                    }`}
                                  >
                                    {n.type === 'league_invite' ? (
                                      <UserPlus className="h-4 w-4" />
                                    ) : (
                                      <Bell className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className={`text-sm mb-1 ${!n.is_read ? 'font-semibold' : 'font-medium text-[var(--fg-2)]'}`}>
                                          {n.title}
                                        </div>
                                        <div className="text-xs text-[var(--fg-3)] mb-1.5 leading-relaxed">{n.message}</div>
                                        {n.created_at && (
                                          <div className="text-[10px] text-[var(--fg-4)] font-mono">
                                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                          </div>
                                        )}
                                      </div>
                                      {!n.is_read && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => markAsRead(n.id)}
                                          className="h-7 px-2 text-xs flex-shrink-0"
                                        >
                                          {t('actions.read')}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {n.type === 'league_invite' && (
                                  <div className="mt-2 space-y-2">
                                    {!n.is_read ? (
                                      <div className="flex items-center gap-2">
                                        <Button size="sm" onClick={() => handleAcceptInvite(n)} disabled={!!acceptLoading[n.id]}>
                                          {acceptLoading[n.id] ? t('status.joining') : t('actions.accept')}
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => handleDenyInvite(n)}>
                                          {t('actions.reject')}
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="text-xs text-[var(--fg-3)]">{t('notifications.inviteHandled')}</div>
                                    )}
                                    {n.related_id && (
                                      <Link
                                        to={`/app/leagues/${n.related_id}`}
                                        className="text-xs text-[var(--accent)] underline"
                                      >
                                        {t('matchDetail.viewLeague')}
                                      </Link>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                        <DropdownMenuSeparator />
                        <div className="p-2">
                          <Link
                            to="/app/notifications"
                            className="w-full inline-flex items-center justify-center text-sm underline text-[var(--accent)]"
                          >
                            {t('nav.notifications')}
                          </Link>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 cursor-pointer">
                          <Avatar className="h-8 w-8 border border-[var(--line)]" key={user?.avatar_url}>
                            {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="Profile" />}
                            <AvatarFallback className="text-xs bg-[var(--bg-3)] text-[var(--fg)]">
                              {getUserInitials(user)}
                            </AvatarFallback>
                          </Avatar>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuItem asChild className="p-2 cursor-pointer">
                          <Link to="/app/profile" className="flex items-center justify-start gap-2 w-full">
                            <Avatar className="h-10 w-10" key={user?.avatar_url}>
                              {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="Profile" />}
                              <AvatarFallback className="text-sm bg-[var(--bg-3)] text-[var(--fg)]">
                                {getUserInitials(user)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col leading-tight">
                              <p className="font-medium text-sm">
                                {user?.first_name} {user?.last_name}
                              </p>
                              <p className="text-xs text-[var(--fg-3)] font-mono truncate w-[160px]">@{user?.username}</p>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link to="/app/profile" className="flex items-center">
                            <User className="mr-2 h-4 w-4" />
                            <span>{t('nav.profile')}</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/app/settings" className="flex items-center">
                            <Settings className="mr-2 h-4 w-4" />
                            <span>{t('nav.settings')}</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="text-[var(--bad)]">
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>{t('nav.logout')}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/login">{t('auth.logIn')}</Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      className="bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-2)] font-bold rounded-full"
                    >
                      <Link to="/register">{t('auth.getStarted')}</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <SiteFooter />

      {/* Mobile bottom tab bar (signed-in only) */}
      {isAuthenticated && (
        <nav className="tt-tabbar" aria-label="Bottom navigation">
          <Link to="/app/dashboard" className={isActive('/app/dashboard') ? 'active' : ''}>
            <Home className="ic" /> <span>{t('nav.dashboard')}</span>
          </Link>
          <Link to="/app/leagues" className={isActive('/app/leagues') ? 'active' : ''}>
            <Trophy className="ic" /> <span>{t('nav.leagues')}</span>
          </Link>
          <Link to="/app/quick-match" className="fab" aria-label={t('cta.recordMatch')}>
            <Plus className="ic" strokeWidth={3} />
          </Link>
          <Link to="/app/matches" className={isActive('/app/matches') ? 'active' : ''}>
            <Swords className="ic" /> <span>{t('nav.matches')}</span>
          </Link>
          <Link to="/app/profile" className={isActive('/app/profile') ? 'active' : ''}>
            <User className="ic" /> <span>{t('nav.profile')}</span>
          </Link>
        </nav>
      )}

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
        navigation={navigation}
        user={user}
        isAuthenticated={isAuthenticated}
        notifications={notifications}
        unreadCount={unreadCount}
        notifLoading={notifLoading}
        acceptLoading={acceptLoading}
        onFetchNotifications={fetchNotifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onAcceptInvite={handleAcceptInvite}
        onDenyInvite={handleDenyInvite}
        onLogout={handleLogout}
      />
    </div>
  );
};

export default Layout;
