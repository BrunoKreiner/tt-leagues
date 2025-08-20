import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

const AdminPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground">
          Manage users, leagues, and system settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            Admin features are being developed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will provide admin tools for managing users, approving matches, 
            creating leagues, and monitoring system activity.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPage;

