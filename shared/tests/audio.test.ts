import { describe, expect, it, vi } from "vitest";
import { initAudio } from "../sim/audio.ts";

function audioHarness() {
  const connect = vi.fn();
  const start = vi.fn();
  const source = {
    buffer: null as AudioBuffer | null,
    connect,
    start,
  };
  const createBufferSource = vi.fn(() => source);
  const context = {
    destination: {},
    createBufferSource,
  } as unknown as AudioContext;
  const assets = Object.fromEntries(
    [
      "shootRocket",
      "explosion",
      "bliblieDie",
      "bliblieSounds1",
      "bliblieSounds2",
      "doubleKill",
      "tripleKill",
      "quadraKill",
      "pentaKill",
      "legendaryKill",
    ].map((name) => [name, { name } as unknown as AudioBuffer]),
  );
  return { source, context, assets, connect, start, createBufferSource };
}

describe("audio helpers", () => {
  it("plays each regular sound when its asset exists", () => {
    const { context, assets, connect, start, createBufferSource } =
      audioHarness();
    const audio = initAudio(context, assets);
    audio.playShoot();
    audio.playExplosion();
    audio.playHit("bliblie");
    expect(createBufferSource).toHaveBeenCalledTimes(3);
    expect(connect).toHaveBeenCalledWith(context.destination);
    expect(start).toHaveBeenCalledWith(0);
  });

  it("does nothing when audio is unavailable or the asset is missing", () => {
    const { context, createBufferSource } = audioHarness();
    const withoutContext = initAudio(null, {});
    const withoutAsset = initAudio(context, {});
    withoutContext.playShoot();
    withoutAsset.playShoot();
    expect(createBufferSource).not.toHaveBeenCalled();
  });

  it("only plays the supported hit and environment sound types", () => {
    const { context, assets, createBufferSource } = audioHarness();
    const audio = initAudio(context, assets);
    audio.playHit("unknown");
    audio.playEnvironmentSound("unknown");
    expect(createBufferSource).not.toHaveBeenCalled();
    audio.playEnvironmentSound("bliblie");
    expect(createBufferSource).toHaveBeenCalledOnce();
  });

  it.each([
    [2, "doubleKill"],
    [3, "tripleKill"],
    [4, "quadraKill"],
    [5, "pentaKill"],
    [6, "legendaryKill"],
  ])("plays the matching kill sound for %s kills", (count) => {
    const { source, context, assets, createBufferSource } = audioHarness();
    const audio = initAudio(context, assets);
    audio.playKillJoke(count, "bliblie");
    expect(createBufferSource).toHaveBeenCalledOnce();
    expect(source.buffer).toBeDefined();
  });

  it("does not play a kill joke for other entity types or low counts", () => {
    const { context, assets, createBufferSource } = audioHarness();
    const audio = initAudio(context, assets);
    audio.playKillJoke(2, "other");
    audio.playKillJoke(1, "bliblie");
    expect(createBufferSource).not.toHaveBeenCalled();
  });
});
