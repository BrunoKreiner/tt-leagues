import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Trophy, TrendingUp, Calendar, Users, Swords, ExternalLink, Award } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usersAPI, leaguesAPI } from '@/services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BadgeGrid } from '@/components/BadgeDisplay';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const ProfilePage = () => {
  const { t } = useTranslation();
  const { username } = useParams(); // Get username from URL if provided
  const { user: currentUser, isAuthenticated, refreshUser } = useAuth();
  
  // Determine if this is current user's profile or public profile
  const isOwnProfile = !username || username === currentUser?.username;
  const targetUser = isOwnProfile ? currentUser : null; // Will be fetched for public profiles
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [userLeagues, setUserLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [eloHistory, setEloHistory] = useState([]);
  const [eloLoading, setEloLoading] = useState(false);
  const [eloError, setEloError] = useState(null);
  const [timeWindow, setTimeWindow] = useState('all'); // 30, 90, all
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileFields, setProfileFields] = useState({
    forehand_rubber: '',
    backhand_rubber: '',
    blade_wood: '',
    playstyle: '',
    strengths: '',
    weaknesses: '',
    goals: ''
  });

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setLoading(true);
        
        if (isOwnProfile) {
          // Fetch current user's data (existing logic)
          const [statsRes, leaguesRes] = await Promise.all([
            usersAPI.getStats(currentUser.id),
            leaguesAPI.getAll({ limit: 100 })
          ]);

          setStats(statsRes.data);
          setAvatarUrl(currentUser?.avatar_url || '');
          setProfileFields({
            forehand_rubber: statsRes.data?.user?.forehand_rubber || '',
            backhand_rubber: statsRes.data?.user?.backhand_rubber || '',
            blade_wood: statsRes.data?.user?.blade_wood || '',
            playstyle: statsRes.data?.user?.playstyle || '',
            strengths: statsRes.data?.user?.strengths || '',
            weaknesses: statsRes.data?.user?.weaknesses || '',
            goals: statsRes.data?.user?.goals || ''
          });
          // Filter to user's leagues only
          const userLeaguesData = leaguesRes.data.leagues?.filter(league => league.is_member) || [];
          setUserLeagues(userLeaguesData);
          
          // Set first league as default if available
          if (userLeaguesData.length > 0 && !selectedLeague) {
            setSelectedLeague(userLeaguesData[0].id);
          }
        } else {
          // Fetch public profile data
          const publicProfileRes = await usersAPI.getPublicProfile(username);
          // Transform league_rankings to by_league format for consistency
          const transformedData = {
            ...publicProfileRes.data,
            by_league: (publicProfileRes.data.league_rankings || []).map(league => ({
              id: league.league_id,
              name: league.league_name,
              current_elo: league.current_elo,
              matches_played: league.matches_played,
              matches_won: league.matches_won,
              win_rate: league.win_rate,
              is_league_admin: league.is_league_admin
            }))
          };
          setStats(transformedData);
          setAvatarUrl(publicProfileRes.data?.user?.avatar_url || '');
          setUserLeagues(publicProfileRes.data.league_rankings || []);
          setProfileFields({
            forehand_rubber: publicProfileRes.data?.profile?.forehand_rubber || '',
            backhand_rubber: publicProfileRes.data?.profile?.backhand_rubber || '',
            blade_wood: publicProfileRes.data?.profile?.blade_wood || '',
            playstyle: publicProfileRes.data?.profile?.playstyle || '',
            strengths: publicProfileRes.data?.profile?.strengths || '',
            weaknesses: publicProfileRes.data?.profile?.weaknesses || '',
            goals: publicProfileRes.data?.profile?.goals || ''
          });
        }
      } catch (error) {
        console.error('Failed to fetch profile data:', error);
        toast.error('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [currentUser?.id, username, isOwnProfile]);

  const fetchEloHistory = useCallback(async () => {
    if (!selectedLeague || !isOwnProfile || !currentUser?.id) return;
    try {
      setEloLoading(true);
      setEloError(null);
      const res = await usersAPI.getEloHistory(currentUser.id, {
        league_id: selectedLeague,
        page: 1,
        limit: 100, // Get more data for charting
      });
      setEloHistory(res.data.items || []);
    } catch (error) {
      console.error('Failed to fetch ELO history:', error);
      setEloError(error);
      toast.error('Failed to load ELO history');
    } finally {
      setEloLoading(false);
    }
  }, [currentUser?.id, isOwnProfile, selectedLeague]);

  useEffect(() => {
    if (!selectedLeague || !isOwnProfile) return; // Only fetch ELO history for own profile

    fetchEloHistory();
  }, [fetchEloHistory, isOwnProfile, selectedLeague]);

  const filteredEloHistory = eloHistory.filter(item => {
    if (timeWindow === 'all') return true;
    
    // Skip items without recorded_at
    if (!item.recorded_at) {
      console.warn('Item missing recorded_at:', item);
      return false;
    }
    
    const itemDate = new Date(item.recorded_at);
    
    // Check if date is valid
    if (isNaN(itemDate.getTime())) {
      console.error('Invalid date for item:', item);
      return false;
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeWindow));
    return itemDate >= cutoffDate;
  });

  const renderEloChart = () => {
    if (eloLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      );
    }

    if (eloError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <div className="text-red-500 mb-2">Failed to load ELO history</div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchEloHistory()}
          >
            Retry
          </Button>
        </div>
      );
    }

    if (filteredEloHistory.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {eloHistory.length === 0 ? 
            'No ELO history available for this league.' : 
            'No ELO history available for the selected time period.'
          }
        </div>
      );
    }

    // Simple SVG chart
    const data = filteredEloHistory.reverse(); // Oldest to newest
    
    // Handle empty data
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No ELO history available for the selected time period.
        </div>
      );
    }
    
    const eloValues = data.map(item => item.elo_after).filter(val => val !== null && val !== undefined);
    
    console.log('Chart data:', { 
      dataLength: data.length, 
      eloValuesLength: eloValues.length, 
      eloValues: eloValues,
      data: data 
    });
    
    if (eloValues.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No valid ELO data available.
        </div>
      );
    }
    
    const minElo = Math.min(...eloValues);
    const maxElo = Math.max(...eloValues);
    const range = Math.max(maxElo - minElo, 1); // Ensure range is at least 1 to prevent division by zero
    
    const width = 800;
    const height = 300;
    const padding = 40;

    const points = eloValues.map((elo, index) => {
      // Handle single data point case
      const xRatio = eloValues.length === 1 ? 0.5 : index / (eloValues.length - 1);
      const x = padding + xRatio * (width - 2 * padding);
      const y = height - padding - ((elo - minElo) / range) * (height - 2 * padding);
      
      // Validate coordinates to prevent NaN
      if (isNaN(x) || isNaN(y)) {
        console.warn('Invalid chart coordinates:', { elo, index, x, y, minElo, range });
        return `${padding},${height - padding}`; // Default to bottom-left
      }
      
      return `${x},${y}`;
    });

    const path = `M ${points.join(' L ')}`;

    return (
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="border rounded-lg bg-background">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = height - padding - ratio * (height - 2 * padding);
            const eloValue = minElo + ratio * range;
            return (
              <g key={i}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <text
                  x={padding - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="#6b7280"
                >
                  {Math.round(eloValue)}
                </text>
              </g>
            );
          })}
          
          {/* ELO line */}
          <path
            d={path}
            stroke="#3b82f6"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Data points */}
          {points.map((point, index) => {
            const [x, y] = point.split(',').map(Number);
            const item = data[index];
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="3"
                fill="#3b82f6"
                className="cursor-pointer hover:r-4 transition-all"
                title={`${item.opponent_username}: ${item.elo_before} → ${item.elo_after} (${item.result})`}
              />
            );
          })}
        </svg>
      </div>
    );
  };

  const handleProfileSave = async () => {
    try {
      setSavingProfile(true);
      const payload = { ...profileFields };
      const currentAvatar = currentUser?.avatar_url || '';
      if ((avatarUrl || '') !== currentAvatar) {
        payload.avatar_url = avatarUrl || null;
      }
      await usersAPI.update(currentUser.id, payload);
      toast.success(t('profile.saved'));
      // Refresh auth user so top-right avatar updates immediately
      try {
        await refreshUser();
      } catch {
        // ignore refresh errors
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || t('profile.saveError'));
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isOwnProfile ? t('nav.profile') : t('profile.titleOf', { name: targetUser?.first_name || username })}
          </h1>
          <p className="text-muted-foreground">
            {isOwnProfile 
              ? t('profile.subtitleOwn')
              : t('profile.subtitlePublic')
            }
          </p>
        </div>
        {!isOwnProfile && isAuthenticated && (
          <Link 
            to="/profile" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            {t('profile.myProfile')}
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Profile Info */}
        <Card className="md:col-span-1">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              {t('profile.info')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center gap-3">
              <Avatar className="h-16 w-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
                <AvatarFallback className="bg-gray-700 text-gray-200">{(isOwnProfile ? currentUser.username : username)?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground">Avatar</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full mt-1 border border-gray-600 rounded px-2 py-1 bg-gray-800 text-gray-200 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => setAvatarUrl(e.target.result);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="text-lg">
                {isOwnProfile 
                  ? `${currentUser.first_name} ${currentUser.last_name}`
                  : `${targetUser?.first_name || ''} ${targetUser?.last_name || ''}`
                }
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Username</label>
              <p className="text-lg">
                @{isOwnProfile ? currentUser.username : username}
              </p>
            </div>
            {isOwnProfile && currentUser.email && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-lg">{currentUser.email}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Member Since</label>
              <p className="text-lg">
                {(isOwnProfile ? currentUser.created_at : targetUser?.created_at) 
                  ? format(new Date(isOwnProfile ? currentUser.created_at : targetUser.created_at), 'PPP') 
                  : 'N/A'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Overall Stats */}
        <Card className="md:col-span-2">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center">
              <Trophy className="h-5 w-5 mr-2" />
              {t('profile.overallStats')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm bg-muted/40">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{t('stats.leagues', { count: stats?.overall?.leagues_count || 0 })}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm bg-muted/40">
                <Swords className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{t('stats.matches', { count: stats?.overall?.matches_played || 0 })}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm bg-muted/40">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{t('profile.winRate', { rate: stats?.overall?.win_rate || 0 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ELO History Chart - Only for own profile */}
      {isOwnProfile && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              {t('profile.eloHistory')}
            </CardTitle>
            <CardDescription>
              {t('profile.eloHistoryDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">{t('recordMatch.leagueLabel')}:</label>
                  {userLeagues.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{t('profile.noLeaguesYet')}</div>
                  ) : (
                    <Select value={selectedLeague} onValueChange={setSelectedLeague}>
                      <SelectTrigger className="w-48 h-8">
                        <SelectValue placeholder={t('recordMatch.selectLeague')} />
                      </SelectTrigger>
                      <SelectContent>
                        {userLeagues.map(league => (
                          <SelectItem key={league.id} value={league.id}>
                            {league.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">{t('profile.timeWindow')}:</label>
                  <Select value={timeWindow} onValueChange={setTimeWindow}>
                    <SelectTrigger className="w-24 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 {t('profile.days')}</SelectItem>
                      <SelectItem value="90">90 {t('profile.days')}</SelectItem>
                      <SelectItem value="all">{t('profile.allTime')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {renderEloChart()}
            </div>
          </CardContent>
        </Card>
      )}

             {/* League-specific Stats */}
       {stats?.by_league && stats.by_league.length > 0 && (
         <Card>
           <CardHeader className="py-3">
             <CardTitle className="flex items-center">
               <Users className="h-5 w-5 mr-2" />
               {t('profile.leaguePerformance')}
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
               {stats.by_league.map(league => (
                 <Card key={league.id || league.league_id} className="p-3">
                   <div className="space-y-1.5">
                     <div className="flex items-center justify-between gap-2">
                       <h3 className="font-semibold">{league.name || league.league_name}</h3>
                       {(league.is_league_admin || league.is_admin) && (
                         <Badge variant="default" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                           Admin
                         </Badge>
                       )}
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-sm text-muted-foreground">ELO</span>
                       <Badge variant="secondary">{league.current_elo}</Badge>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-sm text-muted-foreground">{t('nav.matches')}</span>
                       <span>{league.matches_played}</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-sm text-muted-foreground">{t('profile.winRateLabel')}</span>
                       <span>{league.win_rate}%</span>
                     </div>
                   </div>
                 </Card>
               ))}
             </div>
           </CardContent>
         </Card>
       )}

       {/* Badges Section */}
       <Card>
         <CardHeader className="py-3">
           <CardTitle className="flex items-center">
             <Award className="h-5 w-5 mr-2" />
             {t('profile.badgesTitle')}
           </CardTitle>
           <CardDescription>
             {isOwnProfile ? t('profile.badgesSubtitleOwn') : t('profile.badgesSubtitlePublic')}
           </CardDescription>
         </CardHeader>
         <CardContent className="pt-0">
           <BadgeGrid 
             badges={stats?.badges || []}
             showDate={true}
             showLeague={true}
             size="default"
             emptyMessage={isOwnProfile ? t('profile.noBadgesOwn') : t('profile.noBadgesPublic')}
           />
         </CardContent>
       </Card>

      {/* Equipment & Playstyle */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center">
            <Award className="h-5 w-5 mr-2" />
            {t('profile.equipmentPlaystyle')}
          </CardTitle>
          <CardDescription>
            {t('profile.equipmentPlaystyleDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {isOwnProfile ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('profile.forehandRubber')}</label>
                <Input value={profileFields.forehand_rubber} onChange={(e) => setProfileFields((s) => ({ ...s, forehand_rubber: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('profile.backhandRubber')}</label>
                <Input value={profileFields.backhand_rubber} onChange={(e) => setProfileFields((s) => ({ ...s, backhand_rubber: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('profile.bladeWood')}</label>
                <Input value={profileFields.blade_wood} onChange={(e) => setProfileFields((s) => ({ ...s, blade_wood: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('profile.playstyle')}</label>
                <Input value={profileFields.playstyle} onChange={(e) => setProfileFields((s) => ({ ...s, playstyle: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">{t('profile.strengths')}</label>
                <Textarea rows={3} value={profileFields.strengths} onChange={(e) => setProfileFields((s) => ({ ...s, strengths: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">{t('profile.weaknesses')}</label>
                <Textarea rows={3} value={profileFields.weaknesses} onChange={(e) => setProfileFields((s) => ({ ...s, weaknesses: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">{t('profile.goals')}</label>
                <Textarea rows={3} value={profileFields.goals} onChange={(e) => setProfileFields((s) => ({ ...s, goals: e.target.value }))} />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button onClick={handleProfileSave} disabled={savingProfile}>{savingProfile ? t('status.saving') : t('actions.saveChanges')}</Button>
                <Button variant="outline" onClick={() => window.location.reload()} disabled={savingProfile}>{t('actions.reset')}</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div><span className="text-muted-foreground">{t('profile.forehandRubber')}:</span> {profileFields.forehand_rubber || '-'}</div>
              <div><span className="text-muted-foreground">{t('profile.backhandRubber')}:</span> {profileFields.backhand_rubber || '-'}</div>
              <div><span className="text-muted-foreground">{t('profile.bladeWood')}:</span> {profileFields.blade_wood || '-'}</div>
              <div><span className="text-muted-foreground">{t('profile.playstyle')}:</span> {profileFields.playstyle || '-'}</div>
              <div className="md:col-span-2"><span className="text-muted-foreground">{t('profile.strengths')}:</span> {profileFields.strengths || '-'}</div>
              <div className="md:col-span-2"><span className="text-muted-foreground">{t('profile.weaknesses')}:</span> {profileFields.weaknesses || '-'}</div>
              <div className="md:col-span-2"><span className="text-muted-foreground">{t('profile.goals')}:</span> {profileFields.goals || '-'}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;

