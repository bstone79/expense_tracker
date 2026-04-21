import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
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
  getKpiSnapshot,
  getMonthlySpendByType,
  getMonthlyTrend,
  getSpendByCategory,
} from "./utils/expenseAggregations";

type TypeFilter = "All" | "Credit Card" | "Bank";
type TransactionSortKey = "date" | "description" | "category" | "amount" | "type";
type SortDirection = "asc" | "desc";
const CATEGORY_COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444"];
const TRANSACTIONS_PAGE_SIZE = 25;

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

function formatShortMonthLabel(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return monthKey;
  }

  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

function formatDateInputValue(value: Date | null): string {
  if (!value) {
    return "";
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

interface DescriptionGroup {
  key: string;
  description: string;
  categoryLabel: string;
  totalAmount: number;
  transactions: ExpenseTransaction[];
}

function normalizeDescription(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function App() {
  const [transactions, setTransactions] = useState<ExpenseTransaction[]>([]);
  const [startDateFilter, setStartDateFilter] = useState<Date | null>(null);
  const [endDateFilter, setEndDateFilter] = useState<Date | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [malformedRows, setMalformedRows] = useState<MalformedExpenseRow[]>([]);
  const [malformedRowsCount, setMalformedRowsCount] = useState(0);
  const [intentionallySkippedRows, setIntentionallySkippedRows] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[]>([]);
  const [descriptionSearchTerm, setDescriptionSearchTerm] = useState("");
  const [transactionSort, setTransactionSort] = useState<{ key: TransactionSortKey; direction: SortDirection }>({
    key: "date",
    direction: "desc",
  });
  const [transactionsPage, setTransactionsPage] = useState(1);
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

  const allCategories = useMemo(
    () => Array.from(new Set(transactions.map((row) => row.category))).sort((a, b) => a.localeCompare(b, "en-US")),
    [transactions],
  );
  const dateRange = useMemo(() => {
    if (transactions.length === 0) {
      return { minDate: null, maxDate: null };
    }
    let minDate = transactions[0].date;
    let maxDate = transactions[0].date;
    for (const transaction of transactions) {
      if (transaction.date < minDate) {
        minDate = transaction.date;
      }
      if (transaction.date > maxDate) {
        maxDate = transaction.date;
      }
    }
    return { minDate, maxDate };
  }, [transactions]);

  useEffect(() => {
    if (transactions.length === 0) {
      return;
    }
    setStartDateFilter((current) => current ?? dateRange.minDate);
    setEndDateFilter((current) => current ?? dateRange.maxDate);
    setSelectedCategories((current) => {
      if (current.length === 0) {
        return allCategories;
      }
      const available = new Set(allCategories);
      const retained = current.filter((category) => available.has(category));
      return retained.length > 0 ? retained : allCategories;
    });
  }, [allCategories, dateRange.maxDate, dateRange.minDate, transactions.length]);

  const hasInvalidDateRange =
    startDateFilter !== null && endDateFilter !== null && startDateFilter.getTime() > endDateFilter.getTime();

  const filteredTransactions = useMemo(() => {
    if (hasInvalidDateRange) {
      return [];
    }
    if (selectedCategories.length === 0) {
      return [];
    }

    const selected = new Set(selectedCategories);
    return transactions.filter((transaction) => {
      if (startDateFilter && transaction.date < startDateFilter) {
        return false;
      }
      if (endDateFilter && transaction.date > endDateFilter) {
        return false;
      }
      if (selected.size > 0 && !selected.has(transaction.category)) {
        return false;
      }
      if (typeFilter !== "All" && transaction.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [endDateFilter, hasInvalidDateRange, selectedCategories, startDateFilter, transactions, typeFilter]);

  const kpis = useMemo(() => getKpiSnapshot(filteredTransactions), [filteredTransactions]);
  const monthlyTrend = useMemo(() => getMonthlyTrend(filteredTransactions), [filteredTransactions]);
  const monthlySpendByType = useMemo(() => getMonthlySpendByType(filteredTransactions), [filteredTransactions]);
  const spendByCategory = useMemo(() => getSpendByCategory(filteredTransactions), [filteredTransactions]);
  const categorySpendTotal = useMemo(
    () => spendByCategory.reduce((sum, row) => sum + row.total, 0),
    [spendByCategory],
  );
  const monthlyTrendWindowed = useMemo(() => monthlyTrend.slice(-12), [monthlyTrend]);
  const monthlySpendByTypeWindowed = useMemo(() => monthlySpendByType.slice(-12), [monthlySpendByType]);
  const isChartWindowed = monthlyTrend.length > monthlyTrendWindowed.length;
  const isTypeChartWindowed = monthlySpendByType.length > monthlySpendByTypeWindowed.length;
  const transactionsByMonth = useMemo(() => {
    const grouped = new Map<string, ExpenseTransaction[]>();
    for (const transaction of filteredTransactions) {
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
  }, [filteredTransactions]);
  const selectedMonthTransactions = selectedMonth ? (transactionsByMonth.get(selectedMonth) ?? []) : [];
  const searchedTransactions = useMemo(() => {
    const normalizedSearch = descriptionSearchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return filteredTransactions;
    }
    return filteredTransactions.filter((transaction) => transaction.description.toLowerCase().includes(normalizedSearch));
  }, [descriptionSearchTerm, filteredTransactions]);
  const sortedTransactions = useMemo(() => {
    const rows = searchedTransactions.map((transaction, sourceIndex) => ({ transaction, sourceIndex }));
    const directionMultiplier = transactionSort.direction === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const transactionA = a.transaction;
      const transactionB = b.transaction;
      let compareResult = 0;
      switch (transactionSort.key) {
        case "date":
          compareResult = transactionA.date.getTime() - transactionB.date.getTime();
          break;
        case "description":
          compareResult = transactionA.description.localeCompare(transactionB.description, "en-US");
          break;
        case "category":
          compareResult = transactionA.category.localeCompare(transactionB.category, "en-US");
          break;
        case "amount":
          compareResult = transactionA.amount - transactionB.amount;
          break;
        case "type":
          compareResult = transactionA.type.localeCompare(transactionB.type, "en-US");
          break;
      }
      if (compareResult !== 0) {
        return compareResult * directionMultiplier;
      }
      return a.sourceIndex - b.sourceIndex;
    });
    return rows;
  }, [searchedTransactions, transactionSort.direction, transactionSort.key]);
  const totalTransactionPages = Math.max(1, Math.ceil(sortedTransactions.length / TRANSACTIONS_PAGE_SIZE));
  const currentTransactionsPage = Math.min(transactionsPage, totalTransactionPages);
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentTransactionsPage - 1) * TRANSACTIONS_PAGE_SIZE;
    return sortedTransactions.slice(startIndex, startIndex + TRANSACTIONS_PAGE_SIZE);
  }, [currentTransactionsPage, sortedTransactions]);
  const visibleStartIndex = sortedTransactions.length === 0 ? 0 : (currentTransactionsPage - 1) * TRANSACTIONS_PAGE_SIZE + 1;
  const visibleEndIndex = Math.min(currentTransactionsPage * TRANSACTIONS_PAGE_SIZE, sortedTransactions.length);
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
          categoryLabel: transaction.category,
          totalAmount: transaction.amount,
          transactions: [transaction],
        });
      }
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        categoryLabel:
          new Set(group.transactions.map((transaction) => transaction.category)).size === 1
            ? group.transactions[0].category
            : "Multiple",
        totalAmount: Number(group.totalAmount.toFixed(2)),
        transactions: [...group.transactions].sort((a, b) => a.date.getTime() - b.date.getTime()),
      }))
      .sort((a, b) => a.description.localeCompare(b.description, "en-US"));
  }, [selectedMonthTransactions]);

  useEffect(() => {
    if (selectedMonth && !transactionsByMonth.has(selectedMonth)) {
      setSelectedMonth(null);
      setExpandedGroupKeys([]);
    }
  }, [selectedMonth, transactionsByMonth]);

  useEffect(() => {
    setTransactionsPage(1);
  }, [descriptionSearchTerm, filteredTransactions, transactionSort.direction, transactionSort.key]);

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

  function handleStartDateChange(value: string): void {
    setStartDateFilter(parseDateInputValue(value));
  }

  function handleEndDateChange(value: string): void {
    setEndDateFilter(parseDateInputValue(value));
  }

  function handleCategoryToggle(category: string): void {
    setSelectedCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
  }

  function handleTypeFilterChange(value: TypeFilter): void {
    setTypeFilter(value);
  }

  function handleCategorySliceClick(category: string): void {
    setSelectedCategories([category]);
  }

  function handleTransactionSort(sortKey: TransactionSortKey): void {
    setTransactionSort((current) => {
      if (current.key === sortKey) {
        return { key: sortKey, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key: sortKey, direction: "asc" };
    });
  }

  function resetFilters(): void {
    setStartDateFilter(dateRange.minDate);
    setEndDateFilter(dateRange.maxDate);
    setSelectedCategories(allCategories);
    setTypeFilter("All");
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

      <section className="card filter-bar">
        <h2>Filters</h2>
        <div className="filter-grid">
          <label className="filter-field">
            <span>Start Date</span>
            <input
              type="date"
              value={formatDateInputValue(startDateFilter)}
              onChange={(event) => handleStartDateChange(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>End Date</span>
            <input
              type="date"
              value={formatDateInputValue(endDateFilter)}
              onChange={(event) => handleEndDateChange(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>Payment Type</span>
            <select value={typeFilter} onChange={(event) => handleTypeFilterChange(event.target.value as TypeFilter)}>
              <option value="All">All</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Bank">Bank</option>
            </select>
          </label>
          <button type="button" className="reset-filters-btn" onClick={resetFilters}>
            Reset Filters
          </button>
        </div>
        <fieldset className="category-filter-list">
          <legend>Categories</legend>
          <div className="category-filter-options">
            {allCategories.map((category) => (
              <label key={category} className="category-option">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => handleCategoryToggle(category)}
                />
                <span>{category}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {hasInvalidDateRange && (
          <p className="filter-warning">Start date cannot be after end date. Please adjust the selected range.</p>
        )}
      </section>

      {filteredTransactions.length === 0 && !hasInvalidDateRange && (
        <section className="card empty-results-card">
          <h2>No matching transactions</h2>
          <p>Try broadening your filters or use Reset Filters to restore the default range.</p>
        </section>
      )}

      <section className="kpi-grid">
        <article className="card">
          <h2>Total Spend</h2>
          <p className="kpi-value">{formatCurrency(kpis.totalSpend)}</p>
        </article>
        <article className="card">
          <h2>Transactions</h2>
          <p className="kpi-value">{kpis.transactionCount.toLocaleString("en-US")}</p>
        </article>
        <article className="card">
          <h2>Top Category</h2>
          <p className="kpi-value">{kpis.topCategory ?? "N/A"}</p>
        </article>
        <article className="card">
          <h2>Avg. Monthly Spend</h2>
          <p className="kpi-value">{formatCurrency(kpis.avgMonthlySpend)}</p>
        </article>
      </section>

      <section className="card">
        <h2>Monthly Spending Trend</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={monthlyTrendWindowed} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickFormatter={formatShortMonthLabel}
                interval={0}
                minTickGap={10}
                tick={{ fontSize: 12 }}
              />
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
        {isChartWindowed && (
          <p className="chart-hint">Displaying latest 12 months of the selected filter range.</p>
        )}
        <p className="chart-hint">Click anywhere along a month on the chart to view that month's transactions.</p>

        {selectedMonth && (
          <section className="drilldown-section">
            <div className="drilldown-header">
              <h3>Transactions for {formatMonthLabel(selectedMonth)}</h3>
              <button type="button" className="drilldown-close-btn" onClick={() => setSelectedMonth(null)}>
                Close
              </button>
            </div>
            {groupedDrilldownRows.length === 0 ? (
              <p className="chart-hint">No transactions match the current filters for this month.</p>
            ) : (
              <div className="transactions-grid-wrap transactions-grid-scroll">
                <table className="transactions-grid">
                  <thead>
                    <tr>
                      <th aria-label="Expand row"></th>
                      <th>Description</th>
                      <th>Category</th>
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
                            <td>{group.categoryLabel}</td>
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
                                <td>{transaction.category}</td>
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
            )}
          </section>
        )}
      </section>

      <section className="card">
        <h2>Spending by Category</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={spendByCategory}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                onClick={(_entry, index) => {
                  const point = spendByCategory[index];
                  if (point) {
                    handleCategorySliceClick(point.category);
                  }
                }}
              >
                {spendByCategory.map((point, index) => (
                  <Cell key={point.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const numeric = typeof value === "number" ? value : Number(value);
                  const percentage =
                    categorySpendTotal > 0 && Number.isFinite(numeric) ? (numeric / categorySpendTotal) * 100 : 0;
                  return [`${formatCurrency(numeric)} (${percentage.toFixed(1)}%)`, String(name)];
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <p className="chart-hint">Click a slice to filter the dashboard to that category.</p>
      </section>

      <section className="card">
        <h2>Monthly Spend by Payment Type</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlySpendByTypeWindowed}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickFormatter={formatShortMonthLabel}
                interval={0}
                minTickGap={10}
                tick={{ fontSize: 12 }}
              />
              <YAxis tickFormatter={(value) => `$${value}`} />
              <Tooltip formatter={(value) => formatTooltipAmount(value)} />
              <Legend />
              <Bar dataKey="creditCardTotal" name="Credit Card" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bankTotal" name="Bank" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {isTypeChartWindowed && (
          <p className="chart-hint">Displaying latest 12 months of the selected filter range.</p>
        )}
      </section>

      <section className="card">
        <h2>Transactions</h2>
        <label className="transactions-search-field">
          <span>Description Search</span>
          <input
            type="search"
            value={descriptionSearchTerm}
            onChange={(event) => setDescriptionSearchTerm(event.target.value)}
            placeholder="Search descriptions..."
          />
        </label>
        <div className="transactions-grid-wrap">
          <table className="transactions-grid">
            <thead>
              <tr>
                <th>
                  <button type="button" className="sort-header-btn" onClick={() => handleTransactionSort("date")}>
                    Date {transactionSort.key === "date" ? (transactionSort.direction === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="sort-header-btn"
                    onClick={() => handleTransactionSort("description")}
                  >
                    Description{" "}
                    {transactionSort.key === "description" ? (transactionSort.direction === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header-btn" onClick={() => handleTransactionSort("category")}>
                    Category {transactionSort.key === "category" ? (transactionSort.direction === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header-btn" onClick={() => handleTransactionSort("amount")}>
                    Amount {transactionSort.key === "amount" ? (transactionSort.direction === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header-btn" onClick={() => handleTransactionSort("type")}>
                    Type {transactionSort.key === "type" ? (transactionSort.direction === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5}>No transactions match the current filters.</td>
                </tr>
              ) : (
                paginatedTransactions.map(({ transaction, sourceIndex }) => (
                  <tr key={`${sourceIndex}-${transaction.date.toISOString()}-${transaction.amount}`}>
                    <td>{formatDateLabel(transaction.date)}</td>
                    <td>{transaction.description}</td>
                    <td>{transaction.category}</td>
                    <td>{formatCurrency(transaction.amount)}</td>
                    <td>{transaction.type}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="transactions-pagination">
          <p className="chart-hint">
            Showing {visibleStartIndex.toLocaleString("en-US")}–{visibleEndIndex.toLocaleString("en-US")} of{" "}
            {sortedTransactions.length.toLocaleString("en-US")}
          </p>
          <div className="transactions-page-controls">
            <button
              type="button"
              className="reset-filters-btn"
              onClick={() => setTransactionsPage((current) => Math.max(1, current - 1))}
              disabled={currentTransactionsPage === 1}
            >
              Previous
            </button>
            <span className="chart-hint">
              Page {currentTransactionsPage.toLocaleString("en-US")} of {totalTransactionPages.toLocaleString("en-US")}
            </span>
            <button
              type="button"
              className="reset-filters-btn"
              onClick={() => setTransactionsPage((current) => Math.min(totalTransactionPages, current + 1))}
              disabled={currentTransactionsPage >= totalTransactionPages}
            >
              Next
            </button>
          </div>
        </div>
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
