import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { SOCIAL_LINK_KEYS, type AdminUserDetail } from '@card-trader/shared';
import { errorMessage } from '../../api/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Controls';
import { Screen } from '../../components/Screen';
import { SkeletonBlock } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { socialLinkErrors, SocialLinksFields } from '../profile/SocialLinksFields';
import {
  diffUser,
  diffVendor,
  REASON_MAX,
  userFormFrom,
  validateUserForm,
  validateVendorForm,
  vendorFormFrom,
  type UserForm,
  type VendorForm,
} from './adminForm';
import { useAdminUpdateUser, useAdminUpdateVendor, useAdminUser } from './hooks';

/** Profile and vendor fields only; status changes go through Block / Unblock on the user screen. */
export function AdminEditUserScreen({ route, navigation }: RootScreenProps<'AdminEditUser'>) {
  const { publicId } = route.params;
  const detail = useAdminUser(publicId);

  if (detail.isPending) {
    return (
      <Screen>
        <SkeletonBlock height={320} />
      </Screen>
    );
  }
  if (detail.error) return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  if (!detail.data.permissions.editProfile) {
    return <EmptyState icon="lock-closed-outline" title="Can’t edit this account" message="Your admin role doesn’t allow changes to this profile." />;
  }
  // The form starts from the server state once and keeps local edits after that (diffs are against the latest server copy).
  return <EditUserForm user={detail.data} onDone={() => navigation.goBack()} />;
}

function EditUserForm({ user, onDone }: { user: AdminUserDetail; onDone: () => void }) {
  const [form, setForm] = useState<UserForm>(() => userFormFrom(user));
  const [vendorForm, setVendorForm] = useState<VendorForm | null>(() => (user.vendor ? vendorFormFrom(user.vendor) : null));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const updateUser = useAdminUpdateUser(user.publicId);
  const updateVendor = useAdminUpdateVendor(user.publicId);

  const set = <K extends keyof UserForm>(key: K, value: UserForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setVendor = <K extends keyof VendorForm>(key: K, value: VendorForm[K]) =>
    setVendorForm((f) => (f ? { ...f, [key]: value } : f));

  const errors = validateUserForm(form);
  const vendorErrors = vendorForm ? validateVendorForm(vendorForm) : {};
  const userBody = diffUser(user, form, reason);
  const vendorBody = user.vendor && vendorForm ? diffVendor(user.vendor, vendorForm, reason) : {};
  const changed = Object.keys(userBody).length > 0 || Object.keys(vendorBody).length > 0;
  const valid = Object.keys(errors).length === 0 && Object.keys(vendorErrors).length === 0 && reason.length <= REASON_MAX;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Two endpoints: profile first, then the vendor profile.
      if (Object.keys(userBody).length > 0) await updateUser.mutateAsync(userBody);
      if (Object.keys(vendorBody).length > 0) await updateVendor.mutateAsync(vendorBody);
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Surface style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Account
        </AppText>
        <TextField
          label="Email"
          value={form.email}
          onChangeText={(v) => set('email', v)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          maxLength={254}
          error={errors.email}
        />
        <TextField
          label="Username"
          value={form.username}
          onChangeText={(v) => set('username', v)}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={21}
          error={errors.username}
        />
        <TextField label="Display name" value={form.displayName} onChangeText={(v) => set('displayName', v)} maxLength={40} error={errors.displayName} />
        <TextField label="Location" value={form.location} onChangeText={(v) => set('location', v)} maxLength={80} error={errors.location} />
        <TextField
          label="Bio"
          value={form.bio}
          onChangeText={(v) => set('bio', v)}
          multiline
          maxLength={280}
          hint={`${form.bio.length}/280`}
          error={errors.bio}
        />
        {user.avatarUrl ? (
          <View style={styles.switchRow}>
            <AppText style={styles.flex}>Remove profile photo</AppText>
            <Switch value={form.removeAvatar} onValueChange={(v) => set('removeAvatar', v)} trackColor={{ true: colors.negative, false: colors.border }} />
          </View>
        ) : null}
        <SocialLinksFields
          value={form.socialLinks}
          onChange={(v) => set('socialLinks', v)}
          keys={[...SOCIAL_LINK_KEYS]}
          errors={socialLinkErrors(form.socialLinks)}
        />
      </Surface>

      {vendorForm ? (
        <Surface style={styles.group}>
          <AppText variant="label" color={colors.textMuted}>
            Vendor
          </AppText>
          <View style={styles.switchRow}>
            <AppText style={styles.flex}>Vendor Mode on</AppText>
            <Switch value={vendorForm.isActive} onValueChange={(v) => setVendor('isActive', v)} trackColor={{ true: colors.primary, false: colors.border }} />
          </View>
          <TextField
            label="Business name"
            value={vendorForm.businessName}
            onChangeText={(v) => setVendor('businessName', v)}
            maxLength={60}
            error={vendorErrors.businessName}
          />
          <TextField
            label="Description"
            value={vendorForm.description}
            onChangeText={(v) => setVendor('description', v)}
            multiline
            maxLength={1000}
            error={vendorErrors.description}
          />
          <TextField
            label="Website"
            placeholder="https://…"
            autoCapitalize="none"
            keyboardType="url"
            value={vendorForm.website}
            onChangeText={(v) => setVendor('website', v)}
            maxLength={200}
            error={vendorErrors.website}
          />
          {user.vendor?.logoUrl ? (
            <View style={styles.switchRow}>
              <AppText style={styles.flex}>Remove logo</AppText>
              <Switch value={vendorForm.removeLogo} onValueChange={(v) => setVendor('removeLogo', v)} trackColor={{ true: colors.negative, false: colors.border }} />
            </View>
          ) : null}
          <SocialLinksFields
            value={vendorForm.socialLinks}
            onChange={(v) => setVendor('socialLinks', v)}
            keys={['instagram', 'x', 'tiktok', 'youtube', 'facebook']}
            errors={socialLinkErrors(vendorForm.socialLinks)}
          />
        </Surface>
      ) : null}

      <TextField
        label="Reason (saved in the audit log)"
        placeholder="Optional"
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={REASON_MAX}
      />
      {error ? <AppText color={colors.negative}>{errorMessage(error)}</AppText> : null}
      <Button title={changed ? 'Save changes' : 'No changes'} disabled={!changed || !valid} loading={saving} onPress={() => void save()} testID="admin-user-save" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  flex: { flex: 1 },
});
