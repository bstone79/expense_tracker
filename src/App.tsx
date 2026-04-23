import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
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
import { extractTextFromPdf } from "./services/pdfExtraction";
import type { ExpenseTransaction, MalformedExpenseRow } from "./types/expense";
import {
  formatCurrency,
  getKpiSnapshot,
  getMonthlySpendByType,
  getMonthlyTrend,
  getSpendByCategory,
} from "./utils/expenseAggregations";

type TypeFilter = "All" | "Credit Card" | "Bank";
type StatementType = "Credit Card" | "Bank";
type TransactionSortKey = "date" | "description" | "category" | "amount" | "type";
type SortDirection = "asc" | "desc";
type AppView = "Dashboard" | "Transactions" | "Upload";
type UploadProcessingState = "idle" | "extracting-pdf" | "parsing" | "appending";
type ParsedUploadTransaction = {
  Date: string;
  Description: string;
  Category: string;
  Amount: number;
  Type: StatementType;
};
type UploadPreviewRow = ParsedUploadTransaction & {
  rowId: string;
  include: boolean;
  isDuplicate: boolean;
  appendStatus: "pending" | "appended";
};
const CATEGORY_COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444"];
const UPLOAD_CATEGORY_OPTIONS = [
  "Groceries",
  "Utilities",
  "Entertainment",
  "Transportation",
  "Housing",
  "Dining",
  "Shopping",
] as const;
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

function getUploadFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed.includes(".")) {
    return "";
  }
  return trimmed.slice(trimmed.lastIndexOf(".")).toLowerCase();
}

