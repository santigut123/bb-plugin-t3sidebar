const RETRY_DELAYS_MS = [100, 300] as const;

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, delayMs));

export async function retryWorkspaceAssignment<T>(
  operation: () => Promise<T>,
  sleep: (delayMs: number) => Promise<void> = wait,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) throw error;
      await sleep(delay);
    }
  }
}
