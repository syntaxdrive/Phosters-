import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  validateEmail,
  validateFullName,
  validateOptionalPhone,
  validatePassword,
} from '../../lib/validation';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SetupRequiredNotice } from '../../components/ui/SetupRequiredNotice';
import { LoadingState } from '../../components/ui/States';

export function SignupPage() {
  const { isConfigured, configError, loading, user, signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isConfigured) {
    return <SetupRequiredNotice reason={configError} />;
  }

  if (loading) {
    return <LoadingState message="Checking your session..." />;
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const nextErrors = {
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      phone: validateOptionalPhone(phone),
      password: validatePassword(password),
      confirmPassword:
        confirmPassword !== password ? 'Passwords do not match.' : null,
    };

    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setSubmitting(true);
    const result = await signUp({
      fullName,
      email,
      phone,
      password,
    });
    setSubmitting(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    if (result.requiresEmailConfirmation) {
      setConfirmationEmail(email.trim().toLowerCase());
      return;
    }

    navigate('/app', { replace: true });
  }

  if (confirmationEmail) {
    return (
      <div className="max-w-md mx-auto py-4 sm:py-10">
        <Card padding="lg">
          <Alert tone="success" title="Confirm your email address">
            We sent a confirmation link to <strong>{confirmationEmail}</strong>. Open the link in your inbox, then sign in to start using Phosters.
          </Alert>
          <div className="mt-6">
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center min-h-[48px] px-5 py-3 rounded-lg bg-phosters-600 text-white text-base font-semibold hover:bg-phosters-700 transition-colors"
            >
              Go to Sign In
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-4 sm:py-8">
      <Card padding="lg">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Create your Phosters account
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Register once to access JAMB UTME and UI Post-UTME study tools.
          </p>
        </div>

        {formError && (
          <Alert tone="error" className="mt-5">
            <span>{formError}</span>
            {formError.toLowerCase().includes('already exists') && (
              <>
                {' '}
                <Link
                  to="/forgot-password"
                  state={{ email }}
                  className="font-semibold underline hover:text-red-950 dark:hover:text-red-100"
                >
                  Forgot your password?
                </Link>
              </>
            )}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <Input
            label="Full name"
            type="text"
            name="fullName"
            autoComplete="name"
            placeholder="e.g. Adebayo Oluwaseun"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: null }));
            }}
            error={errors.fullName}
            required
          />

          <Input
            label="Email address"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="student@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
            }}
            error={errors.email}
            required
          />

          <Input
            label="Phone number (optional)"
            type="tel"
            name="phone"
            autoComplete="tel"
            placeholder="08012345678"
            hint="Optional. Used only for account contact if needed."
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: null }));
            }}
            error={errors.phone}
          />

          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
            }}
            error={errors.password}
            required
          />

          <Input
            label="Confirm password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword) {
                setErrors((prev) => ({ ...prev, confirmPassword: null }));
              }
            }}
            error={errors.confirmPassword}
            required
          />

          <Button type="submit" fullWidth size="lg" loading={submitting}>
            Create Account
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p>
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-phosters-700 dark:text-phosters-400 hover:text-phosters-800 dark:hover:text-phosters-300 hover:underline"
            >
              Sign in
            </Link>
          </p>
          <p>
            <Link
              to="/forgot-password"
              state={{ email }}
              className="font-medium text-phosters-700 dark:text-phosters-400 hover:text-phosters-800 dark:hover:text-phosters-300 hover:underline"
            >
              Forgot your password?
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