function buildUploadDuplicateKey(date: string, description: string, amount: number): string {
  const normalizedAmount = Number(amount);
  const normalizedAmountLabel = Number.isFinite(normalizedAmount) ? normalizedAmount.toFixed(2) : "invalid";
  return `${date.trim()}|${normalizeDescription(description)}|${normalizedAmountLabel}`;
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
  const [activeView, setActiveView] = useState<AppView>("Dashboard");
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [selectedStatementType, setSelectedStatementType] = useState<StatementType | "">("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadProcessingState, setUploadProcessingState] = useState<UploadProcessingState>("idle");
  const [extractedPdfTextLength, setExtractedPdfTextLength] = useState<number>(0);
  const [parsedUploadTransactions, setParsedUploadTransactions] = useState<UploadPreviewRow[]>([]);
  const [isUploadDragActive, setIsUploadDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

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
  const existingTransactionDuplicateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const transaction of transactions) {
      keys.add(buildUploadDuplicateKey(formatDateLabel(transaction.date), transaction.description, transaction.amount));
    }
    return keys;
  }, [transactions]);
  const includedParsedRowsCount = useMemo(
    () => parsedUploadTransactions.filter((row) => row.include && row.appendStatus !== "appended").length,
    [parsedUploadTransactions],
  );
  const duplicateParsedRowsCount = useMemo(
    () => parsedUploadTransactions.filter((row) => row.isDuplicate).length,
    [parsedUploadTransactions],
  );

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

  function validateUploadFile(file: File): string | null {
    const extension = getUploadFileExtension(file.name);
    if (extension !== ".csv" && extension !== ".pdf") {
      return "Please select a .csv or .pdf statement file.";
    }
    return null;
  }

  async function handleUploadFileSelection(file: File | null): Promise<void> {
    if (!file) {
      setSelectedUploadFile(null);
      setUploadError(null);
      setUploadSuccess(null);
      setUploadProcessingState("idle");
      setExtractedPdfTextLength(0);
      setParsedUploadTransactions([]);
      return;
    }

    const validationError = validateUploadFile(file);
    if (validationError) {
      setSelectedUploadFile(null);
      setUploadError(validationError);
      setUploadSuccess(null);
      setUploadProcessingState("idle");
      setExtractedPdfTextLength(0);
      setParsedUploadTransactions([]);
      return;
    }

    setSelectedUploadFile(file);
    setUploadError(null);
    setUploadSuccess(null);
    setExtractedPdfTextLength(0);
    setParsedUploadTransactions([]);
    setUploadProcessingState("idle");
  }

  async function parseStatementFile(file: File): Promise<{ text: string; extractedPdfLength: number }> {
    const extension = getUploadFileExtension(file.name);
    if (extension === ".pdf") {
      const extractedText = await extractTextFromPdf(file);
      const normalized = extractedText.trim();
      return {
        text: normalized,
        extractedPdfLength: normalized.length,
      };
    }

    const csvText = await file.text();
    return {
      text: csvText.trim(),
      extractedPdfLength: 0,
    };
  }

  async function handleParseStatement(): Promise<void> {
    if (!selectedUploadFile) {
      setUploadError("Select a statement file before parsing.");
      return;
    }

    if (!selectedStatementType) {
      setUploadError("Select statement type before parsing.");
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);
    setParsedUploadTransactions([]);
    setExtractedPdfTextLength(0);

    try {
      const extension = getUploadFileExtension(selectedUploadFile.name);
      if (extension === ".pdf") {
        setUploadProcessingState("extracting-pdf");
      } else {
        setUploadProcessingState("parsing");
      }

      const { text: statementText, extractedPdfLength } = await parseStatementFile(selectedUploadFile);
      if (!statementText) {
        throw new Error("No statement text found to parse.");
      }
      if (extractedPdfLength > 0) {
        setExtractedPdfTextLength(extractedPdfLength);
      }

      setUploadProcessingState("parsing");

      const response = await fetch("/api/parse-statement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          statementType: selectedStatementType,
          statementText,
        }),
      });

      const rawResponseText = await response.text();
      const payload = (() => {
        if (!rawResponseText) {
          return {};
        }
        try {
          return JSON.parse(rawResponseText) as Record<string, unknown>;
        } catch {
          return {};
        }
      })() as {
        transactions?: ParsedUploadTransaction[];
        error?: string;
        details?: string;
      };
      if (!response.ok) {
        const serverMessage =
          typeof payload.error === "string" && payload.error.trim().length > 0
            ? payload.error.trim()
            : rawResponseText.trim().slice(0, 220);
        const serverDetails =
          typeof payload.details === "string" && payload.details.trim().length > 0
            ? payload.details.trim().slice(0, 260)
            : "";
        const statusSummary = `Parse request failed (${response.status}).`;
        const detailSuffix = serverDetails ? ` Details: ${serverDetails}` : "";
        throw new Error(serverMessage ? `${statusSummary} ${serverMessage}${detailSuffix}` : statusSummary);
      }

      const rows = Array.isArray(payload.transactions) ? payload.transactions : [];
      const previewRows = rows.map((row, index) => {
        const duplicateKey = buildUploadDuplicateKey(row.Date, row.Description, row.Amount);
        const isDuplicate = existingTransactionDuplicateKeys.has(duplicateKey);
        return {
          ...row,
          Category: row.Category.trim(),
          rowId: `${duplicateKey}-${index}`,
          include: !isDuplicate,
          isDuplicate,
          appendStatus: "pending" as const,
        };
      });

      setParsedUploadTransactions(previewRows);
      if (previewRows.length === 0) {
        setUploadError("No spending transactions were returned for this statement.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse statement.";
      if (message === "No extractable text found") {
        setUploadError("PDF text extraction failed. Please upload a CSV statement instead.");
      } else {
        setUploadError(message);
      }
      setParsedUploadTransactions([]);
    } finally {
      setUploadProcessingState("idle");
    }
  }

  function handleUploadInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const selectedFile = event.target.files?.[0] ?? null;
    void handleUploadFileSelection(selectedFile);
    event.target.value = "";
  }

  function handleUploadDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsUploadDragActive(false);
    const droppedFile = event.dataTransfer.files?.[0] ?? null;
    void handleUploadFileSelection(droppedFile);
  }

  function handleUploadRowInclusionChange(rowId: string, include: boolean): void {
    setParsedUploadTransactions((current) =>
      current.map((row) => (row.rowId === rowId && row.appendStatus !== "appended" ? { ...row, include } : row)),
    );
  }

  function handleUploadCategoryChange(rowId: string, category: string): void {
    setParsedUploadTransactions((current) =>
      current.map((row) =>
        row.rowId === rowId && row.appendStatus !== "appended" ? { ...row, Category: category } : row,
      ),
    );
  }

  async function handleConfirmAppend(): Promise<void> {
    const rowsToAppend = parsedUploadTransactions
      .filter((row) => row.include && row.appendStatus !== "appended")
      .map((row) => ({
        Date: row.Date,
        Description: row.Description,
        Category: row.Category,
        Amount: row.Amount,
        Type: row.Type,
      }));

    if (rowsToAppend.length === 0) {
      setUploadError("Select at least one row to append before confirming.");
      setUploadSuccess(null);
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);
    setUploadProcessingState("appending");

    try {
      const response = await fetch("/api/append-transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactions: rowsToAppend,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        appendedCount?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to append selected rows.");
      }

      const appendedCount =
        typeof payload.appendedCount === "number" && Number.isFinite(payload.appendedCount)
          ? payload.appendedCount
          : rowsToAppend.length;
      setUploadSuccess(
        `Appended ${appendedCount.toLocaleString("en-US")} row${appendedCount === 1 ? "" : "s"} to CSV. Data refresh is the next step.`,
      );
      setParsedUploadTransactions((current) =>
        current.map((row) => (row.include && row.appendStatus !== "appended" ? { ...row, appendStatus: "appended" } : row)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to append selected rows.";
      setUploadError(message);
      setUploadSuccess(null);
    } finally {
      setUploadProcessingState("idle");
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

      <nav className="view-tabs" aria-label="Primary views">
        {(["Dashboard", "Transactions", "Upload"] as const).map((view) => (
          <button
            key={view}
            type="button"
            className={`view-tab-btn${activeView === view ? " active" : ""}`}
            onClick={() => setActiveView(view)}
          >
            {view}
          </button>
        ))}
      </nav>

      {activeView !== "Upload" && (
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
      )}

      {activeView !== "Upload" && filteredTransactions.length === 0 && !hasInvalidDateRange && (
        <section className="card empty-results-card">
          <h2>No matching transactions</h2>
          <p>Try broadening your filters or use Reset Filters to restore the default range.</p>
        </section>
      )}

      {activeView === "Dashboard" && (
        <>
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
        </>
      )}

      {activeView === "Transactions" && (
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
      )}

      {activeView === "Upload" && (
        <section className="card upload-card">
          <h2>Upload Statement</h2>
          <p className="chart-hint">Select statement type, upload a file, then parse with Gemini.</p>
          <label className="filter-field upload-type-field">
            <span>Statement Type</span>
            <select
              value={selectedStatementType}
              onChange={(event) => {
                setSelectedStatementType(event.target.value as StatementType | "");
                setUploadError(null);
                setUploadSuccess(null);
                setParsedUploadTransactions([]);
              }}
            >
              <option value="">Select type...</option>
              <option value="Bank">Bank</option>
              <option value="Credit Card">Credit Card</option>
            </select>
          </label>
          <input
            ref={uploadInputRef}
            type="file"
            className="upload-file-input"
            accept=".csv,.pdf,application/pdf,text/csv"
            onChange={handleUploadInputChange}
          />
          <div
            className={`upload-dropzone${isUploadDragActive ? " drag-active" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsUploadDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsUploadDragActive(false);
            }}
            onDrop={handleUploadDrop}
          >
            <p>Drag and drop a statement here, or choose a file.</p>
            <button type="button" className="reset-filters-btn" onClick={() => uploadInputRef.current?.click()}>
              Choose File
            </button>
          </div>

          {uploadError && <p className="filter-warning">{uploadError}</p>}
          {uploadSuccess && <p className="upload-status success">{uploadSuccess}</p>}

          {selectedUploadFile ? (
            <div className="upload-file-summary">
              <p>
                <strong>Selected file:</strong> {selectedUploadFile.name}
              </p>
              <p>
                <strong>Size:</strong> {(selectedUploadFile.size / 1024).toFixed(1)} KB
              </p>
              <div className="upload-file-actions">
                <button type="button" className="reset-filters-btn" onClick={() => uploadInputRef.current?.click()}>
                  Replace File
                </button>
                <button type="button" className="reset-filters-btn" onClick={() => void handleUploadFileSelection(null)}>
                  Remove File
                </button>
              </div>
              {uploadProcessingState === "extracting-pdf" && (
                <p className="upload-status">Extracting text from PDF...</p>
              )}
              {uploadProcessingState === "idle" && extractedPdfTextLength > 0 && !uploadError && (
                <p className="upload-status success">
                  PDF text extraction complete ({extractedPdfTextLength.toLocaleString("en-US")} characters).
                </p>
              )}
              {uploadProcessingState === "parsing" && <p className="upload-status">Parsing statement with Gemini...</p>}
              {uploadProcessingState === "appending" && <p className="upload-status">Appending accepted rows to CSV...</p>}
              <div className="upload-file-actions">
                <button
                  type="button"
                  className="reset-filters-btn"
                  disabled={uploadProcessingState !== "idle"}
                  onClick={() => void handleParseStatement()}
                >
                  Parse Statement
                </button>
              </div>
            </div>
          ) : (
            <p className="chart-hint">No file selected.</p>
          )}

          {parsedUploadTransactions.length > 0 && (
            <section className="parsed-preview-section">
              <h3>
                Parsed Preview ({parsedUploadTransactions.length.toLocaleString("en-US")} rows intended for import)
              </h3>
              <p className="chart-hint">
                Included rows: {includedParsedRowsCount.toLocaleString("en-US")} of{" "}
                {parsedUploadTransactions.length.toLocaleString("en-US")} | Potential duplicates:{" "}
                {duplicateParsedRowsCount.toLocaleString("en-US")} (excluded by default)
              </p>
              <div className="transactions-grid-wrap transactions-grid-scroll">
                <table className="transactions-grid">
                  <thead>
                    <tr>
                      <th>Include</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedUploadTransactions.map((transaction) => (
                      <tr
                        key={transaction.rowId}
                        className={`${transaction.isDuplicate ? "upload-preview-duplicate-row" : ""}${transaction.include ? "" : " upload-preview-excluded-row"}`}
                      >
                        <td>
                          <div className="upload-preview-actions">
                            <button
                              type="button"
                              className={`upload-preview-action-btn${transaction.include ? " active" : ""}`}
                              disabled={transaction.appendStatus === "appended"}
                              onClick={() => handleUploadRowInclusionChange(transaction.rowId, true)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className={`upload-preview-action-btn${!transaction.include ? " active" : ""}`}
                              disabled={transaction.appendStatus === "appended"}
                              onClick={() => handleUploadRowInclusionChange(transaction.rowId, false)}
                            >
                              Decline
                            </button>
                          </div>
                        </td>
                        <td>{transaction.Date}</td>
                        <td>{transaction.Description}</td>
                        <td>
                          <select
                            className="upload-preview-category-select"
                            value={transaction.Category}
                            disabled={transaction.appendStatus === "appended"}
                            onChange={(event) => handleUploadCategoryChange(transaction.rowId, event.target.value)}
                          >
                            {UPLOAD_CATEGORY_OPTIONS.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{formatCurrency(transaction.Amount)}</td>
                        <td>{transaction.Type}</td>
                        <td>
                          {transaction.appendStatus === "appended" ? (
                            <span className="upload-preview-status upload-preview-status-appended">Appended</span>
                          ) : transaction.include ? (
                            <span className="upload-preview-status upload-preview-status-pending">Accepted</span>
                          ) : (
                            <span className="upload-preview-status upload-preview-status-declined">Declined</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="upload-file-actions">
                <button
                  type="button"
                  className="reset-filters-btn"
                  disabled={uploadProcessingState !== "idle" || includedParsedRowsCount === 0}
                  onClick={() => void handleConfirmAppend()}
                >
                  Confirm & Append Included Rows
                </button>
              </div>
            </section>
          )}
        </section>
      )}

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
