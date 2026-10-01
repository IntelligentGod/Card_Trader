import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  CONDITION_LABELS,
  formatCents,
  GRADING_COMPANIES,
  isForSale,
  isValidGrade,
  LISTING_STATUS_LABELS,
  LISTING_STATUSES,
  parseDollarsToCents,
  type CardCondition,
  type CreateCollectionItemRequest,
  type GradingCompany,
  type ListingStatus,
} from '@card-trader/shared';
import { errorMessage } from '../../../api/client';
import { api } from '../../../api/endpoints';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { ChipRow, Segmented, TextField } from '../../../components/Controls';
import { mediaUrl } from '../../../config';
import { colors, radius, spacing } from '../../../theme';

export type ItemFormValues = Omit<CreateCollectionItemRequest, 'cardId'>;

interface Props {
  initial?: Partial<ItemFormValues> & { imageUrl?: string | null; backImageUrl?: string | null };
  submitLabel: string;
  submitting: boolean;
  error: unknown;
  onSubmit: (values: ItemFormValues) => void;
}

type Kind = 'RAW' | 'GRADED';

/** User-assessed conditions for raw cards, best first. RAW = not assessed. */
export const RAW_CONDITION_OPTIONS: CardCondition[] = ['MINT', 'NEAR_MINT', 'EXCELLENT', 'VERY_GOOD', 'GOOD', 'PLAYED', 'POOR', 'RAW'];

const STATUS_HINTS: Record<ListingStatus, string> = {
  PERSONAL: 'Only you can see this card.',
  FOR_TRADE: 'Shown on your profile and at shows you vend at. Others can add it to a trade.',
  FOR_SALE: 'Shown with your asking price. Buyers start a trade and pay cash.',
  TRADE_AND_SALE: 'Open to trades and cash offers.',
};

export interface FormErrors {
  grade?: string;
  quantity?: string;
  price?: string;
  asking?: string;
  date?: string;
}

/** Pure validation, exported for tests. The API re-validates everything. */
export function validateItemForm(input: {
  condition: CardCondition;
  gradingCompany: GradingCompany | undefined;
  grade: string;
  quantity: string;
  price: string;
  date: string;
  listingStatus?: ListingStatus;
  askingPrice?: string;
}): {
  errors: FormErrors;
  values?: Omit<ItemFormValues, 'notes' | 'customImageKey' | 'backImageKey' | 'certNumber'>;
} {
  const errors: FormErrors = {};
  const graded = input.condition === 'GRADED';
  const grade = Number(input.grade);
  if (graded && (!input.gradingCompany || !isValidGrade(grade))) errors.grade = 'Choose a company and a grade from 1 to 10 (e.g. 9.5)';
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) errors.quantity = 'Quantity must be 1–999';
  if (graded && quantity !== 1) errors.quantity = 'Graded slabs are tracked one per entry';
  const priceCents = input.price.trim() ? parseDollarsToCents(input.price) : null;
  if (input.price.trim() && priceCents === null) errors.price = 'Enter an amount like 12.50';
  const listingStatus = input.listingStatus ?? 'PERSONAL';
  const askingText = isForSale(listingStatus) ? (input.askingPrice ?? '').trim() : '';
  const askingPriceCents = askingText ? parseDollarsToCents(askingText) : null;
  if (askingText && askingPriceCents === null) errors.asking = 'Enter an amount like 45 or 45.00';
  if (input.date.trim() && (!/^\d{4}-\d{2}-\d{2}$/.test(input.date.trim()) || Number.isNaN(Date.parse(input.date.trim())))) {
    errors.date = 'Use YYYY-MM-DD';
  }
  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    values: {
      condition: input.condition,
      gradingCompany: graded ? input.gradingCompany : null,
      grade: graded ? grade : null,
      quantity,
      purchasePriceCents: priceCents,
      purchaseDate: input.date.trim() || null,
      listingStatus,
      askingPriceCents,
    },
  };
}

