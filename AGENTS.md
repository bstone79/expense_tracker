# Agent Workflow Rules

These rules apply to all coding sessions in this repository.

1. Do not start coding until the user explicitly approves the proposed step plan.
2. Implement only the approved step scope; avoid unapproved extra work.
3. After implementation, pause for user testing and approval.
4. Only after user approval, update `Task.md` status for that step.
5. Commit the `Task.md` update to the active phase branch after approval.
6. Keep exactly one task marked as in progress at any time.
7. Do not open, merge, or push PR-related changes unless explicitly requested.
8. Commit and push only files requested by the user for that step.
9. Ask the user if they would like to push the changes to the git repo before asking to move on to the next step.
10. Keep responses high-level when the user asks for high-level plans.
11. After each step code commit, immediately update and separately commit `Task.md` before moving to the next step.
12. If unexpected repo changes appear, stop and ask how to proceed.
