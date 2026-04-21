import type { ExpenseTransaction } from "../types/expense";

export interface DashboardSummary {
  totalSpend: number;
  transactionCount: number;
  categoryCount: number;
}

export interface MonthlyTrendPoint {
  month: string;
  total: number;
}

export interface SpendByCategoryPoint {
  category: string;
  total: number;
}

export interface MonthlySpendByTypePoint {
  month: string;
  creditCardTotal: number;
  bankTotal: number;
}

export interface TopCategoryResult {
  category: string;
  total: number;
}

export interface KpiSnapshot {
  totalSpend: number;
  transactionCount: number;
  topCategory: string | null;
  avgMonthlySpend: number;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function getDashboardSummary(transactions: ExpenseTransaction[]): DashboardSummary {
  const totalSpend = transactions.reduce((sum, row) => sum + row.amount, 0);
  const categories = new Set(transactions.map((row) => row.category));

  return {
    totalSpend,
    transactionCount: transactions.length,
    categoryCount: categories.size,
  };
}

export function getMonthlyTrend(transactions: ExpenseTransaction[]): MonthlyTrendPoint[] {
  const grouped = new Map<string, number>();

  for (const transaction of transactions) {
    const year = transaction.date.getFullYear();
    const month = transaction.date.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    grouped.set(key, (grouped.get(key) ?? 0) + transaction.amount);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total: Number(total.toFixed(2)) }));
}

export function getSpendByCategory(transactions: ExpenseTransaction[]): SpendByCategoryPoint[] {
  const grouped = new Map<string, number>();

  for (const transaction of transactions) {
    grouped.set(transaction.category, (grouped.get(transaction.category) ?? 0) + transaction.amount);
  }

  return Array.from(grouped.entries())
    .map(([category, total]) => ({ category, total: Number(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category, "en-US"));
}

export function getMonthlySpendByType(transactions: ExpenseTransaction[]): MonthlySpendByTypePoint[] {
  const grouped = new Map<string, MonthlySpendByTypePoint>();

  for (const transaction of transactions) {
    const year = transaction.date.getFullYear();
    const month = transaction.date.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const current = grouped.get(monthKey) ?? {
      month: monthKey,
      creditCardTotal: 0,
      bankTotal: 0,
    };

    if (transaction.type === "Credit Card") {
      current.creditCardTotal += transaction.amount;
    } else if (transaction.type === "Bank") {
      current.bankTotal += transaction.amount;
    }

    grouped.set(monthKey, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      ...row,
      creditCardTotal: Number(row.creditCardTotal.toFixed(2)),
      bankTotal: Number(row.bankTotal.toFixed(2)),
    }));
}

export function getTopCategory(transactions: ExpenseTransaction[]): TopCategoryResult | null {
  const spendByCategory = getSpendByCategory(transactions);
  if (spendByCategory.length === 0) {
    return null;
  }
  const top = spendByCategory[0];
  return {
    category: top.category,
    total: top.total,
  };
}

export function getAverageMonthlySpend(transactions: ExpenseTransaction[]): number {
  if (transactions.length === 0) {
    return 0;
  }

  const monthlyTrend = getMonthlyTrend(transactions);
  if (monthlyTrend.length === 0) {
    return 0;
  }

  const monthlyTotal = monthlyTrend.reduce((sum, row) => sum + row.total, 0);
  return Number((monthlyTotal / monthlyTrend.length).toFixed(2));
}

export function getKpiSnapshot(transactions: ExpenseTransaction[]): KpiSnapshot {
  const summary = getDashboardSummary(transactions);
  const topCategory = getTopCategory(transactions);
  const avgMonthlySpend = getAverageMonthlySpend(transactions);

  return {
    totalSpend: summary.totalSpend,
    transactionCount: summary.transactionCount,
    topCategory: topCategory?.category ?? null,
    avgMonthlySpend,
  };
}
