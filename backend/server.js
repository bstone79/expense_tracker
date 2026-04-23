import express from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const REQUIRED_COLUMNS = ["Date", "Description", "Category", "Amount", "Type"];
const HEADER_ROW = REQUIRED_COLUMNS.join(",");
const DEFAULT_PORT = 8787;
const ALLOWED_TYPES = new Set(["Bank", "Credit Card"]);
const ALLOWED_CATEGORIES = new Set([
  "Groceries",
  "Utilities",
  "Entertainment",
  "Transportation",
  "Housing",
  "Dining",
  "Shopping",
]);

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

function formatAmount(value) {
  const num = Number(value);
  return num.toFixed(2);
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

function extractGeminiText(responseBody) {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const candidates = Array.isArray(responseBody.candidates) ? responseBody.candidates : [];
  const firstCandidate = candidates[0];
  const parts = firstCandidate?.content?.parts;

  if (!Array.isArray(parts)) {
    return null;
  }

  const textPart = parts.find((part) => typeof part?.text === "string");
  return textPart?.text ?? null;
}

function validateParsedTransaction(input, index, selectedType) {
  if (!input || typeof input !== "object") {
    return `Parsed transaction at index ${index} must be an object.`;
  }

  const date = normalizeWhitespace(input.Date);
  const description = normalizeWhitespace(input.Description);
  const category = normalizeWhitespace(input.Category);
  const type = normalizeWhitespace(input.Type);
  const amount = Number(input.Amount);

  if (!isValidMmDdYyyy(date)) {
    return `Parsed transaction at index ${index} has invalid Date; expected MM/DD/YYYY.`;
  }

  if (!description) {
    return `Parsed transaction at index ${index} is missing Description.`;
  }

  if (!ALLOWED_CATEGORIES.has(category)) {
    return `Parsed transaction at index ${index} has invalid Category.`;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return `Parsed transaction at index ${index} has invalid Amount; expected positive number.`;
  }

  if (!ALLOWED_TYPES.has(type)) {
    return `Parsed transaction at index ${index} has invalid Type.`;
  }

  if (type !== selectedType) {
    return `Parsed transaction at index ${index} must have Type "${selectedType}".`;
  }

  return null;
}

function buildGeminiPrompt({ statementType, statementText }) {
  return [
    "You are extracting spend transactions from a financial statement.",
    `The user selected statement type: ${statementType}.`,
    "",
    "Return only a JSON array. Do not return markdown, explanations, or code fences.",
    "Every element in the array must follow this exact schema:",
    '{ "Date": "MM/DD/YYYY", "Description": "string", "Category": "Groceries|Utilities|Entertainment|Transportation|Housing|Dining|Shopping", "Amount": number, "Type": "Bank|Credit Card" }',
    "",
    "Rules:",
    "1) Include only spending transactions.",
    "2) Exclude payments, credits, refunds, account transfers, and balance-forward rows.",
    "3) Date must be MM/DD/YYYY.",
    "4) Amount must be a positive number (no currency symbol).",
    "5) Category must be exactly one of: Groceries, Utilities, Entertainment, Transportation, Housing, Dining, Shopping.",
    `6) Type must be exactly "${statementType}" for every row.`,
    "7) Be exhaustive: include every spend/debit transaction line that qualifies under these rules.",
    "8) Do not omit rows because the merchant or category is uncertain; choose the closest allowed category.",
    "9) If multiple transactions occur on the same date with similar descriptions, keep them as separate rows.",
    "",
    "Statement text to parse:",
    statementText,
  ].join("\n");
}

async function ensureCsvHasHeader() {
  const csvText = await fs.readFile(CSV_PATH, "utf8");
  const firstLine = csvText.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (firstLine !== HEADER_ROW) {
    throw new Error(`CSV header mismatch at ${CSV_PATH}. Expected: ${HEADER_ROW}`);
  }

  return {
    newline: csvText.includes("\r\n") ? "\r\n" : "\n",
    hasTrailingNewline: csvText.endsWith("\n"),
  };
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
    const csvFormat = await ensureCsvHasHeader();

    const rows = transactions.map((txn) => ({
      Date: String(txn.Date).trim(),
      Description: String(txn.Description).trim(),
      Category: String(txn.Category).trim(),
      Amount: formatAmount(txn.Amount),
      Type: String(txn.Type).trim(),
    }));
    const serializedRows = Papa.unparse(rows, {
      columns: REQUIRED_COLUMNS,
      header: false,
      newline: csvFormat.newline,
    });

    const prefix = csvFormat.hasTrailingNewline ? "" : csvFormat.newline;
    const payload = `${prefix}${serializedRows}`;
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

app.post("/api/parse-statement", async (req, res) => {
  const statementType = normalizeWhitespace(req.body?.statementType);
  const statementText = normalizeWhitespace(req.body?.statementText);
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  if (!ALLOWED_TYPES.has(statementType)) {
    return res.status(400).json({
      error: 'statementType must be either "Bank" or "Credit Card".',
    });
  }

  if (!statementText) {
    return res.status(400).json({
      error: "statementText is required.",
    });
  }

  if (!apiKey) {
    return res.status(500).json({
      error: "Server is missing GEMINI_API_KEY.",
    });
  }

  try {
    const prompt = buildGeminiPrompt({ statementType, statementText });
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const upstreamText = await geminiResponse.text();
      return res.status(502).json({
        error: `Gemini request failed (${geminiResponse.status}).`,
        details: upstreamText.slice(0, 500),
      });
    }

    const geminiBody = await geminiResponse.json();
    const rawText = extractGeminiText(geminiBody);
    if (!rawText) {
      return res.status(502).json({
        error: "Gemini response did not include text output.",
      });
    }

    let parsedTransactions;
    try {
      parsedTransactions = JSON.parse(rawText);
    } catch {
      return res.status(502).json({
        error: "Gemini returned invalid JSON.",
      });
    }

    if (!Array.isArray(parsedTransactions)) {
      return res.status(502).json({
        error: "Gemini output must be a JSON array.",
      });
    }

    const normalizedTransactions = parsedTransactions.map((row) => ({
      Date: normalizeWhitespace(row?.Date),
      Description: normalizeWhitespace(row?.Description),
      Category: normalizeWhitespace(row?.Category),
      Amount: Number(row?.Amount),
      Type: normalizeWhitespace(row?.Type),
    }));

    for (const [index, transaction] of normalizedTransactions.entries()) {
      const validationError = validateParsedTransaction(transaction, index, statementType);
      if (validationError) {
        return res.status(502).json({ error: validationError });
      }
    }

    return res.status(200).json({
      transactions: normalizedTransactions,
      parsedCount: normalizedTransactions.length,
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
