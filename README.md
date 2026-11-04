[![CI Status](https://github.com/xenoner2303/jslab1/actions/workflows/ci.yml/badge.svg)](https://github.com/xenoner2303/jslab1/actions/workflows/ci.yml)

## M2 - Hardening
1) Configured WebSocket handshake origin verification (`ALLOWED_ORIGINS`), per-IP connection caps, payload size limits, rate limiting, and a 5-second join timeout.

2) Chaos Testing: 
* When client drop, code gracefully unregisters players from rooms upon sudden disconnection without crashing the server.
* When server shutdown, it sends code 1001 with a shutdown message in chat.
* Flooding 1,000 invalid frames/sec triggers immediate socket termination, logs the event, updates prometheus metrics, and has zero impact on other active rooms' tick performance.

