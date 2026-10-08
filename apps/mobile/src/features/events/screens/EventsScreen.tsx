import { Ionicons } from '@expo/vector-icons';
import { useDeferredValue, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EventListScope } from '@card-trader/shared';
import { AppText } from '../../../components/AppText';
import { Segmented, TextField } from '../../../components/Controls';
import { EventCard } from '../../../components/EventCard';
import { SkeletonList } from '../../../components/Skeleton';
import { EmptyState, ErrorState } from '../../../components/States';
import { ScreenBackground } from '../../../components/ScreenBackground';
import type { TabScreenProps } from '../../../navigation/types';
import { makeStyles, radius, spacing, useTheme } from '../../../theme';
import { useEventList } from '../hooks';

const SCOPES: { value: EventListScope; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'mine', label: 'My shows' },
  { value: 'organizing', label: 'Organizing' },
];

const EMPTY: Record<EventListScope, { title: string; message: string }> = {
  upcoming: { title: 'No upcoming shows', message: 'When organizers publish card shows, they appear here.' },
  mine: { title: 'No saved shows', message: 'Tap “Interested” on a show, or join one as a vendor, to see it here.' },
  organizing: { title: 'You are not organizing a show', message: 'Create an event to publish it and accept vendors.' },
};

export function EventsScreen({ navigation }: TabScreenProps<'Events'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [scope, setScope] = useState<EventListScope>('upcoming');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const list = useEventList({ scope, q: q || undefined });
  const events = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScreenBackground />
      <View style={styles.header}>
        <AppText variant="title">Events</AppText>
        <TextField placeholder="Search shows, venues or cities" value={search} onChangeText={setSearch} returnKeyType="search" />
        <Segmented options={SCOPES} value={scope} onChange={setScope} />
      </View>

      {list.isPending ? (
        <SkeletonList rows={4} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => <EventCard event={item} onPress={() => navigation.navigate('EventDetails', { eventId: item.id })} />}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} /> : null}
          ListEmptyComponent={
            q ? (
              <EmptyState icon="search" title="No matching shows" message="Try another name or city." />
            ) : (
              <EmptyState
                icon="calendar-outline"
                title={EMPTY[scope].title}
                message={EMPTY[scope].message}
                actionTitle={scope === 'organizing' ? 'Create an event' : undefined}
                onAction={scope === 'organizing' ? () => navigation.navigate('EventEdit', {}) : undefined}
              />
            )
          }
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('EventEdit', {})}
        accessibilityRole="button"
        accessibilityLabel="Create an event"
      >
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  list: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100, flexGrow: 1 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
}));
