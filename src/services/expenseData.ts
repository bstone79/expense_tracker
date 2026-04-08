import Papa from "papaparse";
import csvRaw from "../../expense_data.csv?raw";
import type { ExpenseLoadResult, ExpenseTransaction } from "../types/expense";

const REQUIRED_COLUMNS = ["Date", "Description", "Category", "Amount", "Type"] as const;

type CsvRow = Record<string, string | undefined>;

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

function parseTransaction(row: CsvRow): ExpenseTransaction | null {
  const dateValue = (row.Date ?? "").trim();
  const description = (row.Description ?? "").trim();
  const category = (row.Category ?? "").trim();
  const amountRaw = (row.Amount ?? "").trim();
  const type = (row.Type ?? "").trim();

  if (!dateValue || !description || !category || !amountRaw || !type) {
    return null;
  }

  // Exclude internal transfer rows to avoid counting non-expense money movement.
  const descriptionLower = description.toLowerCase();
  if (
    descriptionLower.includes("transfer to cc") ||
    descriptionLower.includes("transfer to sv")
  ) {
    return null;
  }

  const date = parseDate(dateValue);
  const amount = Number(amountRaw);
  if (!date || Number.isNaN(amount) || amount < 0) {
    return null;
  }

  return { date, description, category, amount, type };
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
  let skippedRows = 0;

  for (const row of parsed.data) {
    const transaction = parseTransaction(row);
    if (transaction) {
      transactions.push(transaction);
    } else {
      skippedRows += 1;
    }
  }

  return { transactions, skippedRows };
}

export async function loadExpenseData(): Promise<ExpenseLoadResult> {
  return parseExpenseCsv(csvRaw);
}
