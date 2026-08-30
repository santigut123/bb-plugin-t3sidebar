# Hide Workspace Entries: Tasks

## Task 1: Persist workspace visibility

**Description:** Add a backward-compatible workspace column and focused RPC
mutation for the All projects visibility preference.

**Acceptance criteria:**

- [x] New and existing workspaces default to visible.
- [x] Toggling visibility persists and publishes the workspace channel.
- [x] Workspace edits and membership changes preserve the flag.

**Verification:**

- [x] `npm test -- src/server.test.ts`
- [x] `npm run typecheck`

**Dependencies:** None

**Files likely touched:** `src/server.ts`, `src/server.test.ts`,
`src/useWorkspaces.ts`

**Estimated scope:** Medium

## Task 2: Filter and cue hidden workspaces

**Description:** Add the right-click toggle, hidden-state cue, and All projects
thread filtering while leaving selected workspace views intact.

**Acceptance criteria:**

- [x] Hide/show actions update the list immediately after refresh.
- [x] Hidden tabs are visibly and accessibly marked only in All projects.
- [x] Selecting a workspace shows its complete membership.

**Verification:**

- [x] `npm test -- src/ThreadInbox.test.tsx`
- [x] `npm test`
- [x] `npm run typecheck`
- [x] `npm run build`

**Dependencies:** Task 1

**Files likely touched:** `src/WorkspaceTabs.tsx`, `src/ThreadInbox.tsx`,
`src/ThreadInbox.test.tsx`, `README.md`, `CHANGELOG.md`

**Estimated scope:** Medium
