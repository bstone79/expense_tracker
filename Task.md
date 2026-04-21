Project Task Tracker

## Snapshot
- Current Phase: Phase 2 - Filters
- Current Task (one only): Build global filter state (date range, category, payment type)
- Progress: Phase 1 complete (6 of 6 tasks)
- Next Task: Build Filter Bar component (date pickers, category multi-select, type toggle, reset)
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

## Done

### Phase 1 - Data & Architecture (Completed)
- [x] Set up PapaParse CSV loading (`expenseData.ts`)
- [x] Define core types/data model (`expense.ts`)
- [x] Build baseline aggregation helpers (`expenseAggregations.ts`)
- [x] Migrate CSV from build-time import to runtime fetch from `public/expense_data.csv`
- [x] Add `getSpendByCategory()` aggregation helper
- [x] Add `getMonthlySpendByType()` aggregation helper

## In Progress
- [ ] Build global filter state (date range, category, payment type)

## Next
- [ ] Build Filter Bar component (date pickers, category multi-select, type toggle, reset)

## Backlog by Phase

### Phase 2 - Filters
- [ ] Build global filter state (date range, category, type)
- [ ] Build Filter Bar component (date pickers, category multi-select, type toggle, reset)
- [ ] Wire filter state into all aggregation calls

### Phase 3 - Dashboard Enhancements
- [ ] Replace "Category Count" KPI with "Top Category"
- [ ] Add "Avg. Monthly Spend" KPI
- [ ] Wire KPI tiles to filter state
- [ ] Wire monthly line chart to filter state and shorten X-axis labels
- [ ] Build category breakdown pie/donut chart
- [ ] Build credit-card-vs-bank monthly chart
- [ ] Improve drilldown UX (visible close action, category at summary level)

### Phase 4 - Transactions View
- [ ] Build sortable, paginated transaction table
- [ ] Add free-text description search
- [ ] Wire table to global filter state

### Phase 5 - Upload Feature
- [ ] Set up local Express server with `POST /api/append-transactions`
- [ ] Build Upload view (drag/drop + file picker)
- [ ] Implement PDF text extraction (`pdfjs-dist`)
- [ ] Implement Gemini parsing + categorization integration
- [ ] Build preview table with duplicate highlighting
- [ ] Wire confirm-and-append flow to backend
- [ ] Refresh app data after successful upload

### Phase 6 - Polish
- [ ] Improve error handling (API errors, malformed statements, upload failures)
- [ ] Standardize category colors/badges across views
- [ ] Run end-to-end test with real bank and credit card statements

## Blockers / Decisions
- None currently
