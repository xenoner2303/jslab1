import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLoop } from './loop.ts';

describe('createLoop accumulator', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('simulates once the accumulator covers a step', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(() => callback(performance.now()), 16)
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      clearTimeout(id);
    });

    const simulate = vi.fn();
    const render = vi.fn();
    const loop = createLoop({ step: 1 / 30, simulate, render });
    loop.start();

    vi.advanceTimersByTime(16);
    expect(simulate).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(32);
    expect(simulate).toHaveBeenCalledTimes(1);
    expect(simulate).toHaveBeenCalledWith(1 / 30);

    loop.stop();
  });
});