function PhotoSlot({
  label,
  preview,
  uploading,
  onPick,
  onRemove,
}: {
  label: string;
  preview: string | null;
  uploading: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.photoColumn}>
      <Pressable style={styles.photo} onPress={onPick} disabled={uploading} accessibilityLabel={`Choose ${label.toLowerCase()} photo`}>
        {preview ? (
          <Image source={{ uri: mediaUrl(preview) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <AppText variant="caption" color={colors.primary} align="center">
            {uploading ? 'Uploading…' : `+ ${label}`}
          </AppText>
        )}
      </Pressable>
      {preview ? (
        <Pressable onPress={onRemove} hitSlop={8}>
          <AppText variant="caption" color={colors.negative} align="center">
            Remove
          </AppText>
        </Pressable>
      ) : (
        <AppText variant="caption" color={colors.textMuted} align="center">
          {label}
        </AppText>
      )}
    </View>
  );
}

export function CollectionItemForm({ initial, submitLabel, submitting, error, onSubmit }: Props) {
  const initialCondition = initial?.condition ?? 'NEAR_MINT';
  const [kind, setKind] = useState<Kind>(initialCondition === 'GRADED' ? 'GRADED' : 'RAW');
  const [rawCondition, setRawCondition] = useState<CardCondition>(initialCondition === 'GRADED' ? 'NEAR_MINT' : initialCondition);
  const [gradingCompany, setGradingCompany] = useState<GradingCompany | undefined>(initial?.gradingCompany ?? undefined);
  const [grade, setGrade] = useState(initial?.grade ? String(initial.grade) : '');
  const [certNumber, setCertNumber] = useState(initial?.certNumber ?? '');
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [price, setPrice] = useState(initial?.purchasePriceCents != null ? (initial.purchasePriceCents / 100).toFixed(2) : '');
  const [date, setDate] = useState(initial?.purchaseDate ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [listingStatus, setListingStatus] = useState<ListingStatus>(initial?.listingStatus ?? 'PERSONAL');
  const [askingPrice, setAskingPrice] = useState(
    initial?.askingPriceCents != null ? (initial.askingPriceCents / 100).toFixed(2) : '',
  );
  const [photos, setPhotos] = useState({
    front: { key: initial?.customImageKey ?? null, preview: initial?.customImageKey ? (initial.imageUrl ?? null) : null },
    back: { key: initial?.backImageKey ?? null, preview: initial?.backImageUrl ?? null },
  });
  const [uploading, setUploading] = useState<'front' | 'back' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const condition: CardCondition = kind === 'GRADED' ? 'GRADED' : rawCondition;

  const pickImage = async (side: 'front' | 'back') => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [63, 88], quality: 0.8 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setUploading(side);
    setUploadError(null);
    try {
      const uploaded = await api.uploads.image('ITEM_IMAGE', {
        uri: asset.uri,
        name: asset.fileName ?? `${side}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      });
      setPhotos((current) => ({ ...current, [side]: { key: uploaded.key, preview: uploaded.url } }));
    } catch (e) {
      setUploadError(errorMessage(e));
    } finally {
      setUploading(null);
    }
  };

  const submit = () => {
    const result = validateItemForm({ condition, gradingCompany, grade, quantity, price, date, listingStatus, askingPrice });
    setErrors(result.errors);
    if (!result.values) return;
    onSubmit({
      ...result.values,
      certNumber: condition === 'GRADED' ? certNumber.trim() || null : null,
      notes: notes.trim() || null,
      customImageKey: photos.front.key,
      backImageKey: photos.back.key,
    });
  };

  const priceCents = price.trim() ? parseDollarsToCents(price) : null;
  const askingCents = askingPrice.trim() ? parseDollarsToCents(askingPrice) : null;

  return (
    <View style={styles.form}>
      <View style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Card type
        </AppText>
        <Segmented
          options={[
            { value: 'RAW', label: 'Raw' },
            { value: 'GRADED', label: 'Graded' },
          ]}
          value={kind}
          onChange={(next: Kind) => {
            setKind(next);
            if (next === 'GRADED') setQuantity('1');
          }}
        />
      </View>

      {kind === 'RAW' ? (
        <View style={styles.group}>
          <AppText variant="label" color={colors.textMuted}>
            Condition (your assessment)
          </AppText>
          <ChipRow
            options={RAW_CONDITION_OPTIONS.map((c) => ({ value: c, label: c === 'RAW' ? 'Not assessed' : CONDITION_LABELS[c] }))}
            value={rawCondition}
            onChange={(value) => setRawCondition(value ?? 'NEAR_MINT')}
          />
        </View>
      ) : (
        <View style={styles.group}>
          <AppText variant="label" color={colors.textMuted}>
            Grading company
          </AppText>
          <ChipRow options={GRADING_COMPANIES.map((c) => ({ value: c, label: c }))} value={gradingCompany} onChange={setGradingCompany} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label="Grade" placeholder="10" keyboardType="decimal-pad" value={grade} onChangeText={setGrade} error={errors.grade} />
            </View>
            <View style={styles.flex}>
              <TextField label="Cert number" placeholder="On the slab label" value={certNumber} onChangeText={setCertNumber} maxLength={40} />
            </View>
          </View>
        </View>
      )}

      <View style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Trade / sale status
        </AppText>
        <ChipRow
          options={LISTING_STATUSES.map((s) => ({ value: s, label: LISTING_STATUS_LABELS[s] }))}
          value={listingStatus}
          onChange={(value) => setListingStatus(value ?? 'PERSONAL')}
        />
        <AppText variant="caption" color={colors.textMuted}>
          {STATUS_HINTS[listingStatus]}
        </AppText>
        {isForSale(listingStatus) ? (
          <TextField
            label="Asking price per card (optional)"
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={askingPrice}
            onChangeText={setAskingPrice}
            error={errors.asking}
            hint={askingCents !== null ? formatCents(askingCents) : 'Leave empty to show the estimated value'}
          />
        ) : null}
      </View>

      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Quantity"
            keyboardType="number-pad"
            value={quantity}
            onChangeText={setQuantity}
            editable={kind !== 'GRADED'}
            error={errors.quantity}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="Paid (USD)"
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
            error={errors.price}
            hint={priceCents !== null ? formatCents(priceCents) : undefined}
          />
        </View>
      </View>

      <TextField label="Purchase date (optional)" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} error={errors.date} />
      <TextField label="Notes (private)" value={notes} onChangeText={setNotes} multiline maxLength={1000} />

      <View style={styles.group}>
        <AppText variant="label" color={colors.textMuted}>
          Photos (optional)
        </AppText>
        <View style={styles.photoRow}>
          {(['front', 'back'] as const).map((side) => (
            <PhotoSlot
              key={side}
              label={side === 'front' ? 'Front' : 'Back'}
              preview={photos[side].preview}
              uploading={uploading === side}
              onPick={() => void pickImage(side)}
              onRemove={() => setPhotos((current) => ({ ...current, [side]: { key: null, preview: null } }))}
            />
          ))}
        </View>
        {uploadError ? <AppText color={colors.negative}>{uploadError}</AppText> : null}
      </View>

      {error ? <AppText color={colors.negative}>{errorMessage(error)}</AppText> : null}
      <Button title={submitLabel} onPress={submit} loading={submitting} disabled={uploading !== null} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  photoRow: { flexDirection: 'row', gap: spacing.lg },
  photoColumn: { gap: spacing.xs },
  photo: {
    width: 86,
    height: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
});
