export interface SessionOperationQueue {
  run<T>(operation: () => Promise<T>): Promise<T>;
}

export function createSessionOperationQueue(): SessionOperationQueue {
  let pendingOperation: Promise<unknown> = Promise.resolve();

  return {
    run<T>(operation: () => Promise<T>) {
      const result = pendingOperation.then(operation, operation);

      pendingOperation = result.then(
        () => undefined,
        () => undefined,
      );

      return result;
    },
  };
}
