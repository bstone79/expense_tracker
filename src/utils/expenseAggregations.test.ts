import { describe, expect, it } from "vitest";
import type { ExpenseTransaction } from "../types/expense";
import {
  getDashboardSummary,
  getMonthlySpendByType,
  getMonthlyTrend,
  getSpendByCategory,
} from "./expenseAggregations";

const sampleRows: ExpenseTransaction[] = [
  {
    date: new Date(2026, 0, 5),
    description: "A",
    category: "Dining",
    amount: 20,
    type: "Credit Card",
  },
  {
    date: new Date(2026, 0, 8),
    description: "B",
    category: "Groceries",
    amount: 30.5,
    type: "Bank",
  },
  {
    date: new Date(2026, 1, 10),
    description: "C",
    category: "Dining",
    amount: 10,
    type: "Credit Card",
  },
];

describe("expenseAggregations", () => {
  it("builds dashboard summary values", () => {
    const summary = getDashboardSummary(sampleRows);
    expect(summary.totalSpend).toBe(60.5);
    expect(summary.transactionCount).toBe(3);
    expect(summary.categoryCount).toBe(2);
  });

  it("groups monthly trend in ascending month order", () => {
    const trend = getMonthlyTrend(sampleRows);
    expect(trend).toEqual([
      { month: "2026-01", total: 50.5 },
      { month: "2026-02", total: 10 },
    ]);
  });

  it("groups total spend by category in descending amount", () => {
    const spendByCategory = getSpendByCategory(sampleRows);
    expect(spendByCategory).toEqual([
      { category: "Groceries", total: 30.5 },
      { category: "Dining", total: 30 },
    ]);
  });

  it("groups monthly spend split by credit card and bank types", () => {
    const monthlyByType = getMonthlySpendByType(sampleRows);
    expect(monthlyByType).toEqual([
      { month: "2026-01", creditCardTotal: 20, bankTotal: 30.5 },
      { month: "2026-02", creditCardTotal: 10, bankTotal: 0 },
    ]);
  });
});
