import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Trophy, 
  Star, 
  Flame, 
  Zap, 
  Target, 
  Award, 
  Medal, 
  Crown,
  Calendar,
  Users,
  TrendingUp,
  Heart
} from 'lucide-react';
import { format } from 'date-fns';

// Icon mapping for different badge types
const badgeIcons = {
  trophy: Trophy,
  star: Star,
  fire: Flame,
  comeback: Zap,
  target: Target,
  award: Award,
  medal: Medal,
  crown: Crown,
  calendar: Calendar,
  users: Users,
  trending: TrendingUp,
  heart: Heart,
  // Add more icon mappings as needed
};

const BadgeDisplay = ({ 
  badge, 
  showDate = true, 
  showLeague = true, 
  size = 'default',
  className = '' 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Get the icon component based on the badge icon name
  const IconComponent = badgeIcons[badge.icon] || Trophy;
  
  // Determine badge variant based on type
  const getBadgeVariant = () => {
    switch (badge.badge_type) {
      case 'league_winner':
        return 'default'; // Gold-like
      case 'tournament_winner':
        return 'secondary'; // Silver-like
      case 'achievement':
        return 'outline'; // Bronze-like
      default:
        return 'outline';
    }
  };
  
  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-1';
      case 'lg':
        return 'text-base px-4 py-2';
      default:
        return 'text-sm px-3 py-1';
    }
  };
  
  // Get icon size
  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 12;
      case 'lg':
        return 20;
      default:
        return 16;
    }
  };
  
  const tooltipContent = (
    <div className="space-y-2">
      <div className="font-semibold">{badge.name}</div>
      <div className="text-sm text-muted-foreground">{badge.description}</div>
      {showDate && badge.earned_at && (
        <div className="text-xs text-muted-foreground">
          Earned: {format(new Date(badge.earned_at), 'MMM d, yyyy')}
        </div>
      )}
      {showLeague && badge.league_name && (
        <div className="text-xs text-muted-foreground">
          League: {badge.league_name}
        </div>
      )}
    </div>
  );
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center gap-2 cursor-help transition-all duration-200 hover:scale-105 ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <Badge 
              variant={getBadgeVariant()} 
              className={`${getSizeClasses()} flex items-center gap-1.5`}
            >
              <IconComponent 
                size={getIconSize()} 
                className={`transition-transform duration-200 ${
                  isHovered ? 'scale-110' : 'scale-100'
                }`}
              />
              <span>{badge.name}</span>
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Badge Grid component for displaying multiple badges
export const BadgeGrid = ({ 
  badges, 
  showDate = true, 
  showLeague = true, 
  size = 'default',
  className = '',
  emptyMessage = 'No badges earned yet'
}) => {
  if (!badges || badges.length === 0) {
    return (
      <div className={`text-center text-muted-foreground py-8 ${className}`}>
        <Trophy className="mx-auto h-12 w-12 mb-2 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }
  
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${className}`}>
      {badges.map((badge) => (
        <BadgeDisplay
          key={`${badge.id}-${badge.earned_at}`}
          badge={badge}
          showDate={showDate}
          showLeague={showLeague}
          size={size}
        />
      ))}
    </div>
  );
};

// Badge List component for compact display
export const BadgeList = ({ 
  badges, 
  showDate = false, 
  showLeague = false, 
  size = 'sm',
  className = '',
  emptyMessage = 'No badges'
}) => {
  if (!badges || badges.length === 0) {
    return (
      <div className={`text-center text-muted-foreground py-4 ${className}`}>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }
  
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {badges.map((badge) => (
        <BadgeDisplay
          key={`${badge.id}-${badge.earned_at}`}
          badge={badge}
          showDate={showDate}
          showLeague={showLeague}
          size={size}
        />
      ))}
    </div>
  );
};

export default BadgeDisplay;
