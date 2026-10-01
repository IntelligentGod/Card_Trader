import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AdminUserDetail } from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Surface } from '../../components/Surface';
import type { RootStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { adminUserActions, hasAnyAction } from './adminForm';
import { formatTimestamp, signInMethodsText, USER_ROLE_LABELS, USER_STATUS_LABELS, yesNo } from './adminText';
import { useAdminBlock, useAdminChangeRole } from './hooks';
import { ReasonModal } from './ReasonModal';

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.row}>
      <AppText color={colors.textMuted}>{label}</AppText>
      <AppText variant="bodyStrong" color={tone ?? colors.text} style={styles.value} selectable>
        {value}
      </AppText>
    </View>
  );
}

/** Sign-in and security facts about the account. */
export function AccountSection({ user }: { user: AdminUserDetail }) {
  const blocked = user.status === 'BLOCKED';
  return (
    <Surface style={styles.group} testID="admin-account">
      <AppText variant="label" color={colors.textMuted}>
        Account
      </AppText>
      <Row label="Name" value={user.displayName} />
      <Row label="Email" value={user.email} />
      <Row label="Role" value={USER_ROLE_LABELS[user.role]} />
      <Row label="Status" value={USER_STATUS_LABELS[user.status]} tone={blocked ? colors.negative : undefined} />
      {blocked && user.blockedAt ? <Row label="Blocked since" value={formatTimestamp(user.blockedAt)} /> : null}
      {blocked && user.blockReason ? <Row label="Block reason" value={user.blockReason} /> : null}
      <Row label="2FA enabled" value={yesNo(user.twoFactorEnabled)} />
      <Row label="Sign-in methods" value={signInMethodsText(user.authProviders)} />
      {user.mustChangePassword ? <Row label="Password" value="Must change at next sign-in" tone={colors.warning} /> : null}
      <Row label="Created" value={formatTimestamp(user.createdAt)} />
      <Row label="Last login" value={user.lastLoginAt ? formatTimestamp(user.lastLoginAt) : 'Never'} />
    </Surface>
  );
}

type Dialog = 'role' | 'block' | 'unblock' | null;

/** Only the actions the server says this admin may take (`permissions`); the API enforces the same. */
export function AccountActions({ user }: { user: AdminUserDetail }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const actions = adminUserActions(user);
  const [dialog, setDialog] = useState<Dialog>(null);
  const changeRole = useAdminChangeRole(user.publicId);
  const block = useAdminBlock(user.publicId, true);
  const unblock = useAdminBlock(user.publicId, false);

  if (!hasAnyAction(actions)) return null;

  const close = () => {
    setDialog(null);
    changeRole.reset();
    block.reset();
    unblock.reset();
  };
  const done = { onSuccess: () => setDialog(null) };
  const makeAdmin = actions.changeRoleTo === 'ADMIN';

  return (
    <Surface style={styles.group}>
      <AppText variant="label" color={colors.textMuted}>
        Actions
      </AppText>
      {actions.edit ? (
        <Button
          title="Edit profile"
          icon="create-outline"
          variant="secondary"
          onPress={() => navigation.navigate('AdminEditUser', { publicId: user.publicId })}
          testID="action-edit"
        />
      ) : null}
      {actions.changeRoleTo ? (
        <Button
          title={makeAdmin ? 'Make admin' : 'Remove admin role'}
          icon="shield-outline"
          variant="secondary"
          onPress={() => setDialog('role')}
          testID="action-role"
        />
      ) : null}
      {actions.resetPassword ? (
        <Button
          title="Reset password"
          icon="key-outline"
          variant="secondary"
          onPress={() => navigation.navigate('AdminResetPassword', { publicId: user.publicId })}
          testID="action-reset"
        />
      ) : null}
      {actions.block ? (
        <Button title="Block user" icon="ban-outline" variant="danger" onPress={() => setDialog('block')} testID="action-block" />
      ) : null}
      {actions.unblock ? (
        <Button title="Unblock user" icon="lock-open-outline" variant="secondary" onPress={() => setDialog('unblock')} testID="action-unblock" />
      ) : null}

      <ReasonModal
        visible={dialog === 'role'}
        title={makeAdmin ? `Make ${user.displayName} an admin?` : `Remove ${user.displayName}’s admin role?`}
        message={
          makeAdmin
            ? 'Admins can view every account and manage regular users (edit, reset password, block).'
            : 'They lose access to the admin console and become a regular user.'
        }
        confirmTitle={makeAdmin ? 'Make admin' : 'Remove role'}
        destructive={!makeAdmin}
        loading={changeRole.isPending}
        error={changeRole.error}
        onClose={close}
        onConfirm={(reason) => actions.changeRoleTo && changeRole.mutate({ role: actions.changeRoleTo, reason }, done)}
      />
      <ReasonModal
        visible={dialog === 'block'}
        title="Are you sure you want to block this user?"
        message={`${user.displayName} is signed out on every device at once and can’t sign in until unblocked.`}
        confirmTitle="Block user"
        destructive
        loading={block.isPending}
        error={block.error}
        onClose={close}
        onConfirm={(reason) => block.mutate({ reason }, done)}
      />
      <ReasonModal
        visible={dialog === 'unblock'}
        title={`Unblock ${user.displayName}?`}
        message="They can sign in and use the app again."
        confirmTitle="Unblock"
        loading={unblock.isPending}
        error={unblock.error}
        onClose={close}
        onConfirm={(reason) => unblock.mutate({ reason }, done)}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  value: { flexShrink: 1, textAlign: 'right' },
});
