import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_POLL_INTERVAL_MS, useDashboardState } from "@/hooks/use-dashboard-state";

interface DeferredPromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function createDeferred<T>(): DeferredPromise<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function makeSuccessResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

async function flushReactQuery(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

const basePayload = {
  projectPath: "/tmp/project",
  timestamp: "2026-02-05T12:00:00.000Z",
  ralph: {
    state: {
      started_at: "2026-02-05T11:00:00.000Z",
    },
    prd: null,
    items: [],
    statePath: "/tmp/project/.ralph/state.json",
    prdPath: null,
    errors: {
      state: null,
      prd: null,
    },
  },
  git: {
    branch: "main",
    commitCount: 0,
    recentCommits: [],
    baseBranch: "main",
    diffFromBase: {
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    },
    uncommitted: {
      staged: { filesChanged: 0, insertions: 0, deletions: 0 },
      unstaged: { filesChanged: 0, insertions: 0, deletions: 0 },
      untrackedFiles: 0,
      total: { filesChanged: 0, insertions: 0, deletions: 0 },
    },
    error: null,
  },
  metrics: {
    totalLoc: 100,
    locByLanguage: {},
    fileCount: 4,
    testFileCount: 2,
    error: null,
  },
  coverage: {
    available: false,
    summaryPath: null,
    total: null,
    error: "Coverage summary file not found",
  },
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useDashboardState", () => {
  it("uses the path query parameter when a project path is provided", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(makeSuccessResponse(basePayload));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useDashboardState("/tmp/with-space project"), { wrapper: makeWrapper() });
    await flushReactQuery();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/state?path=%2Ftmp%2Fwith-space+project");
  });

  it("polls for new state every 2 seconds", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(makeSuccessResponse({ ...basePayload, timestamp: "2026-02-05T12:00:00.000Z" }))
      .mockResolvedValueOnce(makeSuccessResponse({ ...basePayload, timestamp: "2026-02-05T12:00:02.000Z" }));

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDashboardState(), { wrapper: makeWrapper() });

    await flushReactQuery();
    expect(result.current.data?.timestamp).toBe("2026-02-05T12:00:00.000Z");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_POLL_INTERVAL_MS + 50);
    });
    await flushReactQuery();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.data?.timestamp).toBe("2026-02-05T12:00:02.000Z");

  });

  it("keeps previous data while background polling request is in flight", async () => {
    vi.useFakeTimers();

    const nextResponse = createDeferred<Response>();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(makeSuccessResponse({ ...basePayload, timestamp: "2026-02-05T12:00:00.000Z" }))
      .mockReturnValueOnce(nextResponse.promise);

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDashboardState(), { wrapper: makeWrapper() });

    await flushReactQuery();
    expect(result.current.data?.timestamp).toBe("2026-02-05T12:00:00.000Z");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_POLL_INTERVAL_MS + 50);
    });

    await flushReactQuery();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.data?.timestamp).toBe("2026-02-05T12:00:00.000Z");

    nextResponse.resolve(makeSuccessResponse({ ...basePayload, timestamp: "2026-02-05T12:00:02.000Z" }));

    await flushReactQuery();
    expect(result.current.data?.timestamp).toBe("2026-02-05T12:00:02.000Z");
  });
});
