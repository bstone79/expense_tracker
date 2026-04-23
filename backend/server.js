import express from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_COLUMNS = ["Date", "Description", "Category", "Amount", "Type"];
const HEADER_ROW = REQUIRED_COLUMNS.join(",");
const DEFAULT_PORT = 8787;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_PATH = path.resolve(__dirname, "../public/expense_data.csv");

const app = express();
app.use(express.json({ limit: "1mb" }));

function isValidMmDdYyyy(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) {
    return false;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function escapeCsvCell(value) {
  const asString = String(value ?? "");
  if (asString.includes(",") || asString.includes('"') || asString.includes("\n")) {
    return `"${asString.replaceAll('"', '""')}"`;
  }

  return asString;
}

function formatAmount(value) {
  const num = Number(value);
  return num.toFixed(2);
}

function validateTransaction(input, index) {
  if (!input || typeof input !== "object") {
    return `transactions[${index}] must be an object.`;
  }

  const date = String(input.Date ?? "").trim();
  const description = String(input.Description ?? "").trim();
  const category = String(input.Category ?? "").trim();
  const type = String(input.Type ?? "").trim();
  const amount = Number(input.Amount);

  if (!isValidMmDdYyyy(date)) {
    return `transactions[${index}].Date must be MM/DD/YYYY.`;
  }

  if (!description) {
    return `transactions[${index}].Description is required.`;
  }

  if (!category) {
    return `transactions[${index}].Category is required.`;
  }

  if (!Number.isFinite(amount) || amount < 0) {
    return `transactions[${index}].Amount must be a non-negative number.`;
  }

  if (!type) {
    return `transactions[${index}].Type is required.`;
  }

  return null;
}

async function ensureCsvHasHeader() {
  const csvText = await fs.readFile(CSV_PATH, "utf8");
  const firstLine = csvText.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (firstLine !== HEADER_ROW) {
    throw new Error(`CSV header mismatch at ${CSV_PATH}. Expected: ${HEADER_ROW}`);
  }
}

app.post("/api/append-transactions", async (req, res) => {
  const { transactions } = req.body ?? {};
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({
      error: "Request body must include a non-empty transactions array.",
    });
  }

  for (const [index, txn] of transactions.entries()) {
    const error = validateTransaction(txn, index);
    if (error) {
      return res.status(400).json({ error });
    }
  }

  try {
    await ensureCsvHasHeader();

    const rows = transactions.map((txn) =>
      [
        String(txn.Date).trim(),
        String(txn.Description).trim(),
        String(txn.Category).trim(),
        formatAmount(txn.Amount),
        String(txn.Type).trim(),
      ]
        .map(escapeCsvCell)
        .join(","),
    );

    const payload = `\n${rows.join("\n")}`;
    await fs.appendFile(CSV_PATH, payload, "utf8");

    return res.status(200).json({
      appendedCount: rows.length,
      csvPath: CSV_PATH,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return res.status(500).json({ error: message });
  }
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(DEFAULT_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Upload backend listening on http://localhost:${DEFAULT_PORT}`);
});
