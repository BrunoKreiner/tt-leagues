import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { leaguesAPI } from '@/services/api';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const COLOR_PALETTE = [
  '#60a5fa',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#22d3ee',
  '#c084fc',
  '#f472b6',
];

const LeagueEloTimeline = ({ leagueId, players, playersStatus, playersError, eloRange }) => {
  const { t } = useTranslation();
  const [selectedRosterIds, setSelectedRosterIds] = useState([]);
  const [series, setSeries] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (players.length === 0) return;
    if (selectedRosterIds.length > 0) return;
    const initialSelection = players.slice(0, 3).map((player) => player.roster_id);
    setSelectedRosterIds(initialSelection);
  }, [players, selectedRosterIds.length]);

  useEffect(() => {
    if (!leagueId) return;
    if (selectedRosterIds.length === 0) {
      setSeries([]);
      setStatus('idle');
      setError(null);
      return;
    }

    let cancelled = false;
    const fetchTimeline = async () => {
      try {
        setStatus('loading');
        setError(null);
        const rosterIdsParam = selectedRosterIds.join(',');
        const res = await leaguesAPI.getEloTimeline(
          leagueId,
          { roster_ids: rosterIdsParam, limit: 50 },
          { ttlMs: 10000 }
        );
        const items = res.data?.items;
        if (cancelled) return;
        if (Array.isArray(items)) {
          setSeries(items);
        } else {
          setSeries([]);
        }
        setStatus('loaded');
      } catch (err) {
        if (cancelled) return;
        const apiMessage = err?.response?.data?.error;
        if (typeof apiMessage === 'string' && apiMessage.length > 0) {
          setError(apiMessage);
        } else {
          setError(t('leagues.eloTimelineError'));
        }
        setStatus('error');
      }
    };

    fetchTimeline();
    return () => { cancelled = true; };
  }, [leagueId, selectedRosterIds, t]);

  const colorByRosterId = useMemo(() => {
    const map = new Map();
    players.forEach((player, index) => {
      const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
      map.set(player.roster_id, color);
    });
    return map;
  }, [players]);

  const selectedSeries = useMemo(() => {
    const selectedSet = new Set(selectedRosterIds);
    return series.filter((entry) => selectedSet.has(entry.roster_id));
  }, [series, selectedRosterIds]);

  const chartConfig = useMemo(() => {
    const config = {};
    selectedSeries.forEach((entry) => {
      const lineKey = `roster_${entry.roster_id}`;
      const color = colorByRosterId.get(entry.roster_id);
      config[lineKey] = {
        label: entry.display_name,
        color,
      };
    });
    return config;
  }, [selectedSeries, colorByRosterId]);

  const chartData = useMemo(() => {
    const dataMap = new Map();
    selectedSeries.forEach((entry) => {
      if (!Array.isArray(entry.history)) return;
      const lineKey = `roster_${entry.roster_id}`;
      entry.history.forEach((point) => {
        const timestamp = new Date(point.recorded_at).getTime();
        if (!Number.isFinite(timestamp)) return;
        let row = dataMap.get(timestamp);
        if (!row) {
          row = {
            timestamp,
            label: format(new Date(timestamp), 'MMM d, yyyy'),
          };
          dataMap.set(timestamp, row);
        }
        row[lineKey] = point.elo_after;
      });
    });
    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [selectedSeries]);

  const yDomain = useMemo(() => {
    let minValue;
    let maxValue;

    if (eloRange) {
      const minRaw = eloRange.min_elo;
      const maxRaw = eloRange.max_elo;
      const parsedMin = typeof minRaw === 'number' ? minRaw : Number.parseFloat(minRaw);
      const parsedMax = typeof maxRaw === 'number' ? maxRaw : Number.parseFloat(maxRaw);
      if (Number.isFinite(parsedMin) && Number.isFinite(parsedMax)) {
        minValue = parsedMin;
        maxValue = parsedMax;
      }
    }

    if (minValue === undefined || maxValue === undefined) {
      const values = [];
      selectedSeries.forEach((entry) => {
        if (!Array.isArray(entry.history)) return;
        entry.history.forEach((point) => {
          if (typeof point.elo_after === 'number') {
            values.push(point.elo_after);
          }
        });
      });
      if (values.length > 0) {
        minValue = Math.min(...values);
        maxValue = Math.max(...values);
      }
    }

    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      return null;
    }

    const padding = 100;
    return [minValue - padding, maxValue + padding];
  }, [eloRange, selectedSeries]);

  const toggleRoster = (rosterId) => {
    setSelectedRosterIds((prev) => {
      const exists = prev.includes(rosterId);
      if (exists) {
        return prev.filter((id) => id !== rosterId);
      }
      return [...prev, rosterId];
    });
  };

  const handleSelectAll = () => {
    if (players.length === 0) return;
    const allIds = players.map((player) => player.roster_id);
    setSelectedRosterIds(allIds);
  };

  const handleClear = () => {
    setSelectedRosterIds([]);
  };

  return (
    <Card className="vg-card">
      <CardHeader className="py-4">
        <CardTitle className="cyberpunk-subtitle text-lg">{t('leagues.eloTimeline')}</CardTitle>
        <CardDescription className="text-gray-400">{t('leagues.eloTimelineHint')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {playersStatus === 'loading' || playersStatus === 'idle' ? (
          <div className="flex items-center justify-center py-6">
            <LoadingSpinner size="sm" />
          </div>
        ) : playersStatus === 'error' ? (
          <p className="text-sm text-red-400">
            {typeof playersError === 'string' && playersError.length > 0
              ? playersError
              : t('leagues.eloTimelineError')}
          </p>
        ) : players.length === 0 ? (
          <p className="text-sm text-gray-400">{t('leagues.noPlayers')}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
                {t('common.all')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                {t('actions.reset')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {players.map((player) => {
                const isSelected = selectedRosterIds.includes(player.roster_id);
                const color = colorByRosterId.get(player.roster_id);
                return (
                  <button
                    key={player.roster_id}
                    type="button"
                    onClick={() => toggleRoster(player.roster_id)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                      isSelected
                        ? 'border-gray-600 bg-gray-800 text-gray-100'
                        : 'border-gray-800 bg-gray-900/30 text-gray-400 hover:border-gray-700 hover:text-gray-200'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: isSelected ? color : '#374151' }}
                    />
                    <span className="max-w-[140px] truncate">{player.display_name}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {playersStatus === 'loading' || playersStatus === 'idle' || playersStatus === 'error' ? null : selectedRosterIds.length === 0 ? (
          <p className="text-sm text-gray-400">{t('leagues.eloTimelineSelect')}</p>
        ) : status === 'loading' ? (
          <div className="flex items-center justify-center py-6">
            <LoadingSpinner size="sm" />
          </div>
        ) : status === 'error' ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-gray-400">{t('leagues.eloTimelineEmpty')}</p>
        ) : (
          <ChartContainer className="h-40 w-full aspect-[4/1]" config={chartConfig}>
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(value) => format(new Date(value), 'MMM d')}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={(value) => value.toString()}
                domain={yDomain === null ? undefined : yDomain}
              />
              <ChartTooltip
                cursor={{ strokeDasharray: '4 4' }}
                content={<ChartTooltipContent labelKey="label" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              {selectedSeries.map((entry) => {
                const lineKey = `roster_${entry.roster_id}`;
                const color = colorByRosterId.get(entry.roster_id);
                return (
                  <Line
                    key={lineKey}
                    dataKey={lineKey}
                    type="monotone"
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default LeagueEloTimeline;
