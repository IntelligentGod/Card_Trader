import { useState } from 'react';
import type { SocialLinks } from '@card-trader/shared';
import { errorMessage } from '../../api/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Controls';
import { Screen } from '../../components/Screen';
import type { RootScreenProps } from '../../navigation/types';
import { useSession } from '../../stores/session';
import { colors } from '../../theme';
import { normalizeUsername, validateUsername } from '../auth/validation';
import { useUpdateMe } from './hooks';
import { cleanSocialLinks, socialLinkErrors, SocialLinksFields } from './SocialLinksFields';

export function EditProfileScreen({ navigation }: RootScreenProps<'EditProfile'>) {
  const user = useSession((s) => s.user);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(user?.socialLinks ?? {});
  const update = useUpdateMe();

  const nameValid = displayName.trim().length >= 2 && displayName.trim().length <= 40;
  const usernameError = validateUsername(username);
  const linkErrors = socialLinkErrors(socialLinks);
  const valid = nameValid && !usernameError && Object.keys(linkErrors).length === 0;

  return (
    <Screen>
      <TextField
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={40}
        error={nameValid ? null : 'Display name must be 2–40 characters'}
      />
      <TextField
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={21}
        hint="Unique. Letters, numbers and underscores."
        error={username ? usernameError : 'Username is required'}
      />
      <TextField label="Location" placeholder="City, state" value={location} onChangeText={setLocation} maxLength={80} />
      <TextField label="Bio" value={bio} onChangeText={setBio} multiline maxLength={280} hint={`${bio.length}/280`} />
      <SocialLinksFields
        value={socialLinks}
        onChange={setSocialLinks}
        keys={['instagram', 'x', 'tiktok', 'youtube', 'facebook', 'website']}
        errors={linkErrors}
      />
      {update.error ? <AppText color={colors.negative}>{errorMessage(update.error)}</AppText> : null}
      <Button
        title="Save"
        disabled={!valid}
        loading={update.isPending}
        onPress={() =>
          update.mutate(
            {
              displayName: displayName.trim(),
              username: normalizeUsername(username),
              bio: bio.trim() || null,
              location: location.trim() || null,
              socialLinks: cleanSocialLinks(socialLinks),
            },
            { onSuccess: () => navigation.goBack() },
          )
        }
      />
    </Screen>
  );
}
