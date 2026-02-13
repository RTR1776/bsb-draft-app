# BSB Draft Command Center

Your personal war room for the Box Score Baseball Kentucky Derby Style draft. This guide explains everything the app does, how the numbers work, and how to use it on draft day.

---

## What Is This?

The BSB Draft Command Center is a live draft assistant built specifically for our 16-team Box Score Baseball league. It knows our exact scoring system, our Kentucky Derby draft format, and all 10 draft categories. It pulls real projections from FanGraphs, crunches every number through our scoring formula, and tells you who to pick and when.

Think of it as having a fantasy baseball analyst sitting next to you during the draft whispering, "Take this guy — here's why."

---

## How Our Scoring Works

Every player earns fantasy points based on what they do in real games. Here's exactly how we score.

### Batting

| What the Player Does | Points |
|---|---|
| Run Scored (R) | +1 |
| Total Base (TB) | +1 per base (single = 1, double = 2, triple = 3, home run = 4) |
| Walk (BB) | +1 |
| RBI | +1 |
| Stolen Base (SB) | +1 |

So a guy who hits a home run gets +4 for the total bases, +1 for the run scored, and +1 for the RBI — that's 6 points on one swing. A walk is worth the same as a single (1 point each), which is why OBP guys matter in our league.

### Pitching

| What the Pitcher Does | Points |
|---|---|
| Inning Pitched (IP) | +3 |
| Strikeout (K) | +1 |
| Win (W) | +10 |
| Save (SV) | +8 |
| Hold (HLD) | +6 |
| Quality Start (QS) | +4 |
| Complete Game (CG) | +5 |
| Inherited Runner Scored (IRS) | +2 |
| **Earned Run (ER)** | **-2** |
| **Walk Allowed (BB)** | **-1** |
| **Hit Allowed (H)** | **-1** |

Wins are king at +10 each. A starter who goes 7 innings with 8 strikeouts and a win might score 40+ points in one game. Relievers can rack up points too — saves are worth +8 and holds are +6, and they still get +3 per inning and +1 per strikeout.

### The FPTS Number

The gold number next to every player's name is their **projected total fantasy points for the season** using our exact scoring formula. This is the single most important number in the app. Higher FPTS = more valuable player.

---

## Understanding the Smart Numbers

The app doesn't just show raw projections. It calculates several custom analytics to help you make smarter picks.

### VORP (Value Over Replacement Player)

**What it means:** How many more points this player is projected to score compared to the 17th-best player at his position (the "replacement level" in a 16-team league).

**Why it matters:** A shortstop projected for 400 points might actually be more valuable than an outfielder projected for 450 points — because there are fewer good shortstops. VORP captures that. A high VORP means this player is significantly better than the alternatives at his position.

**How to read it:**
- **Green (+30 or more):** Elite value — way better than the replacement options
- **Yellow (+10 to +30):** Good value — clearly above replacement
- **Gray (under +10):** Minimal edge — you could wait on this position

### PANA (Points Above Next Available)

**What it means:** The gap between this player and the very next undrafted player at the same position. It updates live as players get drafted.

**Why it matters:** If a player has a PANA of +40, that means the next guy at his position is 40 points worse. That's a huge cliff — draft him now or lose that value forever. If PANA is only +5, you can probably wait because the next guy is almost as good.

**How to read it:**
- **Red (+20 or more):** Danger zone — big drop-off coming. Draft now.
- **Orange (+10 to +20):** Notable gap. Keep an eye on it.
- **Gray (under +10):** Minimal drop-off. Safe to wait.

You'll also see a red **▼** arrow next to players with a 20+ point drop-off. That's a visual alarm telling you to grab them before the cliff.

### Tiers (1-5)

Every player is placed into a tier based on where they rank within their position group:

