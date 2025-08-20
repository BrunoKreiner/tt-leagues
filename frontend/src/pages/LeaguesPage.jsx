import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

const LeaguesPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leagues</h1>
        <p className="text-muted-foreground">
          Browse and join table tennis leagues.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Trophy className="h-5 w-5 mr-2" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            League management features are being developed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will allow you to browse available leagues, join new ones, 
            and manage your league memberships.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaguesPage;

