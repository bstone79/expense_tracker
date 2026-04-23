Product Requirements Document
Home Expense Tracker — MVP
Version: 1.0
Date: April 21, 2026
Author: bstone79
Repository: https://github.com/bstone79/expense_tracker

1. Overview
   1.1 Purpose
   The Home Expense Tracker is a locally-hosted personal web application that allows the homeowner to visualize, explore, and manage household expenses. Expense data is stored in and read from a .csv file on the local filesystem. The user can upload new financial statements (credit card or bank) to append new transaction data to that file.
   1.2 Background
   The project is being developed using Cursor IDE and has a working foundation already in place. The existing codebase is a React + TypeScript application scaffolded with Vite, using Recharts for visualization and PapaParse for CSV parsing. A functional dashboard is already rendering with real data. This PRD defines what remains to be built to reach MVP.
   1.3 Goals

Provide a clear visual summary of home expenses over time
Allow the user to drill into expense data by category, date range, and payment type
Support ingestion of new transaction data from uploaded financial statements
Run entirely on localhost; no cloud hosting, authentication, or multi-user support is required

1.4 Non-Goals (MVP)

Multi-user access or authentication
Cloud deployment or remote access
Budget setting, limits, or alerts
Recurring transaction detection or subscription tracking
Export to formats other than CSV
Editing or deleting individual transactions via the UI

1.5 Current State (As-Built)
The following functionality is already implemented and should not be re-built:
Data Layer (Complete)

src/types/expense.ts — Type definitions for ExpenseTransaction, MalformedExpenseRow, and ExpenseLoadResult
src/services/expenseData.ts — Full CSV loading and parsing pipeline using PapaParse. Handles:

Required column validation
Date parsing and validation (MM/DD/YYYY)
Negative amount rejection
Intentional skipping of internal transfer rows (transfer to cc, transfer to sv)
Malformed row collection with row numbers and reasons

src/utils/expenseAggregations.ts — Utility functions including getDashboardSummary(), getMonthlyTrend(), and formatCurrency()

UI Layer (Partial — in src/App.tsx)

KPI tiles: Total Spend, Transaction Count, Category Count
Monthly Spending Trend: Line chart (Recharts LineChart) with click-to-drill-down
Month drilldown: Clicking a month on the chart reveals a grouped transaction table, expandable by description, showing individual transaction detail rows (date, category, type)
Malformed row warnings: Displays a warning card listing any rows that failed parsing
Loading and error states: Handled with early returns

What the CSV Import Currently Does
The CSV is imported at build time via Vite's ?raw import (import csvRaw from "../../expense_data.csv?raw"). This means the data is bundled into the app — there is no runtime file read. Any changes to the CSV require a rebuild. This has implications for the upload feature (see Section 7).

2. Users
   2.1 Primary User
   The Homeowner — a single user running the application on their own machine. They are comfortable with basic technology but are not a data analyst. They want to understand where their money is going without manually reviewing bank statements.
   2.2 User Goals

Quickly see a summary of their expenses at a glance
Understand spending trends over time
Identify which categories consume the most budget
Keep their expense data up to date by uploading new statements monthly

3. Data Model
   3.1 CSV Schema
   The application uses a single flat .csv file as its data backend. Based on the supplied data file, the schema is:
   ColumnTypeDescriptionExampleDatestring (MM/DD/YYYY)Transaction date02/26/2026DescriptionstringMerchant or payee nameSTOP & SHOP 562Categorystring (enum)Spending categoryGroceriesAmountfloatTransaction amount (positive = expense)209.25Typestring (enum)Payment methodCredit Card or Bank
   3.2 Category Values
   The current dataset contains the following 7 categories, which should be treated as the defined enum for MVP:

Shopping
Utilities
Dining
Groceries
Entertainment
Transportation
Housing

3.3 Payment Type Values

Credit Card
Bank

3.4 Data Characteristics

The sample dataset spans January 1, 2025 – December 31, 2025 (full calendar year)
Contains 1,592 transactions
Transaction amounts range from $0.06 to $10,000.00, with a median of ~$29.47
High standard deviation ($688) indicates a mix of routine small purchases and large one-time payments (e.g., mortgage, utility bills)

3.5 CSV File Location
The application should reference a single, configurable path to the CSV file on the local filesystem. For MVP, a hardcoded relative path is acceptable (e.g., ./data/expense_data.csv).

