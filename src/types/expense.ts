export type TransactionType = "Credit Card" | "Bank" | string;

export interface ExpenseTransaction {
  date: Date;
  description: string;
  category: string;
  amount: number;
  type: TransactionType;
}

export interface ExpenseLoadResult {
  transactions: ExpenseTransaction[];
  skippedRows: number;
}
