Suggested Task Breakdown
Tasks are marked to distinguish new work from enhancements to existing code.

Locked implementation decisions (from PRD):
- CSV path for MVP: `public/expense_data.csv`
- Claude API key location: backend env vars only
- PDF parse failure behavior: show error and require CSV upload
- Upload preview: allow category edits before confirm
- Duplicate handling default: exclude detected duplicates by default

Execution workflow:
- Update this task file and present next task in chat before coding
- Begin coding only after explicit user approval
- After each coding task, provide manual testing steps for user validation

Phase 1 — Data & Architecture (Mostly Done)

✅ Set up PapaParse CSV loading — Complete in expenseData.ts
✅ Type definitions and data model — Complete in expense.ts
✅ Aggregation utilities — Complete in expenseAggregations.ts
🔲 Add getSpendByCategory() aggregation to expenseAggregations.ts
🔲 Add getMonthlySpendByType() aggregation for Credit Card vs. Bank chart
🔲 Migrate CSV from build-time import to runtime fetch — use `public/expense_data.csv` and replace ?raw import with a fetch() call so the app reads fresh data without rebuilding (prerequisite for the upload feature)

Phase 2 — Filters 7. 🔲 Build global filter state (date range, category, type) — React context or lifted state 8. 🔲 Build Filter Bar component (date pickers, category multi-select, type toggle, reset button) 9. 🔲 Wire filter state into all aggregation calls
Phase 3 — Dashboard Enhancements 10. 🔲 Update KPI tiles: replace "Category Count" with "Top Category", add "Avg. Monthly Spend" 11. 🔲 Wire KPI tiles to filter state 12. ✅ Monthly line chart — built; 🔲 wire to filter state and fix X-axis label formatting 13. 🔲 Build Category breakdown pie/donut chart 14. 🔲 Build Credit Card vs. Bank stacked bar chart 15. 🔲 Improve drilldown UX: add visible close button, category column on group rows
Phase 4 — Transactions View 16. 🔲 Build sortable, paginated transaction table (separate from drilldown) 17. 🔲 Add free-text search by description 18. 🔲 Wire table to global filter state
Phase 5 — Upload Feature 19. 🔲 Set up local Express server alongside Vite with POST /api/append-transactions endpoint 20. 🔲 Build file upload UI (drag-and-drop + file picker) in new Upload view 21. 🔲 Implement PDF text extraction (pdfjs-dist) 22. 🔲 Implement Claude API integration for transaction parsing and categorization 23. 🔲 Build transaction preview table with duplicate highlighting 24. 🔲 Wire confirmation flow to backend endpoint 25. 🔲 Refresh app data after successful upload (re-fetch CSV)
Phase 6 — Polish 26. 🔲 Error handling: API errors, malformed statements, upload failures 27. 🔲 Category color coding and badge styling (consistent palette across all charts and tables) 28. 🔲 End-to-end test with a real credit card and bank statement
