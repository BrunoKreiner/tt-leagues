import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

const LeagueDetailPage = () => {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">League Details</h1>
        <p className="text-muted-foreground">
          League ID: {id}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Trophy className="h-5 w-5 mr-2" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            League detail features are being developed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will show league information, leaderboards, recent matches, 
            and allow you to manage league settings if you're an admin.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeagueDetailPage;

