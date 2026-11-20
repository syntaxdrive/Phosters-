import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail } from '../../lib/validation';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SetupRequiredNotice } from '../../components/ui/SetupRequiredNotice';
import { LoadingState } from '../../components/ui/States';

export function LoginPage() {
  const { isConfigured, configError, loading, user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isConfigured) {
    return <SetupRequiredNotice reason={configError} />;
  }

  if (loading) {
    return <LoadingState message="Checking your session..." />;
  }

  if (user) {
    const redirectTo = (location.state as { from?: string } | null)?.from || '/app';
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const nextEmailError = validateEmail(email);
    const nextPasswordError = password ? null : 'Enter your password.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) {
      return;
    }

    setSubmitting(true);
    const { error } = await signIn({ email, password });
    setSubmitting(false);

    if (error) {
      setFormError(error);
      return;
    }

    const redirectTo = (location.state as { from?: string } | null)?.from || '/app';
    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="max-w-md mx-auto py-4 sm:py-10">
      <Card padding="lg">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in to Phosters
          </h1>
          <p className="text-sm text-slate-600">
            Continue your JAMB UTME and UI Post-UTME preparation.
          </p>
        </div>

        {formError && (
          <Alert tone="error" className="mt-5">
            {formError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <Input
            label="Email address"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="student@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            error={emailError}
            required
          />

          <div className="space-y-1.5">
            <Input
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              error={passwordError}
              required
            />
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-phosters-700 hover:text-phosters-800 hover:underline py-1"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <Button type="submit" fullWidth size="lg" loading={submitting}>
            Sign In
          </Button>
        </form>

        <p className="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-600">
          New to Phosters?{' '}
          <Link
            to="/signup"
            className="font-semibold text-phosters-700 hover:text-phosters-800 hover:underline"
          >
            Create a student account
          </Link>
        </p>
      </Card>
    </div>
  );
}
