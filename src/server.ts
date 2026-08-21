// bb-plugin-t3sidebar backend — the settled / snoozed store.
//
// This state lives in the plugin's own SQLite database, never on bb's thread.
// Putting it on the thread would mean a schema change, a wire change, and a
// HOST_DAEMON_PROTOCOL_VERSION bump for something only this sidebar
// understands. Here, uninstalling the plugin removes its state with it.
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

const migrations = [
  `CREATE TABLE IF NOT EXISTS thread_lifecycle (
     thread_id      TEXT PRIMARY KEY,
     settled_at     INTEGER,
     snoozed_until  INTEGER,
     snoozed_at     INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS project_colors (
     project_id TEXT PRIMARY KEY,
     hue        INTEGER NOT NULL
   )`,
];

export interface StoredLifecycleRow {
  threadId: string;
  settledAt: number | null;
  snoozedUntil: number | null;
  snoozedAt: number | null;
}

interface LifecycleDbRow {
  thread_id: string;
  settled_at: number | null;
  snoozed_until: number | null;
  snoozed_at: number | null;
}

interface ProjectColorDbRow {
  project_id: string;
  hue: number;
}

export interface StoredProjectColorRow {
  projectId: string;
  hue: number;
}

const threadIdSchema = z.object({ threadId: z.string().trim().min(1) });
const projectIdSchema = z.object({ projectId: z.string().trim().min(1) });
const hueSchema = z.number().int().min(0).max(359);

export const t3sidebarRpcContract = defineRpcContract({
  listTurnStarts: {
    input: z.object({
      threadIds: z.array(z.string().trim().min(1)).min(1).max(100),
    }),
    output: z.object({
      rows: z.array(
        z.object({
          threadId: z.string(),
          startedAt: z.number().nullable(),
        }),
      ),
    }),
  },
  listLifecycle: {
    input: z.object({}),
    output: z.object({
      rows: z.array(
        z.object({
          threadId: z.string(),
          settledAt: z.number().nullable(),
          snoozedUntil: z.number().nullable(),
          snoozedAt: z.number().nullable(),
        }),
      ),
    }),
  },
  settle: { input: threadIdSchema, output: z.object({ ok: z.boolean() }) },
  unsettle: { input: threadIdSchema, output: z.object({ ok: z.boolean() }) },
  snooze: {
    input: z.object({
      threadId: z.string().trim().min(1),
      // Absolute wake time, so a snooze means the same thing on every device.
      snoozedUntil: z.number().int().positive(),
    }),
    output: z.object({ ok: z.boolean() }),
  },
  unsnooze: { input: threadIdSchema, output: z.object({ ok: z.boolean() }) },
  listProjectColors: {
    input: z.object({}),
    output: z.object({
      rows: z.array(
        z.object({
          projectId: z.string(),
          hue: z.number().int().min(0).max(359),
        }),
      ),
    }),
  },
  setProjectColor: {
    input: z.object({
      projectId: z.string().trim().min(1),
      hue: hueSchema,
    }),
    output: z.object({ ok: z.boolean() }),
  },
  resetProjectColor: {
    input: projectIdSchema,
    output: z.object({ ok: z.boolean() }),
  },
});

/** Channel the frontend re-reads on. */
export const LIFECYCLE_CHANNEL = "lifecycle";
export const PROJECT_COLORS_CHANNEL = "project-colors";
export const TURN_STARTS_CHANNEL = "turn-starts";

export const t3sidebarSettings = {
  cardDividers: {
    type: "boolean" as const,
    label: "Card dividers",
    description:
      "Show a subtle line between thread cards in the inbox and parked shelves.",
    default: true,
  },
  projectColorStripes: {
    type: "boolean" as const,
    label: "Project color stripes",
    description:
      "Tint each card with a project-colored left stripe and project name while viewing all projects.",
    default: true,
  },
  unreadTitleWeight: {
    type: "select" as const,
    label: "Unread title weight",
    description:
      "How strongly unread thread titles stand out from read ones.",
    options: ["normal", "medium", "semibold", "bold"],
    default: "bold",
  },
  statusIconShine: {
    type: "boolean" as const,
    label: "Status icon shine",
    description:
      "Animate workflow, agent, command, planning, and goal status icons.",
    default: false,
  },
  workingShimmer: {
    type: "select" as const,
    label: "Working card shimmer",
    description:
      "Animation on inbox cards while a thread is actively working. Beam is a tight highlight; Glow is softer and wider; Sheen stacks hard-edge highlight bands.",
    options: ["off", "beam", "glow", "sheen"],
    default: "off",
  },
};

