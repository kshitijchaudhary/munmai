import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createActivityFeedRequestController,
} from "../src/activity/activity-feed-request-state.ts";
import { createTransactionDataRefreshCoordinator } from "../src/transactions/transaction-data-refresh.ts";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const apiError = ({
  authentication = false,
  message = "Request failed.",
  network = false,
} = {}) => ({
  name: "ApiError",
  message,
  isNetworkError: network,
  isServerError: !network,
  isAuthenticationFailure: authentication,
});

const makeController = (request) => {
  const states = [];
  const controller = createActivityFeedRequestController({
    parse: (response) => response.events,
    request,
    update: (state) => states.push(structuredClone(state)),
  });
  return { controller, states };
};

test("initial load calls the activity request once and exposes loading state", async () => {
  const response = deferred();
  let requestCalls = 0;
  const { controller, states } = makeController(() => {
    requestCalls += 1;
    return response.promise;
  });

  const load = controller.loadInitial();
  assert.equal(requestCalls, 1);
  assert.equal(controller.getState().isLoading, true);
  assert.equal(states.at(-1).isLoading, true);

  response.resolve({ events: [{ id: "income:1" }] });
  await load;
  assert.deepEqual(controller.getState().data, [{ id: "income:1" }]);
  assert.equal(controller.getState().isLoading, false);
});

test("useActivityFeed wires the request controller to GET /activity and transaction refresh", () => {
  const apiSource = readFileSync(
    new URL("../src/api/activity.ts", import.meta.url),
    "utf8",
  );
  const hookSource = readFileSync(
    new URL("../src/activity/use-activity-feed.ts", import.meta.url),
    "utf8",
  );

  assert.match(apiSource, /apiClient\.get\('\/activity', \{ signal \}\)/);
  assert.match(hookSource, /request: getActivityFeed/);
  assert.match(hookSource, /transactionDataRefresh\.subscribe/);
  assert.match(hookSource, /reloadSilent/);
});

test("successful empty responses replace data with an empty array", async () => {
  const responses = [
    { events: [{ id: "expense:1" }] },
    { events: [] },
  ];
  const { controller } = makeController(async () => responses.shift());

  await controller.loadInitial();
  await controller.refresh();
  assert.deepEqual(controller.getState().data, []);
});

test("network and non-network failures produce offline and request errors", async () => {
  const errors = [
    apiError({ message: "Check your connection.", network: true }),
    apiError({ message: "Server rejected the request." }),
  ];
  const { controller } = makeController(async () => {
    throw errors.shift();
  });

  await controller.loadInitial();
  assert.deepEqual(controller.getState().error, {
    kind: "offline",
    message: "Check your connection.",
  });

  await controller.retry();
  assert.deepEqual(controller.getState().error, {
    kind: "request",
    message: "Server rejected the request.",
  });
});

test("retry starts a new request and refresh exposes refreshing state", async () => {
  let calls = 0;
  const refreshResponse = deferred();
  const { controller } = makeController(async () => {
    calls += 1;
    if (calls === 1) throw apiError();
    return refreshResponse.promise;
  });

  await controller.loadInitial();
  const retry = controller.retry();
  assert.equal(calls, 2);
  assert.equal(controller.getState().isLoading, true);
  refreshResponse.resolve({ events: [] });
  await retry;

  const refreshPending = deferred();
  const refreshing = makeController(() => refreshPending.promise).controller;
  const refresh = refreshing.refresh();
  assert.equal(refreshing.getState().isRefreshing, true);
  refreshPending.resolve({ events: [] });
  await refresh;
  assert.equal(refreshing.getState().isRefreshing, false);
});

test("transactionDataRefresh causes a silent reload", async () => {
  let calls = 0;
  const { controller } = makeController(async () => {
    calls += 1;
    return { events: [] };
  });
  const refreshEvents = createTransactionDataRefreshCoordinator();
  const unsubscribe = refreshEvents.subscribe(() => {
    void controller.reloadSilent();
  });

  await controller.loadInitial();
  refreshEvents.notifyTransactionCreated("expense", "expense-1");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls, 2);
  assert.equal(controller.getState().isLoading, false);
  assert.equal(controller.getState().isRefreshing, false);
  unsubscribe();
  refreshEvents.clear();
});

test("a stale earlier response cannot replace a newer silent reload", async () => {
  const earlier = deferred();
  const newer = deferred();
  let calls = 0;
  const { controller } = makeController(() => {
    calls += 1;
    return calls === 1 ? earlier.promise : newer.promise;
  });

  const firstLoad = controller.loadInitial();
  const silentLoad = controller.reloadSilent();
  newer.resolve({ events: [{ id: "newer" }] });
  await silentLoad;
  earlier.resolve({ events: [{ id: "stale" }] });
  await firstLoad;

  assert.deepEqual(controller.getState().data, [{ id: "newer" }]);
});

test("cleanup aborts the current request and prevents stale updates", async () => {
  const pending = deferred();
  let requestSignal;
  const { controller } = makeController((signal) => {
    requestSignal = signal;
    return pending.promise;
  });

  const load = controller.loadInitial();
  controller.cleanup();
  assert.equal(requestSignal.aborted, true);
  pending.resolve({ events: [{ id: "ignored" }] });
  await load;
  assert.equal(controller.getState().data, null);
});

test("repeated refresh replaces data without appending or duplicating events", async () => {
  let call = 0;
  const { controller } = makeController(async () => {
    call += 1;
    return {
      events:
        call === 1
          ? [{ id: "first" }]
          : [{ id: "replacement" }],
    };
  });

  await controller.loadInitial();
  await controller.refresh();
  await controller.refresh();
  assert.deepEqual(controller.getState().data, [{ id: "replacement" }]);
});
