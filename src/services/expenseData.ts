import Papa from "papaparse";
import csvRaw from "../../expense_data.csv?raw";
import type {
  ExpenseLoadResult,
  ExpenseTransaction,
  MalformedExpenseRow,
} from "../types/expense";

const REQUIRED_COLUMNS = ["Date", "Description", "Category", "Amount", "Type"] as const;

type CsvRow = Record<string, string | undefined>;
type ParsedRowResult =
  | { kind: "transaction"; value: ExpenseTransaction }
  | { kind: "intentionally-skipped" }
  | { kind: "malformed"; reason: string };

function parseDate(value: string): Date | null {
  const parts = value.split("/");
  if (parts.length !== 3) {
    return null;
  }

  const [monthRaw, dayRaw, yearRaw] = parts;
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const year = Number(yearRaw);
  if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(year)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseTransaction(row: CsvRow): ParsedRowResult {
  const dateValue = (row.Date ?? "").trim();
  const description = (row.Description ?? "").trim();
  const category = (row.Category ?? "").trim();
  const amountRaw = (row.Amount ?? "").trim();
  const type = (row.Type ?? "").trim();

  if (!dateValue || !description || !category || !amountRaw || !type) {
    return { kind: "malformed", reason: "Missing one or more required fields." };
  }

  // Exclude internal transfer rows to avoid counting non-expense money movement.
  const descriptionLower = description.toLowerCase();
  if (
    descriptionLower.includes("transfer to cc") ||
    descriptionLower.includes("transfer to sv")
  ) {
    return { kind: "intentionally-skipped" };
  }

  const date = parseDate(dateValue);
  const amount = Number(amountRaw);
  if (!date) {
    return { kind: "malformed", reason: "Date is not in a valid MM/DD/YYYY format." };
  }

  if (Number.isNaN(amount)) {
    return { kind: "malformed", reason: "Amount is not a valid number." };
  }

  if (amount < 0) {
    return { kind: "malformed", reason: "Amount cannot be negative." };
  }

  return {
    kind: "transaction",
    value: { date, description, category, amount, type },
  };
}

export function parseExpenseCsv(csvText: string): ExpenseLoadResult {
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
  });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${parsed.errors[0]?.message ?? "Unknown parse error"}`);
  }

  if (!parsed.meta.fields) {
    throw new Error("CSV parsing failed: no header fields were found.");
  }

  const fields = new Set(parsed.meta.fields);
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !fields.has(column));
  if (missingColumns.length > 0) {
    throw new Error(`CSV schema mismatch. Missing columns: ${missingColumns.join(", ")}`);
  }

  const transactions: ExpenseTransaction[] = [];
  const malformedRows: MalformedExpenseRow[] = [];
  let intentionallySkippedRows = 0;

  for (const [index, row] of parsed.data.entries()) {
    const parsedRow = parseTransaction(row);
    if (parsedRow.kind === "transaction") {
      transactions.push(parsedRow.value);
      continue;
    }

    if (parsedRow.kind === "intentionally-skipped") {
      intentionallySkippedRows += 1;
      continue;
    }

    malformedRows.push({
      rowNumber: index + 2,
      reason: parsedRow.reason,
      date: (row.Date ?? "").trim(),
      description: (row.Description ?? "").trim(),
      category: (row.Category ?? "").trim(),
      amount: (row.Amount ?? "").trim(),
      type: (row.Type ?? "").trim(),
    });
  }

  return {
    transactions,
    malformedRows,
    malformedRowsCount: malformedRows.length,
    intentionallySkippedRows,
  };
}

export async function loadExpenseData(): Promise<ExpenseLoadResult> {
  return parseExpenseCsv(csvRaw);
}
