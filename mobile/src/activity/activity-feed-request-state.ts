export type ActivityFeedLoadMode = 'initial' | 'refresh' | 'silent';
export type ActivityFeedErrorKind = 'offline' | 'request';

export interface ActivityFeedError {
  kind: ActivityFeedErrorKind;
  message: string;
}

export interface ActivityFeedRequestState<Data> {
  data: Data | null;
  error: ActivityFeedError | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

interface ActivityFeedRequestOptions<Response, Data> {
  parse: (response: Response) => Data;
  request: (signal: AbortSignal) => Promise<Response>;
  update: (state: ActivityFeedRequestState<Data>) => void;
}

export interface ActivityFeedRequestController<Data> {
  cleanup: () => void;
  getState: () => ActivityFeedRequestState<Data>;
  loadInitial: () => Promise<void>;
  refresh: () => Promise<void>;
  reloadSilent: () => Promise<void>;
  retry: () => Promise<void>;
}

const DEFAULT_ERROR_MESSAGE = 'Your activity feed could not be loaded.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function classifyActivityFeedError(
  error: unknown,
): ActivityFeedError | null {
  if (
    isRecord(error) &&
    error.name === 'ApiError' &&
    error.isAuthenticationFailure === true
  ) {
    return null;
  }

  const message =
    isRecord(error) &&
    typeof error.message === 'string' &&
    error.message.trim()
      ? error.message
      : DEFAULT_ERROR_MESSAGE;
  const isNetworkError =
    isRecord(error) &&
    error.name === 'ApiError' &&
    error.isNetworkError === true;

  return {
    kind: isNetworkError ? 'offline' : 'request',
    message,
  };
}

export function createActivityFeedRequestController<Response, Data>(
  options: ActivityFeedRequestOptions<Response, Data>,
): ActivityFeedRequestController<Data> {
  let state: ActivityFeedRequestState<Data> = {
    data: null,
    error: null,
    isLoading: true,
    isRefreshing: false,
  };
  let activeController: AbortController | null = null;
  let activeRequestId = 0;
  let hasRequestInFlight = false;
  let disposed = false;

  const update = (changes: Partial<ActivityFeedRequestState<Data>>) => {
    if (disposed) return;
    state = { ...state, ...changes };
    options.update(state);
  };

  const invalidate = () => {
    activeRequestId += 1;
    hasRequestInFlight = false;
    activeController?.abort();
    activeController = null;
  };

  const load = async (mode: ActivityFeedLoadMode) => {
    if (disposed || hasRequestInFlight) return;

    activeRequestId += 1;
    const requestId = activeRequestId;
    hasRequestInFlight = true;
    const controller = new AbortController();
    activeController = controller;

    update({
      error: null,
      isLoading: mode === 'initial',
      isRefreshing: mode === 'refresh',
    });

    try {
      const response = await options.request(controller.signal);
      if (
        disposed ||
        !hasRequestInFlight ||
        requestId !== activeRequestId
      ) {
        return;
      }
      update({ data: options.parse(response) });
    } catch (requestError) {
      if (
        disposed ||
        !hasRequestInFlight ||
        requestId !== activeRequestId
      ) {
        return;
      }
      update({ error: classifyActivityFeedError(requestError) });
    } finally {
      if (
        disposed ||
        !hasRequestInFlight ||
        requestId !== activeRequestId
      ) {
        return;
      }
      hasRequestInFlight = false;
      if (activeController === controller) activeController = null;
      update({ isLoading: false, isRefreshing: false });
    }
  };

  return {
    cleanup() {
      disposed = true;
      invalidate();
    },
    getState: () => state,
    loadInitial: () => load('initial'),
    refresh: () => load('refresh'),
    reloadSilent: () => {
      invalidate();
      return load('silent');
    },
    retry: () => load('initial'),
  };
}
