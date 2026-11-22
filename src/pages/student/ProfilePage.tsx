import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isSuperAdminUser } from '../../lib/superAdmin';
import { validateFullName, validateOptionalPhone, validatePassword } from '../../lib/validation';
import { PWAInstallButton } from '../../components/pwa/PWAInstallButton';
import { PushNotificationSettings } from '../../components/pwa/PushNotificationSettings';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

export function ProfilePage() {
  const { user, profile, updateProfile, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [passwordSaveError, setPasswordSaveError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    const nextNameErr = validateFullName(fullName);
    const nextPhoneErr = validateOptionalPhone(phone);
    setNameError(nextNameErr);
    setPhoneError(nextPhoneErr);

    if (nextNameErr || nextPhoneErr) {
      return;
    }

    setSaving(true);
    const { error } = await updateProfile({ fullName, phone });
    setSaving(false);

    if (error) {
      setSaveError(error);
      return;
    }

    setSaveSuccess(true);
  }

  async function handlePasswordUpdate(e: FormEvent) {
    e.preventDefault();
    setPasswordSaveError(null);
    setPasswordSaved(false);

    const nextPwErr = validatePassword(newPassword);
    const nextConfirmErr =
      confirmPassword !== newPassword ? 'Passwords do not match.' : null;
    setPasswordError(nextPwErr);
    setConfirmPasswordError(nextConfirmErr);

    if (nextPwErr || nextConfirmErr) {
      return;
    }

    setUpdatingPassword(true);
    const { error } = await updatePassword(newPassword);
    setUpdatingPassword(false);

    if (error) {
      setPasswordSaveError(error);
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    setPasswordSaved(true);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    navigate('/login');
  }

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Profile</h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
          <span>
            {isSuperAdminUser(user?.email, profile?.role)
              ? 'Super Administrator'
              : profile?.role === 'admin'
                ? 'Tutor / Administrator'
                : 'Student'}
          </span>
          {joinedDate && (
            <>
              <span aria-hidden="true">·</span>
              <span>Joined {joinedDate}</span>
            </>
          )}
        </div>
      </div>

      <Card padding="lg">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Personal details</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Update your display name or optional contact phone number.
        </p>

        {saveError && (
          <Alert tone="error" className="mt-4">
            {saveError}
          </Alert>
        )}

        {saveSuccess && (
          <Alert tone="success" className="mt-4">
            Your profile has been updated.
          </Alert>
        )}

        <form onSubmit={handleSave} noValidate className="mt-5 space-y-4">
          <Input
            label="Email address"
            type="email"
            value={user?.email ?? ''}
            disabled
            hint="Email address is managed through your account authentication."
          />

          <Input
            label="Full name"
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (nameError) setNameError(null);
              if (saveSuccess) setSaveSuccess(false);
            }}
            error={nameError}
            required
          />

          <Input
            label="Phone number (optional)"
            type="tel"
            placeholder="08012345678"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (phoneError) setPhoneError(null);
              if (saveSuccess) setSaveSuccess(false);
            }}
            error={phoneError}
          />

          <div className="pt-1">
            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>

      <Card padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-phosters-700 dark:text-phosters-400" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Password &amp; security</h2>
          </div>
          <Link
            to="/forgot-password"
            state={{ email: user?.email ?? '' }}
            className="text-sm font-semibold text-phosters-700 dark:text-phosters-400 hover:text-phosters-800 dark:hover:text-phosters-300 hover:underline self-start sm:self-auto"
          >
            Forgot password? Send reset link
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Set a new password for your Phosters account or request a reset link by email.
        </p>

        {passwordSaveError && (
          <Alert tone="error" className="mt-4">
            {passwordSaveError}
          </Alert>
        )}

        {passwordSaved && (
          <Alert tone="success" className="mt-4">
            Your password has been updated.
          </Alert>
        )}

        <form onSubmit={handlePasswordUpdate} noValidate className="mt-5 space-y-4">
          <Input
            label="New password"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (passwordError) setPasswordError(null);
              if (passwordSaved) setPasswordSaved(false);
            }}
            error={passwordError}
            required
          />

          <Input
            label="Confirm new password"
            type="password"
            name="confirmNewPassword"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (confirmPasswordError) setConfirmPasswordError(null);
              if (passwordSaved) setPasswordSaved(false);
            }}
            error={confirmPasswordError}
            required
          />

          <div className="pt-1">
            <Button type="submit" loading={updatingPassword}>
              Update Password
            </Button>
          </div>
        </form>
      </Card>

      <PushNotificationSettings variant="card" />

      <PWAInstallButton variant="card" />

      <Card padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Examinations &amp; subjects</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Update your JAMB UTME or UI Post-UTME subject combinations.
          </p>
        </div>
        <Link
          to="/app/setup-exams"
          className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
        >
          Manage Exams
        </Link>
      </Card>

      <Card padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Appearance &amp; legal policies</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Switch between Light and Dark mode or review Phosters privacy and safety policies.
          </p>
        </div>
        <Link
          to="/settings"
          className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
        >
          Open Settings
        </Link>
      </Card>

      <Card padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Session</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sign out of your Phosters account on this device.
          </p>
        </div>
        <Button variant="secondary" onClick={handleSignOut} loading={signingOut}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Sign Out</span>
        </Button>
      </Card>
    </div>
  );
}