4. Tech Stack
   Based on the existing repository, the confirmed tech stack is:
   LayerTechnologyStatusFrameworkReact 18+✅ In useLanguageTypeScript✅ In useBuild ToolVite✅ In useChartingRecharts✅ In use (LineChart)CSV ParsingPapaParse✅ In useStylingCSS (App.css / index.css)✅ In useStatement ParsingDeterministic parser rules (regex/template-based)🔲 To be addedLocal BackendNode.js + Express🔲 To be added (required for upload feature)PDF Extractionpdfjs-dist🔲 To be added

5. Application Structure
   5.1 Layout
   The application is a single-page application (SPA) with a persistent top navigation bar and a main content area. No routing framework is required for MVP.
   ┌─────────────────────────────────────────────────┐
   │ Header / Nav: Title + View Tabs │
   ├─────────────────────────────────────────────────┤
   │ │
   │ Filter Bar (Date Range, Category, Type) │
   │ │
   ├─────────────────────────────────────────────────┤
   │ │
   │ Main Content Area (Chart or Table View) │
   │ │
   └─────────────────────────────────────────────────┘
   │ Upload Statement Button (persistent footer) │
   └─────────────────────────────────────────────────┘
   5.2 Views
   The app contains three primary views, toggled via tabs:

Dashboard — Summary charts and KPI tiles (default view on load)
Transactions — Paginated, filterable table of all transactions
Upload — Interface for uploading and processing new financial statements

6. Feature Requirements
   6.1 Dashboard View
   6.1.1 KPI Summary Tiles
   Three KPI tiles are already rendered: Total Spend, Transaction Count, and Category Count. The following changes are needed:

Replace "Category Count" with "Top Category" — the category with the highest total spend is more useful than a count of 7 (which never changes)
Add "Avg. Monthly Spend" as a fourth tile — total spend divided by number of months in the selected date range
Tiles should update dynamically when filters are applied (requires filter state, see 6.2)

6.1.2 Primary Chart — Monthly Spending Over Time
A line chart is already implemented using Recharts, displaying total spend per month with click-to-drilldown. The following enhancements are needed:

X-axis labels should display abbreviated month names (e.g., "Jan 25") instead of raw YYYY-MM keys — the current formatter outputs the full month+year string which may be too wide at small widths
The chart should respond to the active filter state (category, type, date range) once filters are added
Clicking a point already works and triggers the month drilldown — this behavior should be preserved

6.1.3 Secondary Chart — Spending by Category

A pie chart or donut chart showing total spend per category as a proportion of total
Displays all 7 categories with distinct colors
Hovering shows category name, total amount, and percentage
Clicking a category segment should apply a category filter to the Transactions view

6.1.4 Tertiary Chart — Credit Card vs. Bank Breakdown

A stacked bar chart or grouped bar chart showing monthly spend split by Type
Allows the user to see which months had heavier credit card vs. direct bank spend
This chart does not yet exist and needs to be built

6.5 Month Drilldown
The month drilldown is already implemented and works well. When a user clicks a month on the line chart, a grouped transaction table appears below the chart showing:

Rows grouped by normalized description (case-insensitive, whitespace-collapsed)
Each group shows description, entry count, and total amount
Groups are expandable to show individual transactions with date, category, and type

The following enhancements are needed:

Add a category column to the summary group row (or a breakdown badge) so the user can see category at a glance without expanding
Add a "Close" button or click-again-to-close affordance that is more visible than the current toggle (clicking the same month on the chart again closes it, but this is not obvious)
The drilldown table should also respect active filters

6.2 Filter Bar
The filter bar is persistent across Dashboard and Transactions views. Filters include:

Date Range — Start date and end date pickers (defaults to full dataset range on load)
Category — Multi-select dropdown with all 7 categories (all selected by default)
Payment Type — Toggle/radio for All, Credit Card, or Bank
Reset Filters button — Resets all filters to defaults

Filters must be applied reactively — charts and tables update immediately when filters change.
6.3 Transactions View
6.3.1 Transaction Table
A paginated table displaying individual transactions with the following columns:
ColumnNotesDateFormatted as MM/DD/YYYYDescriptionFull merchant nameCategoryDisplayed as a color-coded badgeAmountFormatted as USD (e.g., $209.25)TypeDisplayed as a small icon/badge (CC or Bank)

Default sort: Date descending (most recent first)
User can click column headers to sort ascending/descending
Pagination: 25 rows per page with prev/next controls
Total row count and current range displayed (e.g., "Showing 1–25 of 312")

6.3.2 Search
A free-text search field above the table that filters rows by Description (case-insensitive, substring match).
6.4 Data Loading

