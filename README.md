![20-second GIF of both windows side by side](./screenshots/sidebyside.gif)
## 1. With a prediction error in the shared `integrate.js` physics, I added a random angle change. The ship had to keep correcting its direction.
```
angle += (Math.random() - 0.5) * 0.05; // only for the lab
```

![first](./screenshots/angle_randomness.png)

## 2. Without random changes

![second](./screenshots/angle_norandomness.png)

As we can see, at the second one correction is near 0, because client and server prediction usually coincides

## M4 — JSON vs Binary measurements

Test at 30 Hz with 4 players. Measure each codec under the same game conditions.

| Codec | Bytes/snapshot | KB/s per client (down) | KB/s per client (up) | Encode+ decode µs |
|---|---:|---:|---:|---:|
| JSON | 3676 | 107.4 | 2.04 | 88.3 |
| Binary (`DataView`) | 575 | 16.8 | 0.38 | 74.5 |

As far as we can see, binary sends less data, but its format is harder to read and maintain.

## netcode write-up

The server is the authority: clients send inputs, not positions. The server
checks those inputs, runs the shared simulation, and sends snapshots. This
helps keep the game consistent and stops clients from choosing their own
position.

### The three problems

- **Latency:** Without prediction, the local ship waits for a server snapshot.
  The client now predicts its own ship immediately, then reconciles it when the
  server responds.
- **Consistency:** Client and server use the same deterministic movement code.
  Snapshots correct differences, while interpolation makes remote ships look
  smooth between updates.
- **Cheating:** The server validates inputs and owns the real game state. A
  client cannot move its ship by sending a chosen position.

### What I observed

Before prediction, movement waited for the server. With prediction, my ship
responded immediately and correction stayed near zero in open space. I tested
determinism by adding a random angle change to the shared movement code. The
correction grew because client and server no longer calculated the same path.
After removing the random change, correction returned close to zero.

I chose an interpolation delay of about 67 ms (two 30 Hz snapshot intervals).
Remote ships are shown slightly in the past, but move more smoothly between
snapshots. The delay can be adjusted live with `[` and `]`.
