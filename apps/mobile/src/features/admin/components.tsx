import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import {
  formatCents,
  TRADE_STATUS_LABELS,
  type AdminAuditEntry,
  type AdminTradeListItem,
  type AdminUserListItem,
  type TradeStatus,
  type UserRole,
  type UserStatus,
} from '@card-trader/shared';
import { AppText } from '../../components/AppText';
import { Avatar } from '../../components/Profile';
import { Surface } from '../../components/Surface';
import { makeStyles, radius, spacing, useTheme, type ThemeColors } from '../../theme';
import { formatDateShort } from '../../utils/format';
import {
  adminCashText,
  auditActionLabel,
  auditActorText,
  auditChangeLines,
  formatTimestamp,
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
} from './adminText';

export const TRADE_STATUS_COLOR = (colors: ThemeColors): Record<TradeStatus, string> => ({
  DRAFT: colors.textMuted,
  PROPOSED: colors.primary,
  ACCEPTED: colors.warning,
  COMPLETED: colors.positive,
  CANCELLED: colors.textSubtle,
  DECLINED: colors.negative,
});

const ROLE_TONE = (colors: ThemeColors): Record<UserRole, { fg: string; bg: string }> => ({
  USER: { fg: colors.textMuted, bg: colors.surfaceMuted },
  ADMIN: { fg: colors.primary, bg: colors.primarySoft },
  SUPER_ADMIN: { fg: colors.onPrimary, bg: colors.primary },
});

const STATUS_TONE = (colors: ThemeColors): Record<UserStatus, { fg: string; bg: string }> => ({
  ACTIVE: { fg: colors.positive, bg: colors.positiveSoft },
  BLOCKED: { fg: colors.negative, bg: colors.negativeSoft },
  DISABLED: { fg: colors.textMuted, bg: colors.surfaceMuted },
});

export function Pill({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <AppText variant="caption" color={fg} style={styles.pillText} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

export function RoleBadges({ role, status }: { role: UserRole; status: UserStatus }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.badges}>
      <Pill label={USER_ROLE_LABELS[role]} {...ROLE_TONE(colors)[role]} />
      <Pill label={USER_STATUS_LABELS[status]} {...STATUS_TONE(colors)[status]} />
    </View>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  const { colors } = useTheme();
  return verified ? (
    <Pill label="Verified" fg={colors.positive} bg={colors.positiveSoft} />
  ) : (
    <Pill label="Unverified" fg={colors.warning} bg={colors.warningSoft} />
  );
}

/** Small label + big number block for the overview grid and user header. */
export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.tile}>
      <AppText variant="heading" numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
        {label}
      </AppText>
      {hint ? (
        <AppText variant="caption" color={colors.textSubtle} numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export const AdminUserRow = memo(function AdminUserRow({ user, onPress }: { user: AdminUserListItem; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <Avatar url={user.avatarUrl} name={user.displayName} size={44} />
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {user.displayName}
          <AppText color={colors.textMuted}> @{user.username}</AppText>
        </AppText>
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {user.email}
        </AppText>
        {user.vendor ? (
          <AppText variant="caption" color={user.vendor.isActive ? colors.primary : colors.textSubtle} numberOfLines={1}>
            {user.vendor.businessName}
            {user.vendor.isActive ? '' : ' (Vendor Mode off)'}
          </AppText>
        ) : null}
        <View style={styles.meta}>
          <RoleBadges role={user.role} status={user.status} />
          <AppText variant="caption" color={colors.textSubtle}>
            {user.collectionCount} cards · {user.tradeCount} trades
          </AppText>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
});

export const AdminTradeRow = memo(function AdminTradeRow({ trade, onPress }: { trade: AdminTradeListItem; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const initiator = trade.initiator.displayName;
  const counterparty = trade.counterparty.displayName;
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {initiator} ⇄ {counterparty}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {formatCents(trade.initiatorItemsTotalCents)} ⇄ {formatCents(trade.counterpartyItemsTotalCents)} · {trade.itemCount} cards
        </AppText>
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {adminCashText(trade.cash, initiator, counterparty)}
          {trade.event ? ` · ${trade.event.title}` : ''}
        </AppText>
        <View style={styles.meta}>
          <AppText variant="caption" color={TRADE_STATUS_COLOR(colors)[trade.status]} style={styles.status}>
            {TRADE_STATUS_LABELS[trade.status]}
            {trade.isCounterOffer ? ' · Counteroffer' : ''}
          </AppText>
          <AppText variant="caption" color={colors.textSubtle}>
            {formatDateShort(trade.completedAt ?? trade.updatedAt)}
          </AppText>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
});

/** One audit-log entry: what changed, by which admin, when and why. */
export function AuditEntryCard({ entry, onOpenTarget }: { entry: AdminAuditEntry; onOpenTarget?: (publicId: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const lines = auditChangeLines(entry);
  const target = entry.target;
  return (
    <Surface style={styles.audit}>
      <View style={styles.auditHeader}>
        <AppText variant="bodyStrong" style={styles.body} numberOfLines={1}>
          {auditActionLabel(entry.action)}
        </AppText>
        <AppText variant="caption" color={colors.textSubtle}>
          {formatTimestamp(entry.createdAt)}
        </AppText>
      </View>
      <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
        by {auditActorText(entry)}
        {entry.admin.email ? ` · ${entry.admin.email}` : ''}
        {entry.ipAddress ? ` · IP ${entry.ipAddress}` : ''}
      </AppText>
      {target ? (
        onOpenTarget ? (
          <Pressable onPress={() => onOpenTarget(target.publicId)} hitSlop={8} accessibilityRole="link">
            <AppText variant="caption" color={colors.primary} style={styles.status}>
              {target.displayName} ›
            </AppText>
          </Pressable>
        ) : (
          <AppText variant="caption" color={colors.textMuted}>
            {target.displayName}
          </AppText>
        )
      ) : null}
      {lines.map((line) => (
        <AppText key={line} variant="caption" selectable>
          {line}
        </AppText>
      ))}
      {entry.reason ? (
        <AppText variant="caption" color={colors.textMuted}>
          Reason: {entry.reason}
        </AppText>
      ) : null}
    </Surface>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  audit: { gap: 2 },
  auditHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontWeight: '700' },
  badges: { flexDirection: 'row', gap: spacing.xs },
  tile: { flexGrow: 1, flexBasis: '30%', gap: 2, padding: spacing.md, backgroundColor: colors.surfaceMuted, borderRadius: radius.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  status: { fontWeight: '700' },
}));
