import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const RechartsComponents = ({
  chartData,
  chartConfig,
  yDomain,
  selectedSeries,
  colorByRosterId,
}) => {
  return (
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
  );
};

export default RechartsComponents;
