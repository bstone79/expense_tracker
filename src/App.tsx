import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import { loadExpenseData } from "./services/expenseData";
import type { ExpenseTransaction, MalformedExpenseRow } from "./types/expense";
import {
  formatCurrency,
  getDashboardSummary,
  getMonthlyTrend,
} from "./utils/expenseAggregations";

function formatTooltipAmount(
  value: number | string | ReadonlyArray<number | string> | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const numeric = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(numeric) ? formatCurrency(numeric) : "$0.00";
}

function formatDateLabel(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatMonthLabel(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return monthKey;
  }

  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

interface DescriptionGroup {
  key: string;
  description: string;
  totalAmount: number;
  transactions: ExpenseTransaction[];
}

function normalizeDescription(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function App() {
  const [transactions, setTransactions] = useState<ExpenseTransaction[]>([]);
  const [malformedRows, setMalformedRows] = useState<MalformedExpenseRow[]>([]);
  const [malformedRowsCount, setMalformedRowsCount] = useState(0);
  const [intentionallySkippedRows, setIntentionallySkippedRows] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const result = await loadExpenseData();
        if (!isMounted) {
          return;
        }
        setTransactions(result.transactions);
        setMalformedRows(result.malformedRows);
        setMalformedRowsCount(result.malformedRowsCount);
        setIntentionallySkippedRows(result.intentionallySkippedRows);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load expense data.";
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(() => getDashboardSummary(transactions), [transactions]);
  const monthlyTrend = useMemo(() => getMonthlyTrend(transactions), [transactions]);
  const transactionsByMonth = useMemo(() => {
    const grouped = new Map<string, ExpenseTransaction[]>();
    for (const transaction of transactions) {
      const year = transaction.date.getFullYear();
      const month = transaction.date.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(transaction);
      } else {
        grouped.set(key, [transaction]);
      }
    }

    for (const rows of grouped.values()) {
      rows.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    return grouped;
  }, [transactions]);
  const selectedMonthTransactions = selectedMonth ? (transactionsByMonth.get(selectedMonth) ?? []) : [];
  const groupedDrilldownRows = useMemo<DescriptionGroup[]>(() => {
    const grouped = new Map<string, DescriptionGroup>();

    for (const transaction of selectedMonthTransactions) {
      const key = normalizeDescription(transaction.description);
      const existing = grouped.get(key);
      if (existing) {
        existing.totalAmount += transaction.amount;
        existing.transactions.push(transaction);
      } else {
        grouped.set(key, {
          key,
          description: transaction.description,
          totalAmount: transaction.amount,
          transactions: [transaction],
        });
      }
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        totalAmount: Number(group.totalAmount.toFixed(2)),
        transactions: [...group.transactions].sort((a, b) => a.date.getTime() - b.date.getTime()),
      }))
      .sort((a, b) => a.description.localeCompare(b.description, "en-US"));
  }, [selectedMonthTransactions]);

  function handleMonthClick(monthKey: string): void {
    setExpandedGroupKeys([]);
    setSelectedMonth((current) => (current === monthKey ? null : monthKey));
  }

  function toggleGroupExpansion(groupKey: string): void {
    setExpandedGroupKeys((current) =>
      current.includes(groupKey) ? current.filter((key) => key !== groupKey) : [...current, groupKey],
    );
  }

  function handleChartClick(state: unknown): void {
    const activeLabel = (state as { activeLabel?: string | number } | null)?.activeLabel;
    if (typeof activeLabel === "string" && activeLabel.length > 0) {
      handleMonthClick(activeLabel);
    }
  }

  if (loading) {
    return <main className="app">Loading expense data...</main>;
  }

  if (error) {
    return (
      <main className="app">
        <h1>Expenses Tracker</h1>
        <section className="card error-card">
          <h2>Data Load Error</h2>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <h1>Expenses Tracker</h1>
      <p className="subtitle">Local read-only dashboard from expense_data.csv</p>

      <section className="kpi-grid">
        <article className="card">
          <h2>Total Spend</h2>
          <p className="kpi-value">{formatCurrency(summary.totalSpend)}</p>
        </article>
        <article className="card">
          <h2>Transactions</h2>
          <p className="kpi-value">{summary.transactionCount.toLocaleString("en-US")}</p>
        </article>
        <article className="card">
          <h2>Categories</h2>
          <p className="kpi-value">{summary.categoryCount.toLocaleString("en-US")}</p>
        </article>
      </section>

      <section className="card">
        <h2>Monthly Spending Trend</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={monthlyTrend} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${value}`} />
              <Tooltip formatter={(value) => formatTooltipAmount(value)} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 4, cursor: "pointer" }}
                activeDot={{ r: 6, cursor: "pointer" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="chart-hint">Click anywhere along a month on the chart to view that month's transactions.</p>

        {selectedMonth && (
          <section className="drilldown-section">
            <h3>Transactions for {formatMonthLabel(selectedMonth)}</h3>
            <div className="transactions-grid-wrap transactions-grid-scroll">
              <table className="transactions-grid">
                <thead>
                  <tr>
                    <th aria-label="Expand row"></th>
                    <th>Description</th>
                    <th>Entries</th>
                    <th>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedDrilldownRows.map((group) => {
                    const isExpanded = expandedGroupKeys.includes(group.key);
                    return (
                      <Fragment key={group.key}>
                        <tr className="summary-row">
                          <td>
                            <button
                              type="button"
                              className="expand-arrow-btn"
                              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${group.description}`}
                              aria-expanded={isExpanded}
                              onClick={() => toggleGroupExpansion(group.key)}
                            >
                              {isExpanded ? "▼" : "▶"}
                            </button>
                          </td>
                          <td>{group.description}</td>
                          <td>{group.transactions.length.toLocaleString("en-US")}</td>
                          <td>{formatCurrency(group.totalAmount)}</td>
                        </tr>
                        {isExpanded &&
                          group.transactions.map((transaction) => (
                            <tr
                              key={`${group.key}-${transaction.date.toISOString()}-${transaction.amount}-${transaction.type}`}
                              className="detail-row"
                            >
                              <td></td>
                              <td>
                                {transaction.description}
                                <div className="detail-meta">
                                  {formatDateLabel(transaction.date)} | {transaction.category} | {transaction.type}
                                </div>
                              </td>
                              <td>1</td>
                              <td>{formatCurrency(transaction.amount)}</td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>

      {(malformedRowsCount > 0 || intentionallySkippedRows > 0) && (
        <section className="card warning-card">
          {malformedRowsCount > 0 && (
            <p>
              Found {malformedRowsCount.toLocaleString("en-US")} malformed row
              {malformedRowsCount === 1 ? "" : "s"} while parsing the CSV.
            </p>
          )}
          {intentionallySkippedRows > 0 && (
            <p>
              Intentionally skipped {intentionallySkippedRows.toLocaleString("en-US")} filtered row
              {intentionallySkippedRows === 1 ? "" : "s"}.
            </p>
          )}

          {malformedRowsCount > 0 && (
            <section className="malformed-rows-section">
              <h3>Malformed Rows</h3>
              <div className="malformed-rows-list">
                {malformedRows.map((row) => (
                  <article key={`${row.rowNumber}-${row.description}-${row.amount}`} className="malformed-row">
                    <p>
                      <strong>Row {row.rowNumber}:</strong> {row.reason}
                    </p>
                    <p>
                      Date: {row.date || "(blank)"} | Description: {row.description || "(blank)"} |
                      Category: {row.category || "(blank)"} | Amount: {row.amount || "(blank)"} |
                      Type: {row.type || "(blank)"}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
