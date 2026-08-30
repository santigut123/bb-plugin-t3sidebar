# Spec: Hide Workspace Entries From All Projects

## Objective

Let users right-click a workspace and hide every thread assigned to it from
the unfiltered **All projects** inbox. A hidden workspace remains selectable,
and selecting it still shows its complete membership.

## Tech Stack

- React 19 and TypeScript for the sidebar UI
- Radix Context Menu for workspace actions
- bb plugin RPC, realtime, and SQLite storage for persistent workspace state
- Vitest and Testing Library for backend and component coverage

## Commands

- Focused UI test: `npm test -- src/ThreadInbox.test.tsx`
- Focused backend test: `npm test -- src/server.test.ts`
- Full test suite: `npm test`
- Type checking: `npm run typecheck`
- Build: `npm run build`

## Project Structure

- `src/server.ts`: workspace persistence and RPC contract
- `src/useWorkspaces.ts`: client workspace state and mutations
- `src/WorkspaceTabs.tsx`: workspace tab and context-menu UI
- `src/ThreadInbox.tsx`: All projects and selected-workspace filtering
- `src/*.test.tsx`, `src/*.test.ts`: component and backend tests

## Code Style

Follow the existing direct, typed React and RPC patterns. Prefer explicit
workspace fields and focused callbacks over introducing another client store.

```ts
const hiddenThreadIds = new Set(
  workspaces.filter((workspace) => workspace.hiddenFromAll)
    .flatMap((workspace) => workspace.threadIds),
);
```

## Testing Strategy

- Backend integration coverage proves the hidden flag defaults to false,
  persists, and publishes a workspace refresh signal.
- Component coverage proves the right-click action filters All projects,
  exposes an accessible visual cue, reverses the filter, and does not affect a
  selected workspace view.
- The full suite, type checker, and plugin build guard regressions.

## Boundaries

- Always: keep the workspace tab visible and the action reversible.
- Always: hide a thread from All projects if it belongs to any hidden workspace.
- Ask first: change how workspace membership itself is defined.
- Never: hide threads while that workspace is selected.
- Never: add a dependency for this feature.

## Success Criteria

- A workspace context menu toggles between **Hide from All projects** and
  **Show in All projects**.
- Hidden workspace threads do not appear when no workspace is selected.
- Selecting any workspace continues to show that workspace's full membership.
- A hidden workspace has a visible and screen-reader-readable cue in the
  All projects view only.
- The hidden state persists in the plugin database and synchronizes through
  the existing workspace realtime channel.

## Open Questions

None.
