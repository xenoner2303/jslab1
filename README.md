[![CI Status](https://github.com/xenoner2303/jslab1/actions/workflows/ci.yml/badge.svg)](https://github.com/xenoner2303/jslab1/actions/workflows/ci.yml)

## M4
### 1. Framework Decision
I kept the lobby and HUD built with vanilla DOM and TypeScript. This avoids adding a framework while time and infrastructure are limited.

---

### 2. What TypeScript found
With `strict: true` and `noUncheckedIndexedAccess`, TypeScript highlighted places that needed safer handling:
* **`shared/codec/binary.ts`** - nullable values and indexed lookups need to be checked before use.
* **`server/src/rooms.ts`** - `Map.get()` returned `undefined`, so i force code to handle a player that is not in the room.

---

### 3. Most Interesting Types
**1. Message types inferred from Zod**
`ClientMessage` and `ServerMessage` are inferred from the protocol schemas. For example, checking `message.type === "input"` tells TypeScript which fields are available. Zod checks incoming data at runtime; TypeScript types help while writing the code.

**2. `Bus`**
`Bus<GameEvents>` on the client and `EventEmitter<RoomEvents>` on the server check event names and payloads.

**3. `Codec`**
JSON and binary codecs implement the same `Codec` interface. The rest of the app can use either format through the same `encode` and `decode` methods.
