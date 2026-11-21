import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';

export function NotFoundPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-md mx-auto py-10">
      <Card padding="lg" className="text-center space-y-4">
        <p className="text-sm font-mono font-medium text-slate-500 dark:text-slate-400">404</p>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Page not found</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          The page you requested does not exist or has been moved.
        </p>
        <div className="pt-2">
          <Link
            to={user ? '/app' : '/'}
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
          >
            {user ? 'Go to Home' : 'Go to Overview'}
          </Link>
        </div>
      </Card>
    </div>
  );
}
