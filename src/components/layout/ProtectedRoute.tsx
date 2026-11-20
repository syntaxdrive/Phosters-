import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { SetupRequiredNotice } from '../ui/SetupRequiredNotice';
import { ErrorState, LoadingState } from '../ui/States';

export function ProtectedRoute() {
  const {
    isConfigured,
    configError,
    loading,
    profileLoading,
    profileError,
    user,
    profile,
    refreshProfile,
    signOut,
  } = useAuth();
  const location = useLocation();

  if (!isConfigured) {
    return <SetupRequiredNotice reason={configError} />;
  }

  if (loading) {
    return <LoadingState message="Checking your session..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (profileLoading && !profile) {
    return <LoadingState message="Loading your profile..." />;
  }

  if (profileError && !profile) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Profile unavailable"
          message={profileError}
          onRetry={() => void refreshProfile()}
          retryLabel="Retry loading profile"
        />
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
