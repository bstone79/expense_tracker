import { describe, expect, it } from "vitest";
import type { ExpenseTransaction } from "../types/expense";
import { getDashboardSummary, getMonthlyTrend } from "./expenseAggregations";

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
});
