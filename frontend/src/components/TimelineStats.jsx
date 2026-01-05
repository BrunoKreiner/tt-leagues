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
  const chartWidth = 300; // Base width for viewBox
  const maxChartWidth = 300; // Max width to prevent over-stretching on large screens
  const padding = { top: 35, bottom: 20, left: 10, right: 20 }; // Increased top padding for value labels

  // Render a chart using raw SVG (like EloSparkline)
  const renderChart = (title, dataKey, dotColor, data = formattedData) => {
    const values = data.map(d => d[dataKey]).filter(v => v !== null && v !== undefined);
    
    // Show a placeholder if no data for this chart yet
    if (values.length === 0) {
      return (
        <div className="w-full">
          <div className="text-sm font-medium text-gray-300 text-center mb-2">{title}</div>
          <div className="h-[75px] flex items-start justify-center pt-0">
            <svg
              width="100%"
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ maxWidth: `${maxChartWidth}px`, margin: '0 auto' }}
            >
              {/* Grey horizontal line when no data */}
              <line
                x1={padding.left}
                y1={chartHeight / 2}
                x2={chartWidth - padding.right}
                y2={chartHeight / 2}
                stroke={lineColor}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      );
    }

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;

    // Calculate points aligned to their actual month positions.
    // This prevents a single ELO data point from drawing a full-width line across earlier months.
    const points = data
      .map((d, monthIndex) => {
        const val = d[dataKey];
        if (val === null || val === undefined) return null;
        const xRatio = data.length === 1 ? 1 : monthIndex / (data.length - 1);
        const x = padding.left + xRatio * plotWidth;
        const y = padding.top + plotHeight - ((val - minVal) / range) * plotHeight;
        return { x, y, value: val, monthIndex };
      })
      .filter(Boolean);

    // Shift all coordinates down by 15px to create space at top for labels
    const verticalOffset = 15;
    
    // Create path for line (shifted down).
    // If we only have one point, show a grey horizontal line (like EloSparkline)
    const path = points.length >= 2
      ? `M ${points.map(p => `${p.x},${p.y + verticalOffset}`).join(' L ')}`
      : '';
    
    // For single point, show grey horizontal line
    const showPlaceholderLine = points.length === 1;
    const midY = padding.top + plotHeight / 2 + verticalOffset;

    // Calculate actual SVG height needed (add extra space at top for labels)
    const svgHeight = chartHeight + verticalOffset;
    
    return (
      <div className="w-full">
        <div className="text-sm font-medium text-gray-300 text-center mb-2">{title}</div>
        <div className="h-[75px] flex items-start justify-center pt-0">
          <svg
            width="100%"
            height={svgHeight}
            viewBox={`0 0 ${chartWidth} ${svgHeight}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ maxWidth: `${maxChartWidth}px`, margin: '0 auto' }}
          >
            {/* Line - always grey */}
            {path ? (
              <path
                d={path}
                stroke={lineColor}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {/* Grey horizontal line when only one point (insufficient data) */}
            {showPlaceholderLine && (
              <line
                x1={padding.left}
                y1={midY}
                x2={chartWidth - padding.right}
                y2={midY}
                stroke={lineColor}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
            {/* Dots and labels */}
            {points.map((point) => (
              <g key={point.monthIndex}>
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
              const xRatio = data.length === 1 ? 1 : index / (data.length - 1);
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
