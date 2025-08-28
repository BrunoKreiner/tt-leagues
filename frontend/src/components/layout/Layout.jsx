import { Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
  UserPlus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { notificationsAPI, leaguesAPI } from '@/services/api';
import MobileMenu from './MobileMenu';
import HamburgerButton from './HamburgerButton';
import { useTranslation } from 'react-i18next';

const Layout = () => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [acceptLoading, setAcceptLoading] = useState({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: t('nav.dashboard'), href: '/dashboard', icon: Home },
    { name: t('nav.leagues'), href: '/leagues', icon: Trophy },
    { name: t('nav.matches'), href: '/matches', icon: Swords },
  ];

  if (isAdmin) {
    navigation.push({ name: t('nav.admin'), href: '/admin', icon: Shield });
  }

  const handleLogout = async () => {
    await logout();
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex h-16 items-center px-4 md:px-6">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Trophy className="h-4 w-4" />
            </div>
            <span className="font-bold text-lg">{t('app.title')}</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-4 lg:space-x-6 mx-6">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || 
                             (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-2 text-sm font-medium transition-colors hover:text-primary ${
                    isActive 
                      ? 'text-primary border-b-2 border-primary pb-1' 
                      : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.name}</span>
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
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>{t('language.english')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage('de')}>{t('language.german')}</DropdownMenuItem>
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
              <DropdownMenuContent className="w-96" align="end" forceMount>
                <div className="px-2 py-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{t('notifications.title')}</span>
                  <Button variant="ghost" size="sm" onClick={markAllAsRead} disabled={notifLoading || unreadCount === 0}>
                    {t('actions.markAllRead')}
                  </Button>
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-96 overflow-auto">
                  {notifLoading ? (
                    <div className="p-4 text-sm text-muted-foreground">{t('common.loading')}</div>
                  ) : notifications.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">{t('notifications.none')}</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`px-3 py-2 border-b last:border-b-0 ${!n.is_read ? 'bg-muted/40' : ''}`}>
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className="mt-0.5 text-muted-foreground">
                            {n.type === 'league_invite' ? (
                              <UserPlus className="h-4 w-4" />
                            ) : (
                              <Bell className="h-4 w-4" />
                            )}
                          </div>
                          {/* Content */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</div>
                                <div className="text-xs text-muted-foreground">{n.message}</div>
                                {n.created_at && (
                                  <div className="text-[10px] text-muted-foreground mt-1">
                                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                  </div>
                                )}
                              </div>
                              {!n.is_read && (
                                <Button variant="ghost" size="sm" onClick={() => markAsRead(n.id)}>{t('actions.read')}</Button>
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
                                                             <Link to={`/leagues/${n.related_id}`} className="text-xs text-primary underline">
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
                  <Link to="/notifications" className="w-full inline-flex items-center justify-center text-sm underline text-primary">
                    {t('nav.notifications')}
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    {user?.avatar_url && (
                      <AvatarImage src={user.avatar_url} alt="Profile" />
                    )}
                    <AvatarFallback className="text-xs">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">
                      @{user?.username}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>{t('nav.profile')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>{t('nav.settings')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
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

