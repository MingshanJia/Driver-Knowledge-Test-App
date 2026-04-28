# NSW DKT Practice Webapp

A local webapp for studying the NSW Class C Driver Knowledge Test.

## Run

```powershell
node server.mjs
```

Open `http://localhost:5173`.

## Rebuild Question Data

```powershell
& 'C:\Users\Mingshan\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\build_data.py
```

The generated app data lives in `public/data`.

## Test

```powershell
node tests\scoring.test.mjs
& 'C:\Users\Mingshan\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tests\data_test.py
```

## Notes

- The source question PDF lists the correct answer first; the app shuffles answers only when displaying them.
- Learning Mode records practice attempts in the browser.
- Mock Test mode uses the in-person DKT rules: 15 general knowledge questions and 30 road safety questions, with early failure when the section threshold is exceeded.
- Handbook reasons are matched from the local Road Users Handbook PDF and should be reviewed before relying on them for official advice.
- `public/data/image-map.json` is reserved for reviewed image/sign mappings.
