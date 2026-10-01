import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { SectionHeader } from '../../../components/Controls';
import { Avatar } from '../../../components/Profile';
import { Screen } from '../../../components/Screen';
import { SkeletonBlock } from '../../../components/Skeleton';
import { SocialLinksRow } from '../../../components/Social';
import { ErrorState } from '../../../components/States';
import { Surface } from '../../../components/Surface';
import type { RootScreenProps } from '../../../navigation/types';
import { colors, radius, spacing } from '../../../theme';
import { formatEventDates } from '../../../utils/format';
import { useMe } from '../../profile/hooks';
import { useEvent, useEventMutation } from '../hooks';

export function EventDetailsScreen({ route, navigation }: RootScreenProps<'EventDetails'>) {
  const { eventId } = route.params;
  const query = useEvent(eventId);
  const me = useMe();
  const save = useEventMutation((saved: boolean) => api.events.setSaved(eventId, saved));
  const apply = useEventMutation(() => api.events.apply(eventId, {}));
  const withdraw = useEventMutation(() => api.events.withdraw(eventId));
  const publish = useEventMutation(() => api.events.publish(eventId));
  const cancel = useEventMutation(() => api.events.cancel(eventId));
  const mutationError = save.error ?? apply.error ?? withdraw.error ?? publish.error ?? cancel.error;

  useEffect(() => {
    if (query.data) navigation.setOptions({ title: query.data.title });
  }, [navigation, query.data]);

  if (query.isPending) {
    return (
      <Screen>
        <SkeletonBlock height={220} />
      </Screen>
    );
  }
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const event = query.data;
  const published = event.status === 'PUBLISHED';
  const application = event.myApplication;
  const vendorModeOn = me.data?.vendor?.isActive === true;

  const joinAsVendor = () => {
    if (!vendorModeOn) {
      Alert.alert('Vendor Mode needed', 'Switch your profile to Vendor Mode to join shows as a vendor. Your inventory and reviews stay the same.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Set up Vendor Mode', onPress: () => navigation.navigate('VendorProfileEdit') },
      ]);
      return;
    }
    apply.mutate(undefined);
  };

  const confirm = (title: string, message: string, action: () => void, destructive = false) =>
    Alert.alert(title, message, [
      { text: 'Keep', style: 'cancel' },
      { text: title, style: destructive ? 'destructive' : 'default', onPress: action },
    ]);

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Surface style={styles.gap}>
        {event.status !== 'PUBLISHED' ? (
          <AppText variant="label" color={event.status === 'CANCELLED' ? colors.negative : colors.warning}>
            {event.status === 'CANCELLED' ? 'Cancelled' : 'Draft — only you can see this'}
          </AppText>
        ) : null}
        <AppText variant="title">{event.title}</AppText>
        <InfoRow icon="time-outline" text={formatEventDates(event.startsAt, event.endsAt)} />
        <InfoRow
          icon="location-outline"
          text={[event.venueName, event.address, [event.city, event.region].filter(Boolean).join(', ')].filter(Boolean).join('\n')}
        />
        {event.admission ? <InfoRow icon="ticket-outline" text={event.admission} /> : null}
        <Pressable onPress={() => navigation.navigate('OtherUserProfile', { publicId: event.organizer.publicId })}>
          <InfoRow icon="person-outline" text={`Organized by ${event.organizerDisplayName}`} link />
        </Pressable>
        <SocialLinksRow links={event.socialLinks} website={event.website} />
        <View style={styles.statsRow}>
          <Stat value={event.approvedVendorCount} label={event.approvedVendorCount === 1 ? 'vendor' : 'vendors'} />
          <Stat value={event.inventoryCount} label="cards listed" />
        </View>
      </Surface>

      {published ? (
        <View style={styles.row}>
          <Button
            title="Search this event"
            icon="search"
            style={styles.flex}
            onPress={() => navigation.navigate('EventSearch', { eventId })}
            disabled={event.inventoryCount === 0}
          />
          <Button
            title={event.isSaved ? 'Interested' : 'Interested?'}
            icon={event.isSaved ? 'bookmark' : 'bookmark-outline'}
            variant="secondary"
            compact
            loading={save.isPending}
            onPress={() => save.mutate(!event.isSaved)}
          />
        </View>
      ) : null}

      {event.description ? (
        <Surface>
          <SectionHeader title="About this show" />
          <AppText>{event.description}</AppText>
        </Surface>
      ) : null}

      {event.isOrganizer ? (
        <Surface style={styles.gap}>
          <SectionHeader title="Organizer tools" />
          <View style={styles.row}>
            <Button title="Edit" icon="create-outline" variant="secondary" style={styles.flex} onPress={() => navigation.navigate('EventEdit', { eventId })} />
            {event.status === 'DRAFT' ? (
              <Button title="Publish" icon="megaphone-outline" style={styles.flex} loading={publish.isPending} onPress={() => publish.mutate(undefined)} />
            ) : null}
          </View>
          {published ? (
            <Button
              title={event.pendingApplicationCount > 0 ? `Vendor applications (${event.pendingApplicationCount} pending)` : 'Manage vendors & tables'}
              icon="storefront-outline"
              variant="secondary"
              onPress={() => navigation.navigate('EventVendors', { eventId })}
            />
          ) : null}
          {event.status !== 'CANCELLED' ? (
            <Button
              title="Cancel event"
              variant="ghost"
              loading={cancel.isPending}
              onPress={() =>
                confirm('Cancel event', 'Vendors and interested attendees will be notified. This cannot be undone.', () => cancel.mutate(undefined), true)
              }
            />
          ) : null}
        </Surface>
      ) : null}

      {published ? (
        <Surface style={styles.gap}>
          <SectionHeader title="Selling or trading here?" />
          {!application || application.status === 'WITHDRAWN' ? (
            <>
              <AppText color={colors.textMuted}>
                Vendors get a table number and choose which of their cards they are bringing. Attendees can search them before the show.
              </AppText>
              <Button title="Join as Vendor" icon="storefront" loading={apply.isPending} onPress={joinAsVendor} />
            </>
          ) : application.status === 'PENDING' ? (
            <>
              <AppText>Your application is waiting for the organizer.</AppText>
              <Button title="Withdraw application" variant="ghost" loading={withdraw.isPending} onPress={() => withdraw.mutate(undefined)} />
            </>
          ) : application.status === 'APPROVED' ? (
            <>
              <View style={styles.tableBadge}>
                <Ionicons name="storefront" size={18} color={colors.positive} />
                <AppText variant="bodyStrong" color={colors.positive}>
                  You are approved · Table {application.tableNumber}
                </AppText>
              </View>
              <AppText color={colors.textMuted}>Bringing {application.inventoryCount} cards to this event.</AppText>
              <Button title="Choose cards to bring" icon="albums-outline" onPress={() => navigation.navigate('EventInventory', { eventId })} />
              <Button
                title="Withdraw from event"
                variant="ghost"
                loading={withdraw.isPending}
                onPress={() => confirm('Withdraw', 'Your table and event inventory will be released.', () => withdraw.mutate(undefined), true)}
              />
            </>
          ) : (
            <AppText color={colors.textMuted}>The organizer declined your application for this show.</AppText>
          )}
        </Surface>
      ) : null}

      {mutationError ? <AppText color={colors.negative}>{errorMessage(mutationError)}</AppText> : null}

      {event.vendors.length > 0 ? (
        <View>
          <SectionHeader title="Vendors" />
          {event.vendors.map((vendor) => (
            <Pressable
              key={vendor.id}
              style={({ pressed }) => [styles.vendorRow, pressed && styles.pressed]}
              onPress={() => navigation.navigate('OtherUserProfile', { publicId: vendor.vendor.publicId, eventId })}
            >
              <View style={styles.table}>
                <AppText variant="caption" color={colors.textMuted}>
                  Table
                </AppText>
                <AppText variant="heading" color={colors.primary}>
                  {vendor.tableNumber ?? '—'}
                </AppText>
              </View>
              <Avatar url={vendor.vendorInfo?.logoUrl ?? vendor.vendor.avatarUrl} name={vendor.vendorInfo?.businessName ?? vendor.vendor.displayName} size={40} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {vendor.vendorInfo?.businessName ?? vendor.vendor.displayName}
                </AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  @{vendor.vendor.username} · {vendor.inventoryCount} cards
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function InfoRow({ icon, text, link = false }: { icon: keyof typeof Ionicons.glyphMap; text: string; link?: boolean }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={18} color={link ? colors.primary : colors.textMuted} />
      <AppText color={link ? colors.primary : colors.text} style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="heading">{value}</AppText>
      <AppText variant="caption" color={colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
  info: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  statsRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xs },
  stat: { alignItems: 'flex-start' },
  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.positiveSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  table: { width: 44, alignItems: 'center' },
});
