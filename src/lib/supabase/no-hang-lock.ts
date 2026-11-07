export type LockFn = <R>(name: string, acquireTimeout: number, fn: () => Promise<R>) => Promise<R>;

export const DEFAULT_WAIT_MS = 5000;

export function createNoHangLock(waitMs: number = DEFAULT_WAIT_MS): LockFn {
  const holders = new Map<string, Promise<void>>();

  return async function lock<R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
    const previous = holders.get(name) ?? Promise.resolve();
    const cap = acquireTimeout > 0 ? Math.min(acquireTimeout, waitMs) : waitMs;

    let resolveHolder: () => void = () => {};
    const holderPromise = new Promise<void>((resolve) => {
      resolveHolder = resolve;
    });
    holders.set(name, holderPromise);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, cap);
    });

    await Promise.race([previous, timeoutPromise]);
    if (timer) clearTimeout(timer);

    try {
      return await fn();
    } finally {
      resolveHolder();
      if (holders.get(name) === holderPromise) {
        holders.delete(name);
      }
    }
  };
}

export const noHangLock: LockFn = createNoHangLock();
