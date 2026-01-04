import { useEffect, useState } from 'react';
import { usersAPI } from '@/services/api';
import LoadingSpinner from './ui/LoadingSpinner';
import { format, parseISO } from 'date-fns';

// Custom label component to display values above points
const CustomLabel = ({ x, y, value, color }) => {
  if (value === null || value === undefined) return null;
  return (
    <text
      x={x}
      y={y - 8}
      fill={color}
      textAnchor="middle"
      fontSize={14}
      fontWeight="600"
      className="drop-shadow-[0_0_4px_currentColor]"
    >
      {typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(1)) : value}
    </text>
  );
};

const TimelineStats = ({ userId }) => {
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimelineStats = async () => {
      try {
        setLoading(true);
        const res = await usersAPI.getTimelineStats(userId);
        const timeline = res.data.timeline || [];
        console.log('Timeline stats data:', timeline);
        // Log ELO data specifically
        const eloData = timeline.filter(d => d.avg_elo !== null && d.avg_elo !== undefined);
        console.log('ELO data points:', eloData.length, eloData);
        setTimelineData(timeline);
      } catch (error) {
        console.error('Failed to fetch timeline stats:', error);
        setTimelineData([]);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchTimelineStats();
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <LoadingSpinner />
      </div>
    );
  }

  if (timelineData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No timeline data available yet</p>
      </div>
    );
  }

  // Format data for charts (format month labels)
  const formattedData = timelineData.map(item => ({
    ...item,
    monthLabel: format(parseISO(item.month + '-01'), 'MMM yyyy'),
    monthShort: format(parseISO(item.month + '-01'), 'MMM')
  }));

  // Grey color for lines (matching leaderboard default ELO timeline)
  const lineColor = '#6b7280';
  const chartHeight = 60;
  const chartWidth = 300; // Reduced width for side-by-side layout
  const padding = { top: 35, bottom: 20, left: 10, right: 20 }; // Increased top padding for value labels

  // Render a chart using raw SVG (like EloSparkline)
  const renderChart = (title, dataKey, dotColor, data = formattedData) => {
    const isSinglePoint = data.length === 1;
    const values = data.map(d => d[dataKey]).filter(v => v !== null && v !== undefined);
    
    // For ELO chart, show even if no data (but with a message)
    if (values.length === 0) {
      if (dataKey === 'avg_elo') {
        // Show placeholder for ELO chart even when no data
        return (
          <div className="w-full">
            <div className="text-sm font-medium text-gray-300 text-center mb-2">{title}</div>
            <div className="h-[75px] flex items-center justify-center pt-0">
              <div className="text-xs text-gray-500">No ELO data available yet</div>
            </div>
          </div>
        );
      }
      return null;
    }

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;

    // Calculate points
    const points = values.map((val, index) => {
      const xRatio = isSinglePoint ? 1 : index / (values.length - 1);
      const x = padding.left + xRatio * plotWidth;
      const y = padding.top + plotHeight - ((val - minVal) / range) * plotHeight;
      return { x, y, value: val };
    });

    // Shift all coordinates down by 15px to create space at top for labels
    const verticalOffset = 15;
    
    // Create path for line (shifted down)
    const path = isSinglePoint 
      ? `M ${padding.left},${points[0].y + verticalOffset} L ${padding.left + plotWidth},${points[0].y + verticalOffset}`
      : `M ${points.map(p => `${p.x},${p.y + verticalOffset}`).join(' L ')}`;

    // Calculate actual SVG height needed (add extra space at top for labels)
    const svgHeight = chartHeight + verticalOffset;
    
    return (
      <div className="w-full">
        <div className="text-sm font-medium text-gray-300 text-center mb-2">{title}</div>
        <div className="h-[75px] flex items-start justify-center pt-0">
          <svg width={chartWidth} height={svgHeight} style={{ maxWidth: '100%' }}>
            {/* Line - always grey */}
            <path
              d={path}
              stroke={lineColor}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dots and labels */}
            {points.map((point, index) => (
              <g key={index}>
                <circle
                  cx={point.x}
                  cy={point.y + verticalOffset}
                  r={4}
                  fill={dotColor}
                />
                <CustomLabel x={point.x} y={point.y + verticalOffset} value={point.value} color={dotColor} />
              </g>
            ))}
            {/* Month labels */}
            {data.map((item, index) => {
              const xRatio = isSinglePoint ? 1 : index / (data.length - 1);
              const x = padding.left + xRatio * plotWidth;
              return (
                <text
                  key={index}
                  x={x}
                  y={chartHeight + 10}
                  fill="#9ca3af"
                  fontSize={12}
                  textAnchor="middle"
                >
                  {item.monthShort}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  const chartConfig = {
    leagues: { color: '#a78bfa' },
    matches: { color: '#60a5fa' },
    winRate: { color: '#34d399' },
    elo: { color: '#60a5fa' },
  };

  return (
    <div className="grid grid-cols-2 gap-1 w-full">
      {renderChart('Leagues Over Time', 'leagues_count', chartConfig.leagues.color)}
      {renderChart('Matches Per Month', 'matches_per_month', chartConfig.matches.color)}
      {renderChart('Win Rate Over Time', 'win_rate', chartConfig.winRate.color)}
      {renderChart(
        'Average ELO Over Time', 
        'avg_elo', 
        chartConfig.elo.color,
        formattedData
      )}
    </div>
  );
};

export default TimelineStats;
