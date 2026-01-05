import { useEffect, useState, useMemo } from 'react';
import { usersAPI, leaguesAPI } from '@/services/api';

const EloSparkline = ({ userId, rosterId, leagueId, width = 60, height = 20, points = 20 }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if ((!userId && !rosterId) || !leagueId) return;

    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Use roster-based API for placeholder members, user-based API for regular members
        const res = rosterId 
          ? await leaguesAPI.getRosterEloHistory(leagueId, rosterId, { 
              page: 1, 
              limit: Math.max(points - 1, 1),
            })
          : await usersAPI.getEloHistory(userId, { 
              league_id: leagueId, 
              page: 1, 
              limit: Math.max(points - 1, 1),
            });
        
        if (cancelled) return;
        
        // Reverse to show oldest to newest (left to right)
        const historyData = (res.data.items || []).reverse();
        if (historyData.length === 0) {
          setData([]);
          return;
        }

        // The API returns one row per match with `elo_before` + `elo_after`.
        // Build a true time-series so that even a single match produces 2 points.
        const first = historyData[0];
        const series = [{ elo_after: first.elo_before }, ...historyData];
        setData(series);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load ELO history for sparkline:', err);
        setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [userId, rosterId, leagueId, points]);

  const svgPath = useMemo(() => {
    if (data.length < 2) return '';

    const eloValues = data.map(item => item.elo_after);
    const minElo = Math.min(...eloValues);
    const maxElo = Math.max(...eloValues);
    const range = maxElo - minElo || 1; // Avoid division by zero

    const plotPoints = eloValues.map((elo, index) => {
      const x = (index / (eloValues.length - 1)) * width;
      const y = height - ((elo - minElo) / range) * height;
      return `${x},${y}`;
    });

    return `M ${plotPoints.join(' L ')}`;
  }, [data, width, height]);

  if (loading) {
    return (
      <div 
        className="bg-muted animate-pulse rounded" 
        style={{ width, height }}
      />
    );
  }

  if (error) {
    return (
      <div 
        className="bg-muted rounded flex items-center justify-center text-xs text-muted-foreground"
        style={{ width, height }}
        title="Failed to load ELO data"
      >
        !
      </div>
    );
  }

  if (data.length < 2) {
    // Show a straight line placeholder when there's insufficient ELO history
    const midY = height / 2;
    return (
      <div style={{ width, height }}>
        <svg 
          width={width} 
          height={height} 
          className="overflow-visible"
          style={{ minWidth: width }}
        >
          <line
            x1="0"
            y1={midY}
            x2={width}
            y2={midY}
            stroke="#6b7280"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  const latestElo = data[data.length - 1]?.elo_after;
  const previousElo = data[data.length - 2]?.elo_after;
  const trend = latestElo > previousElo ? 'up' : latestElo < previousElo ? 'down' : 'flat';

  return (
    <div className="flex items-center gap-1">
      <svg 
        width={width} 
        height={height} 
        className="overflow-visible"
        style={{ minWidth: width }}
      >
        <path
          d={svgPath}
          stroke={trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#6b7280'}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`text-xs ${
        trend === 'up' ? 'text-green-600' : 
        trend === 'down' ? 'text-red-600' : 
        'text-muted-foreground'
      }`}>
        {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
      </span>
    </div>
  );
};

export default EloSparkline;
