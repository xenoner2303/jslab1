import { expect, test, type Page } from "@playwright/test";

type FrameState = {
  rosters: string[][];
  snapshots: ObservedShip[][];
  sentInputs: { seq: number; thrust: number }[];
  acknowledgements: Record<string, unknown>[];
};

type ObservedShip = {
  name: string;
  x: number;
  y: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function trackServerFrames(page: Page): FrameState {
  const state: FrameState = {
    rosters: [],
    snapshots: [],
    sentInputs: [],
    acknowledgements: [],
  };
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      const message = parseFrame(payload);
      if (
        message?.type === "input" &&
        typeof message.seq === "number" &&
        typeof message.thrust === "number"
      ) {
        state.sentInputs.push({
          seq: message.seq,
          thrust: message.thrust,
        });
      }
    });
    socket.on("framereceived", ({ payload }) => {
      const message = parseFrame(payload);
      if (!message) return;
      if (message.type === "roster" && Array.isArray(message.players)) {
        state.rosters.push(
          message.players.flatMap((player) =>
            isRecord(player) && typeof player.name === "string"
              ? [player.name]
              : [],
          ),
        );
      }

      if (message.type === "snapshot" && Array.isArray(message.entities)) {
        if (isRecord(message.lastProcessedSeq)) {
          state.acknowledgements.push(message.lastProcessedSeq);
        }
        state.snapshots.push(
          message.entities.flatMap((entity) =>
            isRecord(entity) &&
            entity.kind === "mainShip" &&
            typeof entity.playerName === "string" &&
            typeof entity.x === "number" &&
            typeof entity.y === "number"
              ? [{ name: entity.playerName, x: entity.x, y: entity.y }]
              : [],
          ),
        );
      }
    });
  });
  return state;
}

function parseFrame(payload: string | Buffer): Record<string, unknown> | null {
  try {
    const message: unknown = JSON.parse(
      typeof payload === "string" ? payload : payload.toString(),
    );
    return isRecord(message) ? message : null;
  } catch {
    return null;
  }
}

async function joinRoom(
  page: Page,
  playerName: string,
  roomName: string,
): Promise<void> {
  await page.locator("#player-name-input").fill(playerName);
  const room = page.locator(".room-card").filter({ hasText: roomName });
  await expect(room).toBeVisible();
  await room.locator(".join-btn").click();
  await expect(page.locator("#start-btn")).toBeVisible();
}

async function startGame(page: Page): Promise<void> {
  await page.locator("#start-btn").click();
  await expect(page.locator("#chat-panel")).toBeVisible({ timeout: 15_000 });
}

function lastShipPosition(
  snapshots: ObservedShip[][],
  playerName: string,
): { x: number; y: number } | undefined {
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    const ship = snapshots[index]?.find((entity) => entity.name === playerName);
    if (ship) return { x: ship.x, y: ship.y };
  }
  return undefined;
}

test("two browsers join one room, see movement, and exchange chat", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const framesA = trackServerFrames(pageA);
  const framesB = trackServerFrames(pageB);
  const roomName = `E2E ${Date.now()}`;

  try {
    await Promise.all([pageA.goto("/"), pageB.goto("/")]);

    await pageA.locator("#new-room-name").fill(roomName);
    await pageA.locator("#create-room-btn").click();
    await expect(
      pageA.locator(".room-card").filter({ hasText: roomName }),
    ).toBeVisible();
    await pageB.locator("#refresh-rooms-btn").click();

    await joinRoom(pageA, "PlayerA", roomName);
    await joinRoom(pageB, "PlayerB", roomName);

    await expect
      .poll(
        () =>
          framesA.rosters.some(
            (names) => names.includes("PlayerA") && names.includes("PlayerB"),
          ),
        { timeout: 5_000 },
      )
      .toBe(true);
    await expect
      .poll(
        () =>
          framesB.rosters.some(
            (names) => names.includes("PlayerA") && names.includes("PlayerB"),
          ),
        { timeout: 5_000 },
      )
      .toBe(true);

    await startGame(pageB);
    await startGame(pageA);

    await expect
      .poll(() => lastShipPosition(framesB.snapshots, "PlayerA"), {
        timeout: 5_000,
      })
      .toBeDefined();
    const initialPosition = lastShipPosition(
      framesB.snapshots,
      "PlayerA",
    );
    if (!initialPosition) throw new Error("PlayerA snapshot was not received");

    await pageA.click("canvas").catch(() => pageA.click("body"));

    await pageA.keyboard.down("w");
    try {
      await expect
        .poll(
          () => framesA.sentInputs.some((input) => input.thrust === 1),
          { timeout: 2_000 },
        )
        .toBe(true);
      
      await expect
        .poll(
          () => {
            const current = lastShipPosition(framesB.snapshots, "PlayerA");
            return current
              ? Math.hypot(
                  current.x - initialPosition.x,
                  current.y - initialPosition.y,
                )
              : 0;
          },
          {
            timeout: 500,
            message: `PlayerA did not move. Sent inputs: ${JSON.stringify(framesA.sentInputs.slice(-5))}; acknowledgements: ${JSON.stringify(framesB.acknowledgements.slice(-5))}; snapshots: ${JSON.stringify(framesB.snapshots.slice(-3))}`,
          },
        )
        .toBeGreaterThan(0.5);
    } finally {
      await pageA.keyboard.up("w");
    }

    await pageA.locator("#chat-input").fill("A - HI");
    await pageA.locator("#chat-input").press("Enter");
    await expect(pageB.locator("#chat-messages")).toContainText(
      "A - HI",
    );
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
  }
});
