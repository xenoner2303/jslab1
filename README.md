## M3: Replay backpressure check
Replay file: `server/logs/room1-test-200mb.ndjson`
Download URL: `http://localhost:3000/api/replays/room1-test-200mb`
DevTools network throttling: 3G
- RSS was printed once per second in the server console by temporary timer:
```
const rssMetricsInterval = setInterval(() => {
  const rssMemoryMB = process.memoryUsage().rss / 1024 / 1024;
  console.log(`Server RSS Memory: ${rssMemoryMB.toFixed(2)} MB`);
}, 1000);
```

Graphs of RSS memory usage during 2 mins backpressure test:
![RSS](./screenshots/m3-backpressure-rss.png)