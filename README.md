# JJC Campus Pathfinder MVP

This is a runnable TypeScript/Node MVP scaffold for resolving either a person name or room number into a campus building, parking recommendation, floor/access guidance, timestamp metadata, and Leaflet map markers.

## What it does

- Searches scraped directory data by exact, partial, and fuzzy name.
- Handles room inputs like `MC-T 1063`, `T-1063`, `T1063`, `t1063`, and `T0063`.
- Maps building aliases like `MC-T`, `T`, and `TECH` from one curated row per building. Aliases live in the pipe-separated `aliases` field, not duplicate rows.
- Validates rooms against known room ranges.
- Infers floor from room number:
  - `0000-0999` = basement / lower level
  - `1000-1999` = ground / first floor
  - `2000-2999` = second floor
  - `3000-3999` = third floor
- Adds elevator/stair guidance for basement and upper floors.
- Shows recommended parking as a lot, street, or mixed label.
- Shows timestamp metadata: “These results were based on data pulled on ...”
- Logs unresolved issues to `data/resolve_issues.json`.


## Building CSV shape

`data/campus_locations.csv` is intentionally **one row per building**. Do not create one row for `MC-T`, another row for `T`, and another row for `TECH`. Instead, put all building aliases into the `aliases` column:

```csv
buildingCode,aliases,displayOfficePrefix,campusDisplayName,buildingDisplayName,...
T,"MC-T|T|TECH|Technical Center|T-Building",MC-T,Main Campus,T-Building,...
```

At runtime, `src/data.ts` loads each building row, and `src/resolver.ts` expands `aliases` into an in-memory alias index. That lets `T1063`, `MC-T 1063`, and `TECH1063` all resolve to the same single T-Building record.

## Install and run

```bash
npm install
npm run dev
```

Then open:

```txt
http://localhost:3042
```

## Test

```bash
npm test
```

## Important files

```txt
data/directory_cache.json      Scraped directory cache sample
data/campus_locations.csv      Hand-curated one-row-per-building data; aliases are pipe-separated
data/resolve_issues.json       Generated issue log
src/resolver.ts                Main resolution pipeline
src/server.ts                  Express API + static frontend
public/index.html              Leaflet UI
public/app.js                  Frontend search/map logic
```

## Example searches

Try:

```txt
Pamela Dunn
pam dun
T1063
t-1063
MC-T 1063
T0063
T2063
T9999
Z1063
1063
pam
```

## Notes

Coordinates are fake placeholders. Replace them with real JJC building and parking coordinates before using this in production.

For routing, this MVP opens Google Maps directions links from the user's location/browser context. You can later swap this for OpenRouteService, OSRM, GraphHopper, or another routing API.