On application load, the app reads the CSV file and parses it using PapaParse
A loading state (spinner or skeleton) is displayed while data is being read
If the CSV cannot be loaded or is malformed, an error message is displayed with instructions
For local-only use, the CSV path can be served via a simple Express or Vite static file middleware

7. Statement Upload Feature
   This is the most complex feature of the MVP. The user uploads a financial statement (PDF or CSV) from their bank or credit card issuer, the application parses it and maps transactions to the standard schema, then appends the new rows to the existing expense_data.csv.
   7.1 Upload Flow

User navigates to the Upload view
User selects or drags-and-drops a statement file (PDF or CSV)
The app displays a preview of the extracted/parsed transactions before committing
User reviews the mapped data, confirms, and the rows are appended to the CSV
The Dashboard and Transactions views refresh to include the new data

7.2 Supported Statement Formats (MVP)

Credit Card statement — PDF or CSV export from a major issuer (e.g., Chase, Citi, Amex)
Bank statement — PDF or CSV export from a major bank (e.g., Chase, Bank of America)

7.3 Parsing Strategy — Deterministic Template Parsing
For MVP, the user will upload statements from one known bank format and one known credit card format. The application should use deterministic parser rules to map uploaded statement content to the standard schema.
Flow:

If the uploaded file is a PDF, extract text client-side using a library such as pdf.js or pdfjs-dist
If the uploaded file is a CSV, read it as plain text
Run parser selection logic to identify the known statement template (Bank or Credit Card) and route to the correct parser
Apply deterministic extraction rules (e.g., regex and line-pattern matching) to:

Identify transaction rows
Extract date, description, and amount
Assign each transaction a Category from the defined enum (see Section 3.2)
Assign a Type of Credit Card or Bank based on the source document
Return results as a JSON array matching the CSV schema

Display the returned transactions in a preview table before the user confirms
On confirmation, serialize the transactions back to CSV rows and append to expense_data.csv via a local file write (requires a small local Node/Express backend endpoint)

Deterministic Parsing Requirements:

Parser logic must enforce the target schema: { Date, Description, Category, Amount, Type }
Date format must be normalized to MM/DD/YYYY in the output
Amounts must be positive numbers (credits/refunds may be excluded or flagged)
If the uploaded statement does not match a supported template, the app must show a clear unsupported-format error and block append

7.4 Duplicate Detection
Before appending, the app should check for potential duplicates based on matching Date + Description + Amount. If duplicates are found, they should be highlighted in the preview table and the user should have the option to exclude them before confirming.
7.5 Local Backend Requirement
Because browser-based JavaScript cannot write to the local filesystem directly, a minimal Express.js server is needed alongside the Vite dev server. It should expose a single endpoint:

POST /api/append-transactions — accepts an array of transaction objects, validates the schema, and appends them to the CSV file

8. Non-Functional Requirements
   RequirementDetailPerformanceDashboard should load and render within 2 seconds for the full 1,592-row datasetLocal-onlyNo data should be sent to any external service for statement parsing in MVPPrivacyStatement parsing should run locally using deterministic parser rulesResilienceMalformed rows in the CSV should be skipped with a warning, not crash the appResponsivenessApplication should be usable on a standard desktop browser at 1280px+ width; mobile is not required for MVP

9. Out of Scope for MVP
   The following features are explicitly deferred to future versions:

Editing or deleting existing transactions in the UI
Setting spending budgets or limits per category
Email or push notifications
Multi-year comparisons or date range analytics beyond the current dataset
Dark mode
Export to Excel or PDF
Authentication / password protection
Mobile-responsive design

10. Resolved Product Decisions (Locked)

The following decisions are confirmed for MVP and should be treated as requirements:

CSV path strategy
- Use `public/expense_data.csv` as the locked MVP source path.
- Runtime reads should fetch this file so app data can refresh without rebuild.

Statement parser strategy
- For MVP, parsing should use deterministic parser rules for known Bank and Credit Card statement templates.
- Gemini API integration is deferred and not required for current MVP scope.

PDF extraction failure behavior
- If uploaded PDF text extraction fails (for example, scanned/image PDFs), show a clear error message and require CSV upload instead.
- OCR is explicitly out of scope for MVP.

Category correction in upload preview
- Upload preview must allow user edits to category values before confirmation and append.

Duplicate detection default behavior
- Potential duplicates (matching Date + Description + Amount) should be excluded by default.
- User can review and change inclusion before final confirmation.

11. Execution Protocol (Build Process)

- Before each coding task, update `Task.md` and confirm the selected next task in chat.
- Coding begins only after explicit user approval in chat.
- After each completed coding task, provide a focused manual test checklist for the user to run.
