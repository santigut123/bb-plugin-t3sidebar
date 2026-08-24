# Changelog

## Unreleased

### Added

- Always-visible named workspace tabs with explicit project and thread
  membership, plus create, edit, and delete controls. Projects can be reused
  across workspaces without pulling every active thread into each one, and
  clicking the selected workspace returns to the all-threads view.
- The Settled shelf now has a right-click action to archive all settled threads.

### Changed

- Settling a parent thread now settles its full child subtree with it.
- Child threads now remain visible directly beneath their parent as staggered,
  collapsible sidebar rows while retaining the parent and children header
  shortcuts.
- Restored the previous status presentation: compact Failed, Input, Done,
  Monitoring, and activity indicators, including the static dashed Working
  circle.
- Working threads again show a live elapsed time for the current turn.

## 0.2.0 - 2026-08-20

### Added

- Compact visible labels beside colored thread status icons, including
  Monitoring, Working, Input needed, Error, Success, Workflow, Agent, Command,
  Planning, Goal, and Draft.
