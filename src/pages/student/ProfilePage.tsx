import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { validateFullName, validateOptionalPhone } from '../../lib/validation';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

export function ProfilePage() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profile</h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span>{profile?.role === 'admin' ? 'Administrator' : 'Student'}</span>
          {joinedDate && (
            <>
              <span aria-hidden="true">·</span>
              <span>Joined {joinedDate}</span>
            </>
          )}
        </div>
      </div>

      <Card padding="lg">
        <h2 className="text-base font-bold text-slate-900">Personal details</h2>
        <p className="mt-1 text-sm text-slate-600">
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

      <Card padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Session</h2>
          <p className="text-sm text-slate-600">
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
