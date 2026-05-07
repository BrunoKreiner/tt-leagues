import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  LogOut,
  Bell,
  UserPlus,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const MobileMenu = ({
  isOpen,
  onClose,
  navigation,
  user,
  isAuthenticated,
  notifications,
  unreadCount,
  notifLoading,
  acceptLoading,
  onMarkAsRead,
  onAcceptInvite,
  onDenyInvite,
  onLogout,
}) => {
  const { t } = useTranslation();
  const location = useLocation();

  const handleLogoutClick = async () => {
    await onLogout();
    onClose();
  };

  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const getUserInitials = (u) => {
    if (!u) return 'U';
    return (
      `${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase() ||
      u.username?.[0]?.toUpperCase() ||
      'U'
    );
  };

  const isActive = (href) =>
    location.pathname === href || (href !== '/' && location.pathname.startsWith(href));

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          background: 'oklch(0.10 0.005 50 / 0.6)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 bottom-0 z-50 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: 'min(82vw, 340px)',
          background: 'var(--bg-2)',
          borderLeft: '1px solid var(--line-soft)',
          boxShadow: '-20px 0 60px -10px oklch(0.10 0 0 / 0.5)',
          paddingBottom: isAuthenticated
            ? 'calc(80px + env(safe-area-inset-bottom, 0px))'
            : undefined,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        {/* Head */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--line-soft)' }}>
          <span className="eyebrow dotted">Menu</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 w-9 rounded-full p-0 border"
            style={{ background: 'var(--bg-3)', borderColor: 'var(--line)' }}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* User block */}
        {isAuthenticated ? (
          <Link
            to="/app/profile"
            onClick={onClose}
            className="block px-6 py-4 border-b hover:bg-[var(--bg-3)]/40 transition-colors"
            style={{ borderColor: 'var(--line-soft)' }}
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 border" style={{ borderColor: 'var(--line)' }}>
                {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="Avatar" />}
                <AvatarFallback className="text-sm bg-[var(--bg-3)] text-[var(--fg)]">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-[var(--fg-3)] font-mono truncate">@{user?.username}</p>
              </div>
            </div>
          </Link>
        ) : (
          <div className="px-6 py-4 border-b flex flex-col gap-2" style={{ borderColor: 'var(--line-soft)' }}>
            <Button
              asChild
              className="w-full bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-2)] font-bold rounded-full"
            >
              <Link to="/register" onClick={onClose}>
                {t('auth.getStarted')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link to="/login" onClick={onClose}>
                {t('auth.logIn')}
              </Link>
            </Button>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const label = item.label ?? item.name;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={`flex items-center gap-3.5 px-6 py-3.5 text-[15px] border-l-[3px] transition-colors min-h-[44px] ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--bg-3)]'
                    : 'border-transparent hover:bg-[var(--bg-3)]/50'
                }`}
              >
                <span
                  className="inline-flex items-center justify-center w-5"
                  style={{ color: active ? 'var(--accent)' : 'var(--fg-3)' }}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span>{label}</span>
              </Link>
            );
          })}

          {/* Notifications block (auth only) */}
          {isAuthenticated && (
            <div className="mt-2 pt-3 border-t" style={{ borderColor: 'var(--line-soft)' }}>
              <div className="flex items-center justify-between px-6 py-2">
                <span className="eyebrow flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5" />
                  {t('notifications.title')}
                </span>
                {unreadCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 bg-[var(--accent)] text-[var(--accent-ink)] rounded-full text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="px-3 pb-3 max-h-64 overflow-y-auto space-y-1.5">
                {notifLoading ? (
                  <div className="px-3 py-2 text-sm text-[var(--fg-3)]">{t('common.loading')}</div>
                ) : !notifications || notifications.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-[var(--fg-3)]">{t('notifications.none')}</div>
                ) : (
                  notifications.slice(0, 5).map((n) => (
                    <div
                      key={n.id}
                      className={`px-3 py-2 rounded-md ${!n.is_read ? 'bg-[var(--bg-3)]/60' : 'bg-[var(--bg-3)]/20'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-[var(--fg-3)]">
                          {n.type === 'league_invite' ? (
                            <UserPlus className="h-4 w-4" />
                          ) : (
                            <Bell className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'} truncate`}>
                            {n.title}
                          </div>
                          <div className="text-xs text-[var(--fg-3)] line-clamp-2">{n.message}</div>
                          {n.created_at && (
                            <div className="text-[10px] text-[var(--fg-4)] mt-1 font-mono">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </div>
                          )}
                        </div>
                        {!n.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onMarkAsRead(n.id)}
                            className="h-8 px-2 text-xs"
                          >
                            {t('actions.read')}
                          </Button>
                        )}
                      </div>
                      {n.type === 'league_invite' && !n.is_read && (
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => onAcceptInvite(n)}
                            disabled={!!acceptLoading[n.id]}
                            className="flex-1 text-xs"
                          >
                            {acceptLoading[n.id] ? t('status.joining') : t('actions.accept')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDenyInvite(n)}
                            className="flex-1 text-xs"
                          >
                            {t('actions.reject')}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {notifications && notifications.length > 0 && (
                  <Link
                    to="/app/notifications"
                    onClick={onClose}
                    className="block text-center text-xs text-[var(--accent)] underline pt-2"
                  >
                    {t('nav.notifications')}
                  </Link>
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Foot */}
        {isAuthenticated && (
          <div className="px-6 py-4 border-t flex flex-col gap-2" style={{ borderColor: 'var(--line-soft)' }}>
            <Link
              to="/app/profile"
              onClick={onClose}
              className="flex items-center gap-3 text-sm text-[var(--fg-2)] hover:text-[var(--fg)]"
            >
              <User className="h-4 w-4" /> {t('nav.profile')}
            </Link>
            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-3 text-sm text-[var(--bad)] hover:opacity-80"
            >
              <LogOut className="h-4 w-4" /> {t('nav.logout')}
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default MobileMenu;
