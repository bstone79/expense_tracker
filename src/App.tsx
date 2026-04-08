import { useEffect, useMemo, useState } from "react";
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
import type { ExpenseTransaction } from "./types/expense";
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

function App() {
  const [transactions, setTransactions] = useState<ExpenseTransaction[]>([]);
  const [skippedRows, setSkippedRows] = useState(0);
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
        setSkippedRows(result.skippedRows);
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
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${value}`} />
              <Tooltip formatter={(value) => formatTooltipAmount(value)} />
              <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {skippedRows > 0 && (
        <section className="card warning-card">
          <p>
            Ignored {skippedRows.toLocaleString("en-US")} malformed row
            {skippedRows === 1 ? "" : "s"} while parsing the CSV.
          </p>
        </section>
      )}
    </main>
  );
}

export default App;
