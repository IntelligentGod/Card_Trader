import { useState, type FormEvent } from 'react';
import {
  type AdminUpdateUserRequest,
  type AdminUpdateVendorRequest,
  type AdminUserDetail,
} from '@card-trader/shared';
import { getSession, patchSessionUser, request } from '../api';
import {
  Checkbox,
  FormError,
  FormSuccess,
  SocialFields,
  TextField,
  nullable,
  sameSocial,
  socialDraft,
  socialFromDraft,
} from '../forms';

const USERNAME_PATTERN = '[a-z0-9_]{3,20}';
const URL_PATTERN = 'https?://.+';

function userUrl(publicId: string): string {
  return `/admin/users/${encodeURIComponent(publicId)}`;
}

interface Props {
  user: AdminUserDetail;
  onSaved: (user: AdminUserDetail) => void;
}

export function UserEditPanel({ user, onSaved }: Props) {
  return (
    <div className="edit-stack">
      <ProfileForm user={user} onSaved={onSaved} />
      {user.vendor ? (
        <VendorForm user={user} onSaved={onSaved} />
      ) : (
        <section className="card">
          <h2>Vendor</h2>
          <p className="muted">This user has never set up Vendor Mode, so there is no vendor profile to edit.</p>
        </section>
      )}
    </div>
  );
}

// ───────────── Profile ─────────────

function ProfileForm({ user, onSaved }: Props) {
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [location, setLocation] = useState(user.location ?? '');
  const [social, setSocial] = useState(() => socialDraft(user.socialLinks));
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  function buildPatch(): AdminUpdateUserRequest {
    const patch: AdminUpdateUserRequest = {};
    if (email.trim() !== user.email) patch.email = email.trim();
    if (username.trim() !== user.username) patch.username = username.trim();
    if (displayName.trim() !== user.displayName) patch.displayName = displayName.trim();
    if (nullable(bio) !== (user.bio ?? null)) patch.bio = nullable(bio);
    if (nullable(location) !== (user.location ?? null)) patch.location = nullable(location);
    const links = socialFromDraft(social);
    if (!sameSocial(links, user.socialLinks)) patch.socialLinks = links;
    if (removeAvatar) patch.removeAvatar = true;
    return patch;
  }

  const patch = buildPatch();
  const dirty = Object.keys(patch).length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await request<AdminUserDetail>(userUrl(user.publicId), {
        method: 'PATCH',
        body: { ...patch, reason: nullable(reason) },
      });
      if (getSession()?.user.publicId === next.publicId) {
        patchSessionUser({
          email: next.email,
          username: next.username,
          displayName: next.displayName,
          avatarUrl: next.avatarUrl,
        });
      }
      // Re-sync the draft with what the server stored.
      setEmail(next.email);
      setUsername(next.username);
      setDisplayName(next.displayName);
      setBio(next.bio ?? '');
      setLocation(next.location ?? '');
      setSocial(socialDraft(next.socialLinks));
      setRemoveAvatar(false);
      setReason('');
      setSaved(true);
      onSaved(next);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2>Profile</h2>
      <FormError error={error} />
      {saved && <FormSuccess>Profile saved.</FormSuccess>}
      <div className="form-grid">
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          maxLength={254}
          required
        />
        <TextField
          label="Username"
          value={username}
          onChange={(v) => setUsername(v.toLowerCase())}
          minLength={3}
          maxLength={20}
          pattern={USERNAME_PATTERN}
          hint="3–20 characters: a–z, 0–9, _"
          required
        />
        <TextField label="Display name" value={displayName} onChange={setDisplayName} minLength={2} maxLength={40} required />
        <TextField label="Location" value={location} onChange={setLocation} maxLength={80} />
      </div>
      <TextField label="Bio" value={bio} onChange={setBio} maxLength={280} multiline />
      <h3>Social links</h3>
      <SocialFields draft={social} onChange={setSocial} />
      <Checkbox
        label="Remove profile photo"
        checked={removeAvatar}
        onChange={setRemoveAvatar}
        disabled={!user.avatarUrl}
      />
      <TextField
        label="Reason (optional, saved in the history)"
        value={reason}
        onChange={setReason}
        maxLength={500}
        multiline
      />
      <div className="form-actions">
        <span className="muted small">{dirty ? `Changed: ${Object.keys(patch).join(', ')}` : 'No changes'}</span>
        <button type="submit" className="btn btn-primary" disabled={!dirty || busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  );
}

// ───────────── Vendor ─────────────

function VendorForm({ user, onSaved }: Props) {
  const vendor = user.vendor!;
  const [isActive, setIsActive] = useState(vendor.isActive);
  const [businessName, setBusinessName] = useState(vendor.businessName);
  const [description, setDescription] = useState(vendor.description ?? '');
  const [website, setWebsite] = useState(vendor.website ?? '');
  const [social, setSocial] = useState(() => socialDraft(vendor.socialLinks));
  const [removeLogo, setRemoveLogo] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const patch: AdminUpdateVendorRequest = {};
  if (isActive !== vendor.isActive) patch.isActive = isActive;
  if (businessName.trim() !== vendor.businessName) patch.businessName = businessName.trim();
  if (nullable(description) !== (vendor.description ?? null)) patch.description = nullable(description);
  if (nullable(website) !== (vendor.website ?? null)) patch.website = nullable(website);
  const links = socialFromDraft(social);
  if (!sameSocial(links, vendor.socialLinks)) patch.socialLinks = links;
  if (removeLogo) patch.removeLogo = true;
  const dirty = Object.keys(patch).length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await request<AdminUserDetail>(`${userUrl(user.publicId)}/vendor`, {
        method: 'PATCH',
        body: { ...patch, reason: nullable(reason) },
      });
      if (next.vendor) {
        setIsActive(next.vendor.isActive);
        setBusinessName(next.vendor.businessName);
        setDescription(next.vendor.description ?? '');
        setWebsite(next.vendor.website ?? '');
        setSocial(socialDraft(next.vendor.socialLinks));
      }
      setRemoveLogo(false);
      setReason('');
      setSaved(true);
      onSaved(next);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2>Vendor profile</h2>
      <FormError error={error} />
      {saved && <FormSuccess>Vendor profile saved.</FormSuccess>}
      <Checkbox label="Vendor Mode active" checked={isActive} onChange={setIsActive} />
      <div className="form-grid">
        <TextField
          label="Business name"
          value={businessName}
          onChange={setBusinessName}
          minLength={2}
          maxLength={60}
          required
        />
        <TextField
          label="Website"
          type="url"
          value={website}
          onChange={setWebsite}
          maxLength={200}
          pattern={URL_PATTERN}
          placeholder="https://…"
          hint="Full http(s) URL"
        />
      </div>
      <TextField label="Description" value={description} onChange={setDescription} maxLength={1000} multiline />
      <h3>Vendor social links</h3>
      <SocialFields draft={social} onChange={setSocial} />
      <Checkbox label="Remove logo" checked={removeLogo} onChange={setRemoveLogo} disabled={!vendor.logoUrl} />
      <TextField
        label="Reason (optional, saved in the history)"
        value={reason}
        onChange={setReason}
        maxLength={500}
        multiline
      />
      <div className="form-actions">
        <span className="muted small">{dirty ? `Changed: ${Object.keys(patch).join(', ')}` : 'No changes'}</span>
        <button type="submit" className="btn btn-primary" disabled={!dirty || busy}>
          {busy ? 'Saving…' : 'Save vendor'}
        </button>
      </div>
    </form>
  );
}
