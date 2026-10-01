import { useQuery } from '@tanstack/react-query';
import type { MoverWindow, ValueRange } from '@card-trader/shared';
import { api } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

export const usePortfolioSummary = () => useQuery({ queryKey: queryKeys.portfolioSummary, queryFn: api.portfolio.summary });

export const usePortfolioHistory = (range: ValueRange) =>
  useQuery({ queryKey: queryKeys.portfolioHistory(range), queryFn: () => api.portfolio.history(range) });

export const useTopCards = () => useQuery({ queryKey: queryKeys.portfolioTop, queryFn: () => api.portfolio.topCards(5) });

export const useMovers = (direction: 'up' | 'down', window: MoverWindow) =>
  useQuery({ queryKey: queryKeys.portfolioMovers(direction, window), queryFn: () => api.portfolio.movers(direction, window, 5) });
