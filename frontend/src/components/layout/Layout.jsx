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
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Home, 
  Trophy, 
  Swords, 
  User, 
  Settings, 
  LogOut,
  Bell,
  Shield,
  UserPlus,
  BookOpen
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { notificationsAPI, leaguesAPI } from '@/services/api';
import MobileMenu from './MobileMenu';
import HamburgerButton from './HamburgerButton';
import { useTranslation } from 'react-i18next';
import SiteFooter from '@/components/layout/SiteFooter';

const Layout = () => {
  const { user, logout } = useAuth();
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
    { name: t('nav.admin'), href: '/app/admin', icon: Shield },
    {
      name: 'TTC Baden-Wettingen',
      label: (
        <span className="inline-flex items-start gap-1">
          <span>TTC Baden-Wettingen</span>
          <sup className="text-[10px] font-semibold text-blue-400 inline-block -skew-y-3">wiki</sup>
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

  const getUserInitials = (user) => {
    if (!user) return 'U';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U';
  };

  const fetchNotifications = async () => {
    try {
      setNotifLoading(true);
      const res = await notificationsAPI.getAll({ limit: 10 });
      setNotifications(res.data?.notifications || []);
      setUnreadCount(res.data?.unread_count || 0);
    } catch (e) {
      // soft fail
      console.error('Failed to load notifications', e);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    // initial fetch on layout mount
    fetchNotifications();
    // optional: poll every 60s
    const intervalId = setInterval(fetchNotifications, 60000);
    return () => clearInterval(intervalId);
  }, []);

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
    // No decline endpoint yet; soft-deny by marking notification as read
    await markAsRead(n.id);
         toast.success(t('notifications.inviteHandled'));
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-800/60 bg-gradient-to-r from-gray-900/95 via-gray-900/98 to-gray-900/95 backdrop-blur-xl">
        <div className="flex h-16 items-center px-4 md:px-6">
          {/* Logo */}
          <Link to="/app/dashboard" className="flex items-center space-x-2 group">
            <img src="/img/logo.png" alt="Logo" className="h-8 w-8 group-hover:scale-105 transition-transform" />
            <span className="cyberpunk-title text-lg bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{t('app.title')}</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-4 lg:space-x-6 mx-6">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || 
                             (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
              const label = item.label ?? item.name;
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`cyberpunk-text flex items-center space-x-2 text-sm font-medium transition-all duration-200 hover:text-blue-400 hover:scale-105 ${
                    isActive 
                      ? 'text-blue-400' 
                      : 'text-gray-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Spacer pushes right-side content (incl. hamburger on mobile) */}
          <div className="flex-1" />

          {/* Mobile Menu Button */}
          <HamburgerButton isOpen={mobileMenuOpen} onClick={toggleMobileMenu} />

          {/* Right side */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Language switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  {i18n.language === 'de' ? 'DE' : 'EN'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                <DropdownMenuItem onClick={() => i18n.changeLanguage('en')} className="text-gray-200 hover:bg-gray-700">{t('language.english')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage('de')} className="text-gray-200 hover:bg-gray-700">{t('language.german')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative" onClick={fetchNotifications}>
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-96 bg-gray-900 border-2 border-gray-700 shadow-xl" align="end" forceMount>
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-700">
                  <span className="text-sm font-semibold text-gray-200">{t('notifications.title')}</span>
                  <Button variant="ghost" size="sm" onClick={markAllAsRead} disabled={notifLoading || unreadCount === 0} className="h-7 px-2 text-xs">
                    {t('actions.markAllRead')}
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifLoading ? (
                    <div className="p-6 text-center text-sm text-gray-400">{t('common.loading')}</div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">{t('notifications.none')}</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`px-4 py-3 border-b border-gray-800 last:border-b-0 hover:bg-gray-800/50 transition-colors ${!n.is_read ? 'bg-gray-800/30' : ''}`}>
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={`mt-0.5 flex-shrink-0 ${n.type === 'league_invite' ? 'text-blue-400' : 'text-gray-400'}`}>
                            {n.type === 'league_invite' ? (
                              <UserPlus className="h-4 w-4" />
                            ) : (
                              <Bell className="h-4 w-4" />
                            )}
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm mb-1 ${!n.is_read ? 'font-semibold text-gray-100' : 'font-medium text-gray-300'}`}>{n.title}</div>
                                <div className="text-xs text-gray-400 mb-1.5 leading-relaxed">{n.message}</div>
                                {n.created_at && (
                                  <div className="text-[10px] text-gray-500">
                                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                  </div>
                                )}
                              </div>
                              {!n.is_read && (
                                <Button variant="ghost" size="sm" onClick={() => markAsRead(n.id)} className="h-7 px-2 text-xs flex-shrink-0">{t('actions.read')}</Button>
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
                                                             <div className="text-xs text-muted-foreground">{t('notifications.inviteHandled')}</div>
                            )}
                            {n.related_id && (
                                                             <Link to={`/app/leagues/${n.related_id}`} className="text-xs text-primary underline">
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
                  <Link to="/app/notifications" className="w-full inline-flex items-center justify-center text-sm underline text-primary">
                    {t('nav.notifications')}
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full cursor-pointer">
                  <Avatar className="h-8 w-8" key={user?.avatar_url}>
                    {user?.avatar_url && (
                      <AvatarImage src={user.avatar_url} alt="Profile" />
                    )}
                    <AvatarFallback className="text-xs bg-gray-700 text-gray-200">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-gray-800 border-gray-700" align="end" forceMount>
                <DropdownMenuItem asChild className="text-gray-200 hover:bg-gray-700 p-2 cursor-pointer">
                  <Link to="/app/profile" className="flex items-center justify-start gap-2 w-full">
                    <Avatar className="h-10 w-10" key={user?.avatar_url}>
                      {user?.avatar_url && (
                        <AvatarImage src={user.avatar_url} alt="Profile" />
                      )}
                      <AvatarFallback className="text-sm bg-gray-700 text-gray-200">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                      <p className="w-[200px] truncate text-sm text-gray-400">
                        @{user?.username}
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="text-gray-200 hover:bg-gray-700">
                  <Link to="/app/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>{t('nav.profile')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="text-gray-200 hover:bg-gray-700">
                  <Link to="/app/settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>{t('nav.settings')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-700" />
                <DropdownMenuItem onClick={handleLogout} className="text-red-400 hover:bg-gray-700">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('nav.logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6 md:px-6">
          <Outlet />
        </div>
      </main>

      <SiteFooter />

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
        navigation={navigation}
        user={user}
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

