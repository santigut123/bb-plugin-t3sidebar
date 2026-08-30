# Implementation Plan: Hide Workspace Entries From All Projects

## Overview

Extend persisted workspace state with an All projects visibility flag, expose
one focused mutation through the existing workspace API, and use it for both
inbox filtering and the workspace context-menu cue.

## Architecture Decisions

- Store the flag on each workspace so it follows the workspace across clients
  and survives reloads.
- Compute the hidden thread-id union only in the All projects view; selected
  workspace filtering remains unchanged.
- Keep the context-menu item open while the mutation is pending so failures
  can be reported in place.

## Task List

### Phase 1: Persistent behavior

- [x] Add failing RPC coverage for toggling workspace visibility.
- [x] Add the migration, contract field, mutation, and client API.

### Checkpoint: Persistence

- [x] `npm test -- src/server.test.ts`
- [x] `npm run typecheck`

### Phase 2: User interaction

- [x] Add failing component coverage for hide, cue, selected view, and show.
- [x] Add the context-menu toggle and All projects filtering.
- [x] Document the user-facing behavior.

### Checkpoint: Complete

- [x] `npm test`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Review diff for accessibility, scope, and migration safety.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A thread belongs to multiple hidden workspaces | Ambiguous visibility | Hide on union membership, as specified |
| Editing a workspace resets visibility | Lost preference | Keep visibility outside the editor save input |
| Hidden status is conveyed only by color | Accessibility failure | Add visible glyph/text semantics and an accessible label |

## Open Questions

None.
