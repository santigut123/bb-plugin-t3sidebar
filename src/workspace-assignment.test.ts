import { describe, expect, it, vi } from "vitest";
import { retryWorkspaceAssignment } from "./workspace-assignment";

describe("retryWorkspaceAssignment", () => {
  it("retries transient failures before succeeding", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("still offline"))
      .mockResolvedValue("assigned");
    const sleep = vi.fn(async () => undefined);

    await expect(retryWorkspaceAssignment(operation, sleep)).resolves.toBe(
      "assigned",
    );
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[100], [300]]);
  });

  it("reports the final failure after three attempts", async () => {
    const finalError = new Error("unavailable");
    const operation = vi.fn<() => Promise<void>>().mockRejectedValue(finalError);
    const sleep = vi.fn(async () => undefined);

    await expect(retryWorkspaceAssignment(operation, sleep)).rejects.toBe(
      finalError,
    );
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
