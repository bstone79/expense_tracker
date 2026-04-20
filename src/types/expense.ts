export type TransactionType = "Credit Card" | "Bank" | string;

export interface ExpenseTransaction {
  date: Date;
  description: string;
  category: string;
  amount: number;
  type: TransactionType;
}

export interface MalformedExpenseRow {
  rowNumber: number;
  reason: string;
  date: string;
  description: string;
  category: string;
  amount: string;
  type: string;
}

export interface ExpenseLoadResult {
  transactions: ExpenseTransaction[];
  malformedRows: MalformedExpenseRow[];
  malformedRowsCount: number;
  intentionallySkippedRows: number;
}
