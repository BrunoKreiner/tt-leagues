import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Swords } from 'lucide-react';

const MatchesPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Matches</h1>
        <p className="text-muted-foreground">
          Record and view your table tennis matches.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Swords className="h-5 w-5 mr-2" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            Match recording features are being developed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will allow you to record new matches, view your match history, 
            and track your ELO progression across different leagues.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MatchesPage;

