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

| Codec | Bytes per snapshot | Down per client (KB/s) | Up per client (KB/s) | Encode + decode (µs) |
|---|---:|---:|---:|---:|
| JSON | — | — | — | — |
| Binary (`DataView`) | — | — | — | — |
