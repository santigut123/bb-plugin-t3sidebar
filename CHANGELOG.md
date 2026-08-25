# Changelog

## Unreleased

### Added

- Always-visible named workspace tabs with explicit project and thread
  membership, plus create, edit, and delete controls. Projects can be reused
  across workspaces without pulling every active thread into each one, and
  clicking the selected workspace returns to the all-threads view.
- Thread context menus can add or remove an individual thread directly.
- The Settled shelf now has a right-click action to archive all settled threads.

### Changed

- When a thread starts working, its parent/child family moves to the top of its
  shelf and keeps that position after finishing. Families containing a pinned
  thread remain together above the inbox.
- Settling a parent thread now settles its full child subtree with it.
- Child threads now remain visible directly beneath their parent as staggered,
  collapsible sidebar rows while retaining the parent and children header
  shortcuts.
- Restored the previous status presentation: compact Failed, Input, Done,
  Monitoring, and activity indicators, including the static dashed Working
  circle.
- Working threads again show a live elapsed time for the current turn.

### Removed

- The project scope picker beneath the workspace bar. The inbox now always
  spans every project allowed by the selected workspace's thread membership.

### Fixed

- New threads now appear automatically in the workspace that was selected
  when they were created, and failed automatic additions retry after workspace
  synchronization resumes.
- Child threads inherit every workspace containing their parent, including
  descendants created during root-assignment races.
- Workspace tabs now use a compact filled selection state instead of blue
  border bars beside their labels.
- Very short turns now still bump their thread family after the turn finishes.
- Workspaces can now be created empty, without selecting projects or threads.
- Workspace membership updates now compose safely across multiple bb tabs and
  report failures without closing the thread context menu.
- Deleting one workspace no longer deselects a different active workspace.
- Workspace filters and the workspace editor now expose correct toggle and
  modal keyboard semantics, including focus restoration when the editor closes.

## 0.2.0 - 2026-08-20

### Added

- Compact visible labels beside colored thread status icons, including
  Monitoring, Working, Input needed, Error, Success, Workflow, Agent, Command,
  Planning, Goal, and Draft.
