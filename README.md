# Adaptive Rock-Paper-Scissors (step 1: 3D game loop)

```
rps-arena/
├── index.html      page shell
├── css/style.css   layout and look
└── js/
    ├── main.js     game state machine, timestamp lock-in, render loop, input
    ├── hand3d.js   procedural 3D hand and poses
    ├── symbols.js  interactive 3D stone / paper / scissors tokens
    ├── tracker.js  MediaPipe hand tracking, finger curls, gesture rules
    ├── brain.js    experts + Thompson-sampling selector (the learning bot)
    ├── storage.js  rounds and matches saved in localStorage
    └── dashboard.js  player patterns and bot performance
(dashboard.html sits next to index.html)
```

## Run
ES modules and the camera need a local server:

    cd rps-arena
    python -m http.server 8000

Open http://localhost:8000 . Play with the camera, or click a 3D symbol / press R, P, S.

## Notes
- The bot picks its move before "Shoot!". Only frames from 40 ms before to 200 ms after Shoot count.
- Every round is stored in `window.rounds` (player, bot, result, score before, tracking ms).
- Next: SQLite/IndexedDB storage, personal Markov predictor, then the expert mixture and bandit.

## Settings
Points to win, beat speed (ms between 3, 2, 1) and the reaction window (ms after Shoot! that still counts) are on the start screen. Defaults live at the top of `js/main.js` (`WIN`, `BEAT`, `LOCK_AFTER`).

## One-file build
`python tools/build_single.py` rebuilds `rps-arena-single.html` (game + dashboard in one file).