| Tier | What It Means | Row Color |
|---|---|---|
| **Tier 1** | Elite — Top 6% at the position | Faint gold tint |
| **Tier 2** | Great — Next 12% | Faint blue tint |
| **Tier 3** | Solid — Next 20% | No tint |
| **Tier 4** | Average — Next 25% | No tint |
| **Tier 5** | Below Average — Bottom 37% | No tint |

The general strategy: grab Tier 1 and Tier 2 guys whenever you can. Once a position is down to Tier 4 and 5, you've missed the window.

### Position Rank

The small number on each position badge (like **SS3** or **OF12**) tells you this player's rank at their position. SS3 means they're the 3rd-best shortstop. OF12 means 12th-best outfielder. The lower the number, the better.

---

## The Kentucky Derby Draft Format

Our draft has 10 categories, and your template determines what pick number you get in each category. There are 16 picks per round (one per team), and each category has a set number of rounds.

### Draft Categories

| Category | Rounds | Who's Eligible | Total Picks |
|---|---|---|---|
| **Mini Bat** | 4 | Any batter | 64 |
| **Mini Pitch** | 4 | Any pitcher | 64 |
| **Mega Pitch** | 6 | Any pitcher | 96 |
| **Mega OF** | 4 | Outfielders only | 64 |
| **Mega 1B** | 2 | First basemen only | 32 |
| **Mega 2B** | 2 | Second basemen only | 32 |
| **Mega 3B** | 2 | Third basemen only | 32 |
| **Mega SS** | 2 | Shortstops only | 32 |
| **Mega C** | 2 | Catchers only | 32 |
| **Mega Any** | 2 | Anyone | 32 |

### Templates (A through P)

Before the draft, each team selects a template letter (A through P). Your template determines your pick order in every category. For example, Template A might give you pick #1 in Mini Bat but pick #16 in Mini Pitch. It's all about tradeoffs.

The app ranks templates by calculating a **Template Score** based on post-Mini scarcity. Templates that give you early picks at scarce positions rank higher. The left sidebar shows this ranking to help you choose.

---

## How to Use the App

### Before the Draft

