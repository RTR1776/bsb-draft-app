# BSB Draft Command Center

Fantasy baseball draft strategy tool for Box Score Baseball's Kentucky Derby Style draft.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Generate fresh projection data (requires Python 3)
python3 scripts/generate_data.py

# 3. Start dev server
npm run dev

# Open http://localhost:3000
```

## Architecture

- **Data Pipeline**: Python script pulls Steamer projections from FanGraphs, applies BSB's custom scoring formula, and outputs static JSON files
- **Frontend**: Next.js + React + Tailwind CSS — reads JSON data, all interactivity is client-side
- **Draft State**: Persisted in localStorage — survives page refresh, no backend needed

## Features

### Pre-Draft
- Template priority rankings with post-Mini scarcity analysis
- Full player database with custom BSB scoring (FPTS)
- Position-filtered draft boards
- Fuzzy search (Ctrl+K or /)

### Live Draft
- Click players to mark as drafted
- Active draft category filtering (Mini Bat, Mega OF, etc.)
- Real-time scarcity recalculation as players are picked
- Draft log with undo capability
- "My Team" roster tracker

### Keyboard Shortcuts
- `/` or `Ctrl+K` — Focus search
- `Escape` — Clear search

## Custom Scoring

**Batting**: R(1) + TB(1) + BB(1) + RBI(1) + SB(1)

**Pitching**: IP(3) + K(1) + W(10) + SV(8) + HLD(6) + QS(4) + CG(5) + IRS(2) - ER(2) - BB(1) - H(1)

## Refreshing Data

Projections are pulled from FanGraphs Steamer. Re-run the data pipeline anytime:

```bash
python3 scripts/generate_data.py
```

This regenerates `src/data/*.json`. Restart the dev server to pick up changes.

## Deployment

Deploy anywhere that supports Next.js:
- `vercel deploy`
- `npm run build && npm start`
- Docker, Netlify, etc.
