## 1. With a prediction error in the shared `integrate.js` physics, I added a random angle change. The ship had to keep correcting its direction.
```
angle += (Math.random() - 0.5) * 0.05; // only for the lab
```

![first](./screenshots/angle_randomness.png)

## 2. Without random changes

![second](./screenshots/angle_norandomness.png)

As we can see, at the second one correction is near 0, because client and server prediction usually coincides