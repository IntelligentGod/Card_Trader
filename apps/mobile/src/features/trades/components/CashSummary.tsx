import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatCents, parseDollarsToCents, type SetTradeCashRequest, type TradeResponse, type TradeRole } from '@card-trader/shared';
import { errorMessage } from '../../../api/client';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { Segmented, TextField } from '../../../components/Controls';
import { Surface } from '../../../components/Surface';
import { colors, spacing } from '../../../theme';
import { describeCash, describeDifference, sidesFor } from '../tradeText';

interface CashSummaryProps {
  trade: TradeResponse;
  editable: boolean;
  saving?: boolean;
  error?: unknown;
  onSave?: (body: SetTradeCashRequest) => void;
}

type PayerChoice = 'ME' | 'THEM' | 'NONE';

export function CashSummary({ trade, editable, saving, error, onSave }: CashSummaryProps) {
  const [editing, setEditing] = useState(false);
  const { theirs } = sidesFor(trade);
  const otherRole: TradeRole = trade.myRole === 'INITIATOR' ? 'COUNTERPARTY' : 'INITIATOR';
  const [payer, setPayer] = useState<PayerChoice>(
    trade.cash.payer === null ? 'NONE' : trade.cash.payer === trade.myRole ? 'ME' : 'THEM',
  );
  const [amount, setAmount] = useState(trade.cash.amountCents ? (trade.cash.amountCents / 100).toFixed(2) : '');
  const amountCents = parseDollarsToCents(amount || '0');

  const save = () => {
    if (!onSave || amountCents === null) return;
    const cents = payer === 'NONE' ? 0 : amountCents;
    onSave({ payer: cents === 0 ? null : payer === 'ME' ? trade.myRole : otherRole, amountCents: cents });
    setEditing(false);
  };

  return (
    <Surface style={styles.container}>
      <AppText variant="label" color={colors.textMuted}>
        Difference
      </AppText>
      <AppText testID="trade-difference" variant="bodyStrong">
        {describeDifference(trade)}
      </AppText>
      <AppText testID="trade-cash" variant="heading" color={colors.primary}>
        {describeCash(trade)}
      </AppText>
      {trade.cash.isManual && trade.calculation.suggestedCashCents > 0 ? (
        <AppText variant="caption" color={colors.textMuted}>
          Suggested: {formatCents(trade.calculation.suggestedCashCents)}
        </AppText>
      ) : null}
      {trade.calculation.hasUnpricedItems ? (
        <AppText variant="caption" color={colors.warning}>
          Some cards have no market estimate yet. Agree on cash manually if needed.
        </AppText>
      ) : null}

      {editable && onSave ? (
        editing ? (
          <View style={styles.editor}>
            <Segmented
              options={[
                { value: 'ME', label: 'I pay' },
                { value: 'THEM', label: `${theirs.user.displayName} pays` },
                { value: 'NONE', label: 'No cash' },
              ]}
              value={payer}
              onChange={setPayer}
            />
            {payer !== 'NONE' ? (
              <TextField
                label="Amount (USD)"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                error={amountCents === null ? 'Enter an amount like 20 or 19.50' : null}
              />
            ) : null}
            <View style={styles.row}>
              <Button title="Cancel" variant="secondary" compact style={styles.flex} onPress={() => setEditing(false)} />
              <Button title="Save cash" compact style={styles.flex} onPress={save} loading={saving} disabled={amountCents === null} />
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <Button
              title="Adjust cash"
              variant="secondary"
              compact
              style={styles.flex}
              onPress={() => {
                // Start from the latest server terms (the trade may have been polled since mount).
                setPayer(trade.cash.payer === null ? 'NONE' : trade.cash.payer === trade.myRole ? 'ME' : 'THEM');
                setAmount(trade.cash.amountCents ? (trade.cash.amountCents / 100).toFixed(2) : '');
                setEditing(true);
              }}
            />
            {trade.cash.isManual ? (
              <Button
                title="Use suggested"
                variant="ghost"
                compact
                style={styles.flex}
                onPress={() => onSave({ payer: null, amountCents: 0, useSuggested: true })}
              />
            ) : null}
          </View>
        )
      ) : null}
      {error ? <AppText color={colors.negative}>{errorMessage(error)}</AppText> : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  editor: { gap: spacing.sm, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
});
