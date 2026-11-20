import { useAuth } from '../hooks/useAuth';
import { Alert } from '../components/ui/Alert';
import { SetupRequiredNotice } from '../components/ui/SetupRequiredNotice';
import { Link } from 'react-router-dom';

export function SetupPage() {
  const { isConfigured, configError } = useAuth();

  if (isConfigured) {
    return (
      <div className="max-w-xl mx-auto py-8 space-y-4">
        <Alert tone="success" title="Supabase is connected">
          Your Supabase environment variables are configured. You can sign up or sign in now.
        </Alert>
        <Link
          to="/login"
          className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  return <SetupRequiredNotice reason={configError} />;
}