1. **Browse players** — Scroll the main board to see all 600 players (300 batters + 300 pitchers) ranked by FPTS.
2. **Filter by position** — Click the position buttons (C, 1B, 2B, 3B, SS, OF, SP, RP) to see only that position.
3. **Search** — Press **/** or **Ctrl+K** and start typing any player name or team.
4. **Pick your template** — Click a template letter in the left sidebar. The app will track your pick numbers.
5. **Study player cards** — Click any player's **name** to open their full scouting card (more on this below).

### During the Draft

1. **Select the active category** — Click the category button (Mini Bat, Mega OF, etc.) that's currently being drafted. The board automatically filters to show only eligible players.
2. **When someone else picks** — Right-click the player and assign them to the team that drafted them. This keeps the scarcity numbers accurate.
3. **When it's your pick** — The app shows a gold **"YOUR PICK!"** indicator and recommends the top 3 players (marked with a gold **REC** badge). Click a player row to draft them to your team.
4. **Track progress** — The dashboard strip at the top shows your team total, category progress, and pick countdown.
5. **Check your roster** — The right sidebar shows your full team organized by position, plus a draft log of every pick.

### Quick Controls

| Action | What It Does |
|---|---|
| **Click a player's name** | Opens the player card with full details |
| **Click anywhere else on a row** | Drafts that player to your team |
| **Right-click a player** | Opens a menu to assign them to another team |
| **Press /** or **Ctrl+K** | Jump to the search bar |
| **Press Escape** | Clear search or close modals |

---

## Player Cards

Click any player's name to open a detailed scouting card. Each card shows:

### Bio
- **Age** — Current age
- **Bats / Throws** — Handedness (Left, Right, or Switch)
- **Height & Weight** — Physical build
- **MLB Debut** — When they first reached the majors, plus years of service
- **Country** — Birth country (shown for international players)

### BSB Fantasy Score
- **FPTS** — Big gold number showing their 2025 projected fantasy points
- **Trend Arrow** — Shows whether the projection is up or down compared to their most recent actual season
- **VORP, PANA, and WAR** at a glance

### 3-Year Fantasy Points History
A bar chart showing their actual BSB fantasy points from 2022, 2023, and 2024, plus the 2025 projection — all calculated using our exact league scoring formula. This helps you see:
- Is this player trending up or down?
- Was last year a breakout or a fluke?
- How consistent are they year to year?

### Scoring Breakdown
Every scoring category listed out with the raw stat, the multiplier, and the points earned. For example: "91 BB x 1 = +91 pts." This shows you exactly where a player's fantasy value comes from.

### Advanced Stats
Traditional baseball metrics for context:
- **Batters:** AVG, OBP, SLG, OPS
- **Pitchers:** ERA, WHIP, K/9, K:BB ratio

### Draft Context
- **Next Available** — Who's the next-best player at this position, and how much of a drop-off is it?
- **Comparable** — A similar-value player at the same position
- **Position Rank** — Where they rank at their position
- **Draft Status** — If already drafted, shows which team took them and in what category

You can also draft a player directly from their card with the "Draft to My Team" button.

---

## The Sidebars

### Left Sidebar

- **Template Rankings** — All 16 templates ranked by strategic value, with scores. Click one to select it as yours.
- **Template Detail** — Once selected, shows your pick number in every category.
- **Live Scarcity** — A bar chart showing how much value spread remains at each position. Taller bars = more value difference between the best and 16th-best available. When a bar shrinks, it means the position is leveling out and there's less urgency.
- **Pool Depth** — How many undrafted players remain at each position. When a position drops below 16, it shows in red — you're running out of options.

### Right Sidebar

Two tabs:

- **My Team** — Your drafted roster laid out by position (C, 1B, 2B, 3B, SS, OF, SP, RP) with slot counts, plus a running total of your team's FPTS. Below that is the full draft log showing every pick in order.
- **All Teams** — Every team in the league with their total FPTS, player count, and a strength meter. Click any team to expand and see who they've drafted.

---

## The Recommendations

When a draft category is active, the app highlights its top 3 recommended picks with a gold **REC** badge. The recommendation engine considers three things:

1. **VORP (40% weight)** — How much better is this player than replacement level?
2. **PANA (35% weight)** — How big is the drop-off to the next available option?
3. **Raw FPTS (25% weight)** — Pure projected production

This means the app won't always recommend the highest-FPTS player available. Sometimes it'll recommend a slightly lower-scoring player at a position that's about to dry up. Trust the recs — they account for scarcity.

---

## The 16 Teams

| # | Team Name |
|---|---|
| 0 | **Frequent Fliers** (that's you!) |
| 1 | Deuces Wild |
| 2 | El Guapo Gato |
| 3 | Fulton's Folly |
| 4 | Hubschs Hackers |
| 5 | Kansas City Monarchs |
| 6 | Kline Drives |
| 7 | No Soup for You |
| 8 | 14-30-8-24-5-15-13-20 |
| 9 | Betty White Sox |
| 10 | Dirty Water All-Stars |
| 11 | Hot Dog Junkies |
| 12 | Mesa Joses |
| 13 | Sedition Brothers |
| 14 | Silly Santos |
| 15 | St. Louis Browns |

---

## Refreshing the Data

The player projections come from FanGraphs (Steamer projections) and the bio/history data comes from the MLB Stats API. To pull the latest numbers:

```bash
python3 scripts/generate_data.py
```

This fetches fresh projections, recalculates all fantasy points using our scoring, pulls updated bios and 3 years of historical stats, and regenerates everything. Run it anytime before draft day to get the most current data.

---

## Quick Start (Technical)

```bash
# Install dependencies
npm install

# Generate player data (requires Python 3)
python3 scripts/generate_data.py

# Start the app
npm run dev

# Open http://localhost:3000
```

---

Built for the BSB league. Good luck on draft day.
