import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { validateEmail } from '../../lib/validation';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SetupRequiredNotice } from '../../components/ui/SetupRequiredNotice';

export function ForgotPasswordPage() {
  const { isConfigured, configError, user, requestPasswordReset } = useAuth();
  const location = useLocation();
  const initialEmail =
    (location.state as { email?: string } | null)?.email?.trim() || user?.email || '';

  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isConfigured) {
    return <SetupRequiredNotice reason={configError} />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const err = validateEmail(email);
    setEmailError(err);
    if (err) return;

    setSubmitting(true);
    const { error } = await requestPasswordReset(email);
    setSubmitting(false);

    if (error) {
      setFormError(error);
      return;
    }

    setSentTo(email.trim().toLowerCase());
  }

  return (
    <div className="max-w-md mx-auto py-4 sm:py-10">
      <Card padding="lg">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Reset your password
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Enter the email address for your Phosters account and we will send a password reset link.
          </p>
        </div>

        {formError && (
          <Alert tone="error" className="mt-5">
            {formError}
          </Alert>
        )}

        {sentTo ? (
          <div className="mt-5 space-y-5">
            <Alert tone="success" title="Reset link sent">
              If an account exists for <strong>{sentTo}</strong>, a password reset link has been sent to that email address.
            </Alert>
            <Link
              to={user ? '/app/profile' : '/login'}
              className="inline-flex w-full items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {user ? 'Back to Profile' : 'Back to Sign In'}
            </Link>
          </div>
        ) : (
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

            <Button type="submit" fullWidth size="lg" loading={submitting}>
              Send Reset Link
            </Button>

            <div className="text-center pt-2">
              <Link
                to={user ? '/app/profile' : '/login'}
                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:underline"
              >
                {user ? 'Back to Profile' : 'Back to Sign In'}
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
