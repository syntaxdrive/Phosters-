import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { validatePassword } from '../../lib/validation';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SetupRequiredNotice } from '../../components/ui/SetupRequiredNotice';
import { LoadingState } from '../../components/ui/States';

export function ResetPasswordPage() {
  const { isConfigured, configError, loading, user, updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isConfigured) {
    return <SetupRequiredNotice reason={configError} />;
  }

  if (loading) {
    return <LoadingState message="Verifying reset link..." />;
  }

  if (!user && !success) {
    return (
      <div className="max-w-md mx-auto py-4 sm:py-10">
        <Card padding="lg">
          <h1 className="text-xl font-bold text-slate-900">Reset link expired or missing</h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Open this page using the password reset link sent to your email address, or request a new reset link below.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <Link
              to="/forgot-password"
              className="inline-flex flex-1 items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
            >
              Request New Link
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const nextPwErr = validatePassword(password);
    const nextConfirmErr = confirmPassword !== password ? 'Passwords do not match.' : null;
    setPasswordError(nextPwErr);
    setConfirmError(nextConfirmErr);

    if (nextPwErr || nextConfirmErr) return;

    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);

    if (error) {
      setFormError(error);
      return;
    }

    setSuccess(true);
  }

  return (
    <div className="max-w-md mx-auto py-4 sm:py-10">
      <Card padding="lg">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Choose a new password
          </h1>
          <p className="text-sm text-slate-600">
            Set a strong password you have not used elsewhere.
          </p>
        </div>

        {formError && (
          <Alert tone="error" className="mt-5">
            {formError}
          </Alert>
        )}

        {success ? (
          <div className="mt-5 space-y-5">
            <Alert tone="success" title="Password updated">
              Your Phosters password has been changed successfully.
            </Alert>
            <Button fullWidth size="lg" onClick={() => navigate('/app', { replace: true })}>
              Continue to Home
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <Input
              label="New password"
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              error={passwordError}
              required
            />

            <Input
              label="Confirm new password"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmError) setConfirmError(null);
              }}
              error={confirmError}
              required
            />

            <Button type="submit" fullWidth size="lg" loading={submitting}>
              Update Password
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
