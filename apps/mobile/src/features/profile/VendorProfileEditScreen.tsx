import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import type { SocialLinks } from '@card-trader/shared';
import { errorMessage } from '../../api/client';
import { api } from '../../api/endpoints';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Controls';
import { Avatar } from '../../components/Profile';
import { Screen } from '../../components/Screen';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { useSession } from '../../stores/session';
import { spacing, useTheme } from '../../theme';
import { useUpsertVendor } from './hooks';
import { cleanSocialLinks, socialLinkErrors, SocialLinksFields } from './SocialLinksFields';

/**
 * Vendor Mode sits on top of the same account: inventory, reviews and trade
 * history are unchanged. Turning it off hides the business details from others.
 */
export function VendorProfileEditScreen({ navigation }: RootScreenProps<'VendorProfileEdit'>) {
  const { colors } = useTheme();
  const vendor = useSession((s) => s.user?.vendor ?? null);
  const [isActive, setIsActive] = useState(vendor?.isActive ?? true);
  const [businessName, setBusinessName] = useState(vendor?.businessName ?? '');
  const [description, setDescription] = useState(vendor?.description ?? '');
  const [website, setWebsite] = useState(vendor?.website ?? '');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(vendor?.socialLinks ?? {});
  const [logo, setLogo] = useState<{ key: string | null; url: string | null }>({ key: vendor?.logoKey ?? null, url: vendor?.logoUrl ?? null });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const save = useUpsertVendor();

  const nameValid = businessName.trim().length >= 2 && businessName.trim().length <= 60;
  const websiteError = website.trim() && !/^https?:\/\/\S+$/i.test(website.trim()) ? 'Use a full link, e.g. https://…' : undefined;
  const linkErrors = socialLinkErrors(socialLinks);
  const valid = nameValid && !websiteError && Object.keys(linkErrors).length === 0;

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await api.uploads.image('VENDOR_LOGO', { uri: asset.uri, name: asset.fileName ?? 'logo.jpg', type: asset.mimeType ?? 'image/jpeg' });
      setLogo({ key: uploaded.key, url: uploaded.url });
    } catch (error) {
      setUploadError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen>
      <Surface style={styles.toggle}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Vendor Mode</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            Show your business on your profile, join card shows as a vendor and list cards for your table. Your inventory,
            reviews and trade history stay the same.
          </AppText>
        </View>
        <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.primary, false: colors.border }} />
      </Surface>

      <View style={styles.logoRow}>
        <Pressable onPress={() => void pickLogo()} disabled={uploading} accessibilityLabel="Choose logo">
          <Avatar url={logo.url} name={businessName || 'Shop'} size={72} />
        </Pressable>
        <View style={styles.flex}>
          <Button title={uploading ? 'Uploading…' : logo.url ? 'Change logo' : 'Add logo'} variant="secondary" compact onPress={() => void pickLogo()} disabled={uploading} />
          {logo.url ? <Button title="Remove logo" variant="ghost" compact onPress={() => setLogo({ key: null, url: null })} /> : null}
        </View>
      </View>
      {uploadError ? <AppText color={colors.negative}>{uploadError}</AppText> : null}

      <TextField
        label="Business name"
        value={businessName}
        onChangeText={setBusinessName}
        maxLength={60}
        error={businessName && !nameValid ? 'Business name must be 2–60 characters' : null}
      />
      <TextField label="Description" value={description} onChangeText={setDescription} multiline maxLength={1000} hint="What you sell and trade" />
      <TextField
        label="Website"
        placeholder="https://…"
        autoCapitalize="none"
        keyboardType="url"
        value={website}
        onChangeText={setWebsite}
        error={websiteError}
      />
      <SocialLinksFields value={socialLinks} onChange={setSocialLinks} keys={['instagram', 'x', 'tiktok', 'youtube', 'facebook']} errors={linkErrors} />

      {save.error ? <AppText color={colors.negative}>{errorMessage(save.error)}</AppText> : null}
      <Button
        title={isActive ? 'Save vendor profile' : 'Save (Vendor Mode off)'}
        disabled={!valid || uploading}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            {
              isActive,
              businessName: businessName.trim(),
              logoKey: logo.key,
              description: description.trim() || null,
              website: website.trim() || null,
              socialLinks: cleanSocialLinks(socialLinks),
            },
            { onSuccess: () => navigation.goBack() },
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xs },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
