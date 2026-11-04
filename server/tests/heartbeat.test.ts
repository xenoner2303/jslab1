import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HEARTBEAT_INTERVAL_MS,
  startHeartbeat,
  tickHeartbeat,
} from "../src/heartbeat.ts";

function client(overrides: { readyState?: number; missedPongs?: number } = {}) {
  return {
    readyState: overrides.readyState ?? 1,
    missedPongs: overrides.missedPongs ?? 0,
    terminate: vi.fn(),
    ping: vi.fn(),
  };
}

describe("websocket heartbeat", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pings open clients and terminates after missed pongs", () => {
    const open = client();
    const closed = client({ readyState: 3 });
    const stale = client({ missedPongs: 2 });

    tickHeartbeat([open, closed, stale], 1);

    expect(open.ping).toHaveBeenCalledOnce();
    expect(open.missedPongs).toBe(1);
    expect(closed.ping).not.toHaveBeenCalled();
    expect(stale.terminate).toHaveBeenCalledOnce();
    expect(stale.ping).not.toHaveBeenCalled();
  });

  it("runs on the heartbeat interval with fake timers", () => {
    vi.useFakeTimers();
    const open = client();
    const interval = startHeartbeat([open], 1);

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS - 1);
    expect(open.ping).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(open.ping).toHaveBeenCalledOnce();
    expect(open.missedPongs).toBe(1);

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(open.ping).toHaveBeenCalledTimes(2);
    expect(open.missedPongs).toBe(2);

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(open.terminate).toHaveBeenCalledOnce();

    clearInterval(interval);
  });
});
