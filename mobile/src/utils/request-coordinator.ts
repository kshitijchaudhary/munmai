export interface RequestCoordinator {
  begin: () => number | null;
  finish: (requestId: number) => void;
  invalidate: () => void;
  isCurrent: (requestId: number) => boolean;
}

export function createRequestCoordinator(): RequestCoordinator {
  let currentRequestId = 0;
  let hasRequestInFlight = false;

  return {
    begin() {
      if (hasRequestInFlight) {
        return null;
      }

      currentRequestId += 1;
      hasRequestInFlight = true;
      return currentRequestId;
    },
    finish(requestId) {
      if (hasRequestInFlight && requestId === currentRequestId) {
        hasRequestInFlight = false;
      }
    },
    invalidate() {
      currentRequestId += 1;
      hasRequestInFlight = false;
    },
    isCurrent(requestId) {
      return hasRequestInFlight && requestId === currentRequestId;
    },
  };
}