export default function plugin(bb: BbPluginApi) {
  bb.settings.define(t3sidebarSettings);
  const db = bb.storage.database();
  bb.storage.migrate(db, migrations);

  const readAll = (): StoredLifecycleRow[] =>
    (
      db
        .prepare(
          `SELECT thread_id, settled_at, snoozed_until, snoozed_at
             FROM thread_lifecycle`,
        )
        .all() as LifecycleDbRow[]
    ).map((row) => ({
      threadId: row.thread_id,
      settledAt: row.settled_at,
      snoozedUntil: row.snoozed_until,
      snoozedAt: row.snoozed_at,
    }));

  const write = (row: StoredLifecycleRow): void => {
    db.prepare(
      `INSERT INTO thread_lifecycle
         (thread_id, settled_at, snoozed_until, snoozed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(thread_id) DO UPDATE SET
         settled_at = excluded.settled_at,
         snoozed_until = excluded.snoozed_until,
         snoozed_at = excluded.snoozed_at`,
    ).run(row.threadId, row.settledAt, row.snoozedUntil, row.snoozedAt);
    bb.realtime.publish(LIFECYCLE_CHANNEL, { threadId: row.threadId });
  };

  const clear = (threadId: string): void => {
    db.prepare(`DELETE FROM thread_lifecycle WHERE thread_id = ?`).run(
      threadId,
    );
    bb.realtime.publish(LIFECYCLE_CHANNEL, { threadId });
  };

  const readProjectColors = (): StoredProjectColorRow[] =>
    (
      db
        .prepare(`SELECT project_id, hue FROM project_colors`)
        .all() as ProjectColorDbRow[]
    ).map((row) => ({
      projectId: row.project_id,
      hue: row.hue,
    }));

  const publishProjectColors = (projectId: string): void => {
    bb.realtime.publish(PROJECT_COLORS_CHANNEL, { projectId });
  };

  const activeTurnStartedAt = async (
    threadId: string,
  ): Promise<number | null> => {
    const [latest] = await bb.sdk.threads.events.list({
      threadId,
      types: ["turn/started", "turn/completed"],
      order: "desc",
      limit: "1",
    });
    return latest?.type === "turn/started" ? latest.createdAt : null;
  };

  bb.rpc.register(t3sidebarRpcContract, {
    async listTurnStarts({ threadIds }) {
      const rows = await Promise.all(
        [...new Set(threadIds)].map(async (threadId) => {
          const startedAt = await activeTurnStartedAt(threadId);
          return { threadId, startedAt };
        }),
      );
      return { rows };
    },
    async listLifecycle() {
      return { rows: readAll() };
    },
    async settle({ threadId }) {
      const threadIds: string[] = [];
      const seen = new Set<string>();
      for (
        let id: string | null = threadId;
        id !== null && !seen.has(id);
      ) {
        seen.add(id);
        threadIds.push(id);
        const thread: { parentThreadId: string | null } | null =
          await bb.sdk.threads.get({ threadId: id }).catch(() => null);
        id = thread?.parentThreadId ?? null;
      }

      // Settling clears any snooze: they are two answers to the same
      // question, and holding both would make the shelf order ambiguous.
      const settledAt = Date.now();
      for (const id of threadIds) {
        write({
          threadId: id,
          settledAt,
          snoozedUntil: null,
          snoozedAt: null,
        });
      }
      return { ok: true };
    },
    async unsettle({ threadId }) {
      clear(threadId);
      return { ok: true };
    },
    async snooze({ threadId, snoozedUntil }) {
      const now = Date.now();
      write({
        threadId,
        settledAt: null,
        snoozedUntil,
        snoozedAt: now,
      });
      return { ok: true };
    },
    async unsnooze({ threadId }) {
      clear(threadId);
      return { ok: true };
    },
    async listProjectColors() {
      return { rows: readProjectColors() };
    },
    async setProjectColor({ projectId, hue }) {
      db.prepare(
        `INSERT INTO project_colors (project_id, hue)
         VALUES (?, ?)
         ON CONFLICT(project_id) DO UPDATE SET hue = excluded.hue`,
      ).run(projectId, hue);
      publishProjectColors(projectId);
      return { ok: true };
    },
    async resetProjectColor({ projectId }) {
      db.prepare(`DELETE FROM project_colors WHERE project_id = ?`).run(
        projectId,
      );
      publishProjectColors(projectId);
      return { ok: true };
    },
  });

  let disposed = false;
  const unsubscribeTurnStarts = bb.sdk.subscribe({
    event: "thread:changed",
    callback: (event) => {
      const threadId = event.id;
      if (
        threadId === undefined ||
        !event.metadata?.eventTypes?.includes("turn/started")
      ) {
        return;
      }
      void activeTurnStartedAt(threadId)
        .then((startedAt) => {
          if (!disposed && startedAt !== null) {
            bb.realtime.publish(TURN_STARTS_CHANNEL, { threadId, startedAt });
          }
        })
        .catch(() => undefined);
    },
  });

  // A deleted thread must not leave a row behind that would park a future
  // thread reusing the id, and stale rows accumulate otherwise.
  bb.events.on("thread.deleted", ({ thread }) => {
    clear(thread.id);
  });

  bb.onDispose(() => {
    disposed = true;
    unsubscribeTurnStarts();
  });
}
