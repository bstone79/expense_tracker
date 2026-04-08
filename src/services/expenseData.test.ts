import { describe, expect, it } from "vitest";
import { parseExpenseCsv } from "./expenseData";

const validCsv = `Date,Description,Category,Amount,Type
02/01/2026,Coffee,Dining,5.5,Credit Card
02/02/2026,Power Bill,Utilities,120.25,Bank`;

describe("parseExpenseCsv", () => {
  it("parses valid rows with typed values", () => {
    const result = parseExpenseCsv(validCsv);

    expect(result.skippedRows).toBe(0);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.amount).toBe(5.5);
    expect(result.transactions[0]?.date).toBeInstanceOf(Date);
  });

  it("throws when required columns are missing", () => {
    const invalidSchemaCsv = `Date,Description,Category,Type
02/01/2026,Coffee,Dining,Credit Card`;

    expect(() => parseExpenseCsv(invalidSchemaCsv)).toThrow("Missing columns: Amount");
  });

  it("skips malformed rows", () => {
    const mixedCsv = `Date,Description,Category,Amount,Type
02/01/2026,Coffee,Dining,5.5,Credit Card
bad-date,Broken,Dining,4.2,Credit Card
02/03/2026,,Dining,9.1,Credit Card`;

    const result = parseExpenseCsv(mixedCsv);
    expect(result.transactions).toHaveLength(1);
    expect(result.skippedRows).toBe(2);
  });

  it("excludes transfer to credit card payment rows", () => {
    const csvWithTransfer = `Date,Description,Category,Amount,Type
02/01/2026,Transfer to CC ****1234,Transfer,500,Bank
02/02/2026,Coffee,Dining,6.5,Credit Card`;

    const result = parseExpenseCsv(csvWithTransfer);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.description).toBe("Coffee");
    expect(result.skippedRows).toBe(1);
  });

  it("excludes transfer to savings rows", () => {
    const csvWithSavingsTransfer = `Date,Description,Category,Amount,Type
02/01/2026,Transfer to SV 001122,Transfer,300,Bank
02/02/2026,Groceries,Groceries,42.5,Credit Card`;

    const result = parseExpenseCsv(csvWithSavingsTransfer);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.description).toBe("Groceries");
    expect(result.skippedRows).toBe(1);
  });
});
