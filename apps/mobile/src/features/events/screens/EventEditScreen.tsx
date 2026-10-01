import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { CreateEventRequest, EventDetail } from '@card-trader/shared';
import { errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { queryKeys } from '../../../api/queryKeys';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/Controls';
import { SkeletonBlock } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/States';
import type { RootScreenProps } from '../../../navigation/types';
import { colors, spacing } from '../../../theme';
import { useEvent } from '../hooks';

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export interface EventFormState {
  title: string;
  date: string;
  startTime: string;
  endDate: string;
  endTime: string;
  venueName: string;
  address: string;
  city: string;
  region: string;
  admission: string;
  organizerName: string;
  website: string;
  instagram: string;
  facebook: string;
  description: string;
}

export type EventFormErrors = Partial<Record<keyof EventFormState, string>>;

/** Local date + time (device time zone) → ISO instant. Returns null for invalid input. */
export function toIsoInstant(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim()) || !/^\d{1,2}:\d{2}$/.test(time.trim())) return null;
  const [h, m] = time.trim().split(':').map(Number);
  if (h === undefined || m === undefined || h > 23 || m > 59) return null;
  const value = new Date(`${date.trim()}T${pad(h)}:${pad(m)}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

/** Pure validation, exported for tests. The API re-validates everything. */
export function validateEventForm(form: EventFormState): { errors: EventFormErrors; values?: CreateEventRequest } {
  const errors: EventFormErrors = {};
  if (form.title.trim().length < 3) errors.title = 'Give the show a name (3+ characters)';
  if (form.venueName.trim().length < 2) errors.venueName = 'Where is it?';
  if (form.city.trim().length < 2) errors.city = 'City is required';
  const startsAt = toIsoInstant(form.date, form.startTime);
  const endsAt = toIsoInstant(form.endDate.trim() || form.date, form.endTime);
  if (!startsAt) errors.date = 'Use YYYY-MM-DD and a start time like 09:00';
  if (!endsAt) errors.endTime = 'Use an end time like 17:00';
  if (startsAt && endsAt && endsAt <= startsAt) errors.endTime = 'The show must end after it starts';
  if (form.website.trim() && !/^https?:\/\/\S+$/i.test(form.website.trim())) errors.website = 'Use a full link, e.g. https://…';
  if (Object.keys(errors).length > 0 || !startsAt || !endsAt) return { errors };

  const socialLinks: Record<string, string> = {};
  if (form.instagram.trim()) socialLinks.instagram = form.instagram.trim();
  if (form.facebook.trim()) socialLinks.facebook = form.facebook.trim();
  return {
    errors,
    values: {
      title: form.title.trim(),
      startsAt,
      endsAt,
      venueName: form.venueName.trim(),
      address: form.address.trim() || null,
      city: form.city.trim(),
      region: form.region.trim() || null,
      admission: form.admission.trim() || null,
      organizerName: form.organizerName.trim() || null,
      website: form.website.trim() || null,
      description: form.description.trim() || null,
      socialLinks,
    },
  };
}

function initialState(event?: EventDetail): EventFormState {
  const start = event ? new Date(event.startsAt) : null;
  const end = event ? new Date(event.endsAt) : null;
  return {
    title: event?.title ?? '',
    date: start ? localDate(start) : '',
    startTime: start ? localTime(start) : '09:00',
    endDate: start && end && localDate(start) !== localDate(end) ? localDate(end) : '',
    endTime: end ? localTime(end) : '17:00',
    venueName: event?.venueName ?? '',
    address: event?.address ?? '',
    city: event?.city ?? '',
    region: event?.region ?? '',
    admission: event?.admission ?? '',
    organizerName: event && event.organizerDisplayName !== event.organizer.displayName ? event.organizerDisplayName : '',
    website: event?.website ?? '',
    instagram: event?.socialLinks.instagram ?? '',
    facebook: event?.socialLinks.facebook ?? '',
    description: event?.description ?? '',
  };
}

export function EventEditScreen({ route, navigation }: RootScreenProps<'EventEdit'>) {
  const eventId = route.params.eventId;
  const existing = useEvent(eventId ?? '');
  if (eventId && existing.isPending) {
    return (
      <View style={styles.container}>
        <SkeletonBlock height={320} />
      </View>
    );
  }
  if (eventId && existing.error) return <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />;
  return (
    <EventForm
      event={eventId ? existing.data : undefined}
      onSaved={(event) => navigation.replace('EventDetails', { eventId: event.id })}
    />
  );
}

function EventForm({ event, onSaved }: { event?: EventDetail; onSaved: (event: EventDetail) => void }) {
  const client = useQueryClient();
  const [form, setForm] = useState<EventFormState>(() => initialState(event));
  const [errors, setErrors] = useState<EventFormErrors>({});
  const save = useMutation({
    mutationFn: (values: CreateEventRequest) => (event ? api.events.update(event.id, values) : api.events.create(values)),
    onSuccess: (saved) => {
      client.setQueryData(queryKeys.event(saved.id), saved);
      void client.invalidateQueries({ queryKey: ['events', 'list'] });
      onSaved(saved);
    },
  });

  const field = (key: keyof EventFormState) => ({
    value: form[key],
    onChangeText: (text: string) => setForm((current) => ({ ...current, [key]: text })),
    error: errors[key],
  });

  const submit = () => {
    const result = validateEventForm(form);
    setErrors(result.errors);
    if (result.values) save.mutate(result.values);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {!event ? (
          <AppText color={colors.textMuted}>
            New events start as a draft. Publish when you are ready — then vendors can apply and attendees can find it.
          </AppText>
        ) : null}
        <TextField label="Event name" placeholder="Austin Card Show" maxLength={120} {...field('title')} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Date" placeholder="YYYY-MM-DD" {...field('date')} />
          </View>
          <View style={styles.flex}>
            <TextField label="Starts" placeholder="09:00" {...field('startTime')} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="End date (multi-day)" placeholder="same day" {...field('endDate')} />
          </View>
          <View style={styles.flex}>
            <TextField label="Ends" placeholder="17:00" {...field('endTime')} />
          </View>
        </View>
        <TextField label="Venue" placeholder="Palmer Events Center" maxLength={120} {...field('venueName')} />
        <TextField label="Address" placeholder="900 Barton Springs Rd" maxLength={200} {...field('address')} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="City" maxLength={80} {...field('city')} />
          </View>
          <View style={styles.flex}>
            <TextField label="State / region" maxLength={80} {...field('region')} />
          </View>
        </View>
        <TextField label="Admission" placeholder="$10 · Kids under 12 free" maxLength={120} {...field('admission')} />
        <TextField label="Organizer name (optional)" placeholder="Shown instead of your name" maxLength={80} {...field('organizerName')} />
        <TextField label="Website" placeholder="https://…" autoCapitalize="none" keyboardType="url" {...field('website')} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Instagram" placeholder="@handle" autoCapitalize="none" {...field('instagram')} />
          </View>
          <View style={styles.flex}>
            <TextField label="Facebook" placeholder="page" autoCapitalize="none" {...field('facebook')} />
          </View>
        </View>
        <TextField label="Event information" multiline maxLength={4000} {...field('description')} />
        {save.error ? <AppText color={colors.negative}>{errorMessage(save.error)}</AppText> : null}
        <Button title={event ? 'Save changes' : 'Create draft event'} onPress={submit} loading={save.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', gap: spacing.md },
});
