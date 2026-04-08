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
