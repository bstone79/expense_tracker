Project Task Tracker

## Snapshot

- Current Phase: Phase 5 - Upload Feature
- Current Task (one only): Implement Gemini parsing + categorization integration
- Progress: Phase 1 complete (6 of 6 tasks), Phase 2 complete (3 of 3 tasks), Phase 3 complete (7 of 7 tasks), Phase 4 complete (3 of 3 tasks)
- Next Task: Build preview table with duplicate highlighting
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

- [ ] Phase 5 - Upload Feature: Implement Gemini parsing + categorization integration

## Next

- [ ] Phase 5 - Upload Feature: Build preview table with duplicate highlighting

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

### Phase 3 - Dashboard Enhancements [DONE]

- [x] Replace "Category Count" KPI with "Top Category"
- [x] Add "Avg. Monthly Spend" KPI
- [x] Wire KPI tiles to filter state
- [x] Wire monthly line chart to filter state and shorten X-axis labels
- [x] Build category breakdown pie/donut chart
- [x] Build credit-card-vs-bank monthly chart
- [x] Improve drilldown UX (visible close action, category at summary level)

### Phase 4 - Transactions View [DONE]

- [x] Build sortable, paginated transaction table
- [x] Add free-text description search
- [x] Wire table to global filter state

### Phase 5 - Upload Feature [ACTIVE]

- [x] Set up local Express server with `POST /api/append-transactions`
- [x] Build Upload view (drag/drop + file picker)
- [x] Implement PDF text extraction (`pdfjs-dist`)
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
