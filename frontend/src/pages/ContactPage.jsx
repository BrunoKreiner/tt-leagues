import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-white">Contact</h1>
          <p className="text-sm text-gray-400">
            Contact form coming next.
          </p>
          <div className="pt-2">
            <Button asChild variant="outline">
              <Link to="/">Back to landing</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

