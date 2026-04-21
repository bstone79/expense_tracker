Project Task Tracker

## Snapshot

- Current Phase: Phase 4 - Transactions View
- Current Task (one only): Add free-text description search
- Progress: Phase 1 complete (6 of 6 tasks), Phase 2 complete (3 of 3 tasks)
- Next Task: Wire table to global filter state
- Blockers: None

## Locked Decisions

- CSV path for MVP: `public/expense_data.csv`
- Gemini API key location: backend environment variables only
- PDF extraction failure: show error and require CSV upload
- Upload preview: allow category edits before confirm
- Duplicate default behavior: exclude detected duplicates by default

## Workflow Rules

- Update this file before each coding task
- Begin coding only after explicit approval in chat
- After each coding task, provide manual testing steps
- Keep only one task marked in progress at a time

## In Progress

- [ ] Phase 4 - Transactions View: Add free-text description search

## Next

- [ ] Phase 4 - Transactions View: Wire table to global filter state

## Backlog by Phase

### Phase 1 - Data & Architecture [DONE]

- [x] Set up PapaParse CSV loading (`expenseData.ts`)
- [x] Define core types/data model (`expense.ts`)
- [x] Build baseline aggregation helpers (`expenseAggregations.ts`)
- [x] Migrate CSV from build-time import to runtime fetch from `public/expense_data.csv`
- [x] Add `getSpendByCategory()` aggregation helper
- [x] Add `getMonthlySpendByType()` aggregation helper

### Phase 2 - Filters [DONE]

- [x] Build global filter state (date range, category, type)
- [x] Build Filter Bar component (date pickers, category multi-select, type toggle, reset)
- [x] Wire filter state into all aggregation calls

### Phase 3 - Dashboard Enhancements [ACTIVE]

- [x] Replace "Category Count" KPI with "Top Category"
- [x] Add "Avg. Monthly Spend" KPI
- [x] Wire KPI tiles to filter state
- [x] Wire monthly line chart to filter state and shorten X-axis labels
- [x] Build category breakdown pie/donut chart
- [x] Build credit-card-vs-bank monthly chart
- [x] Improve drilldown UX (visible close action, category at summary level)

### Phase 4 - Transactions View [PLANNED]

- [x] Build sortable, paginated transaction table
- [ ] Add free-text description search
- [ ] Wire table to global filter state

### Phase 5 - Upload Feature [PLANNED]

- [ ] Set up local Express server with `POST /api/append-transactions`
- [ ] Build Upload view (drag/drop + file picker)
- [ ] Implement PDF text extraction (`pdfjs-dist`)
- [ ] Implement Gemini parsing + categorization integration
- [ ] Build preview table with duplicate highlighting
- [ ] Wire confirm-and-append flow to backend
- [ ] Refresh app data after successful upload

### Phase 6 - Polish [PLANNED]

- [ ] Improve error handling (API errors, malformed statements, upload failures)
- [ ] Standardize category colors/badges across views
- [ ] Run end-to-end test with real bank and credit card statements

## Blockers / Decisions

- None currently
