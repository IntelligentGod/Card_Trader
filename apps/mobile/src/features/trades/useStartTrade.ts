import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

/**
 * Creates (or reopens) a draft with this collector and adds any preselected
 * cards. eventId links the trade to the card show it was started from.
 */
export function useStartTrade() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      publicId,
      collectionItemIds = [],
      eventId,
    }: {
      publicId: string;
      collectionItemIds?: string[];
      eventId?: string;
    }) => {
      let trade = await api.trades.create(publicId, eventId);
      const existing = new Set(
        [...trade.initiator.items, ...trade.counterparty.items].map((i) => i.collectionItemId).filter(Boolean),
      );
      for (const collectionItemId of collectionItemIds) {
        if (!existing.has(collectionItemId)) trade = await api.trades.addItem(trade.id, { collectionItemId });
      }
      return trade;
    },
    onSuccess: (trade) => {
      client.setQueryData(queryKeys.trade(trade.id), trade);
      void client.invalidateQueries({ queryKey: ['trades', 'list'] });
    },
  });
}
