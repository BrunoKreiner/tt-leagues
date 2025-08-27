import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const MobileMenu = ({ 
  isOpen, 
  onClose, 
  navigation, 
  user, 
  notifications, 
  unreadCount, 
  notifLoading, 
  acceptLoading,
  onMarkAsRead,
  onAcceptInvite,
  onDenyInvite,
  onLogout 
}) => {
  const location = useLocation();

  // Close menu on route change
  useEffect(() => {
    onClose();
    // Intentionally only depend on pathname to avoid closing immediately on open
  }, [location.pathname]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const getUserInitials = (user) => {
    if (!user) return 'U';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U';
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Menu Panel */}
      <div 
        className={`fixed right-0 top-0 h-full w-80 bg-card border-l border-border z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Trophy className="h-4 w-4" />
            </div>
            <span className="font-bold text-lg">Menu</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* User Profile Section */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-sm">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                @{user?.username}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto">
          <div className="p-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || 
                             (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-foreground hover:bg-muted'
                  }`}
                  onClick={onClose}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Divider */}
          <div className="px-4 py-2">
            <div className="h-px bg-border" />
          </div>

          {/* Quick Actions */}
          <div className="p-2">
            <Link
              to="/profile"
              className="flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
              onClick={onClose}
            >
              <User className="h-5 w-5" />
              <span>Profile</span>
            </Link>
            <Link
              to="/settings"
              className="flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
              onClick={onClose}
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </Link>
          </div>

          {/* Notifications Section */}
          <div className="px-4 py-2">
            <div className="h-px bg-border" />
          </div>
          
          <div className="p-2">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center space-x-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Notifications</span>
              </div>
              {unreadCount > 0 && (
                <span className="min-w-[1.25rem] h-5 px-1.5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            
            {/* Notifications List */}
            <div className="max-h-64 overflow-y-auto">
              {notifLoading ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
              ) : notifications.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No notifications</div>
              ) : (
                notifications.slice(0, 5).map((n) => (
                  <div key={n.id} className={`px-3 py-2 rounded-lg ${!n.is_read ? 'bg-muted/40' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-muted-foreground">
                        {n.type === 'league_invite' ? (
                          <UserPlus className="h-4 w-4" />
                        ) : (
                          <Bell className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'} truncate`}>
                              {n.title}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {n.message}
                            </div>
                            {n.created_at && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                              </div>
                            )}
                          </div>
                          {!n.is_read && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => onMarkAsRead(n.id)}
                              className="h-6 px-2 text-xs"
                            >
                              Read
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    {n.type === 'league_invite' && (
                      <div className="mt-2 space-y-2">
                        {!n.is_read ? (
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => onAcceptInvite(n)} 
                              disabled={!!acceptLoading[n.id]}
                              className="flex-1 h-8 text-xs"
                            >
                              {acceptLoading[n.id] ? 'Joining…' : 'Accept'}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => onDenyInvite(n)}
                              className="flex-1 h-8 text-xs"
                            >
                              Deny
                            </Button>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Invite handled</div>
                        )}
                        {n.related_id && (
                          <Link 
                            to={`/leagues/${n.related_id}`} 
                            className="text-xs text-primary underline"
                            onClick={onClose}
                          >
                            View league
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            {notifications.length > 0 && (
              <div className="mt-2">
                <Link 
                  to="/notifications" 
                  className="w-full inline-flex items-center justify-center text-sm underline text-primary py-2"
                  onClick={onClose}
                >
                  View all notifications
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button 
            variant="ghost" 
            onClick={onLogout} 
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="mr-3 h-4 w-4" />
            <span>Log out</span>
          </Button>
        </div>
      </div>
    </>
  );
};

export default MobileMenu;