import { describe, expect, it, vi } from "vitest";
import { initAudio } from "../sim/audio.ts";

function audioHarness() {
  const source = {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    start: vi.fn(),
  };
  const context = {
    destination: {},
    createBufferSource: vi.fn(() => source),
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
  return { source, context, assets };
}

describe("audio helpers", () => {
  it("plays each regular sound when its asset exists", () => {
    const { source, context, assets } = audioHarness();
    const audio = initAudio(context, assets);
    audio.playShoot();
    audio.playExplosion();
    audio.playHit("bliblie");
    expect(context.createBufferSource).toHaveBeenCalledTimes(3);
    expect(source.connect).toHaveBeenCalledWith(context.destination);
    expect(source.start).toHaveBeenCalledWith(0);
  });

  it("does nothing when audio is unavailable or the asset is missing", () => {
    const { context } = audioHarness();
    const withoutContext = initAudio(null, {});
    const withoutAsset = initAudio(context, {});
    withoutContext.playShoot();
    withoutAsset.playShoot();
    expect(context.createBufferSource).not.toHaveBeenCalled();
  });

  it("only plays the supported hit and environment sound types", () => {
    const { context, assets } = audioHarness();
    const audio = initAudio(context, assets);
    audio.playHit("unknown");
    audio.playEnvironmentSound("unknown");
    expect(context.createBufferSource).not.toHaveBeenCalled();
    audio.playEnvironmentSound("bliblie");
    expect(context.createBufferSource).toHaveBeenCalledOnce();
  });

  it.each([
    [2, "doubleKill"],
    [3, "tripleKill"],
    [4, "quadraKill"],
    [5, "pentaKill"],
    [6, "legendaryKill"],
  ])("plays the matching kill sound for %s kills", (count) => {
    const { source, context, assets } = audioHarness();
    const audio = initAudio(context, assets);
    audio.playKillJoke(count, "bliblie");
    expect(context.createBufferSource).toHaveBeenCalledOnce();
    expect(source.buffer).toBeDefined();
  });

  it("does not play a kill joke for other entity types or low counts", () => {
    const { context, assets } = audioHarness();
    const audio = initAudio(context, assets);
    audio.playKillJoke(2, "other");
    audio.playKillJoke(1, "bliblie");
    expect(context.createBufferSource).not.toHaveBeenCalled();
  });
});
