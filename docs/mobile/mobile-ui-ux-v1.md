# Munmai Mobile UI/UX Vision v1

## Product Positioning

Munmai should feel like a personal financial companion, not an accounting tool.

The product should help users answer:

- Am I doing okay financially?
- What did I spend today?
- Did my friend pay me back?
- How much money do I have left?
- Where is my money going?
- Can I scan this receipt and move on?

Munmai is not a bank, trading app, or generic expense tracker.

Munmai is a personal Money OS built around fast capture, useful financial context, shared spaces, and simple follow-through.

## Product Promise

> Capture. Understand. Share.

Munmai should make it easy to:

- capture personal income and expenses
- attach receipts quickly
- understand daily and monthly money movement
- manage shared expenses
- see who owes whom
- record settlements
- prepare for future tax and export workflows

## Experience Principles

### 1. Capture first

The fastest action in the app should be recording what just happened.

### 2. Show meaning, not raw accounting

Prefer:

- Spent today
- Saved this month
- Friend paid you
- Outstanding balance
- Receipt waiting for review

Avoid repeating:

- Income
- Expense
- Net

unless those labels are needed for clarity.

### 3. Calm, modern, and trustworthy

The interface should feel premium but not like a bank or trading platform.

### 4. Shared spaces should feel alive

Spaces should feel like collaborative financial environments, not static balance containers.

### 5. Every screen needs one clear primary action

Users should quickly understand what to do next.

---

# Bottom Navigation

Use:

```text
Today | Activity | Capture | Insights | Spaces
```

## Today

Purpose: daily financial snapshot and next best actions.

## Activity

Purpose: chronological financial timeline, not just transaction history.

## Capture

Purpose: Munmai's signature action for fast receipt and money capture.

## Insights

Purpose: useful summaries and observations, not a chart-heavy analytics dashboard.

## Spaces

Purpose: shared financial environments for trips, roommates, families, events, and future planning.

---

# Today Screen

## Goal

Answer:

- How am I doing?
- What happened today?
- What should I act on next?

## Proposed structure

### Header

```text
Good evening, Xitol
July 2026
```

Profile/avatar access should live here rather than occupying a primary tab.

### Primary financial snapshot

Show one main value first.

Example:

```text
This month

+$832
Net cash flow

In $3,200        Out $2,368
```

Do not give three equally dominant cards.

### Daily context

Show compact, useful information such as:

```text
Spent today
$28

Saved this month
$212

Outstanding in Spaces
$45
```

Only show data the backend can support accurately.

### Quick actions

```text
Scan receipt
Add expense
Add income
Split expense
```

### Recent activity

Show the latest mixed financial events:

- coffee purchase
- salary added
- receipt attached
- shared expense
- settlement

### Your Spaces

Show 2–3 compact space cards with:

- space name
- member initials
- current user balance
- latest activity

### Useful insight

One short insight only.

Examples:

- You spent less on dining this month.
- Your largest expense was car insurance.
- You still owe $13 in Test Trip.

Do not fabricate unsupported insights.

---

# Activity Screen

## Goal

Replace generic transaction history with a chronological financial timeline.

## Grouping

```text
Today
Yesterday
Earlier this week
Earlier this month
```

## Supported event types

- income added
- expense added
- receipt attached
- shared expense added
- settlement recorded
- imported transaction later

## Row structure

Each row should show:

- icon or member initials
- concise title
- contextual subtitle
- signed amount where relevant
- time or date

Examples:

```text
Coffee at Tim Hortons
Expense · 8:42 AM
-$4.75
```

```text
Sujan paid you
Test Trip settlement
+$15.00
```

```text
Receipt attached
Walmart expense
```

## Filters

Keep filters compact:

```text
All | Personal | Spaces
```

Avoid a complex filter system in v0.9.

---

# Capture Experience

## Goal

Make Capture the most memorable and fastest Munmai workflow.

## Primary interaction

Tapping the center Capture action should open a focused action sheet or capture screen.

Preferred options:

```text
Scan receipt
Add expense
Add income
Split expense
Choose from gallery
```

Import statement can remain secondary or future-facing.

## Receipt-first workflow for v0.9

Current supported flow:

```text
Capture
↓
Take photo or choose image
↓
Preview receipt
↓
Confirm essential expense details
↓
Save
```

Essential fields:

- amount
- recipient or merchant
- date
- optional category
- optional note

The user should not be shown unnecessary fields.

## Future OCR workflow

Do not implement OCR inside the UI/UX hardening release.

Future flow:

```text
Capture
↓
OCR detects merchant, amount, and date
↓
User reviews confidence
↓
Confirm and save
```

Example:

```text
We found:

Walmart
$56.30
July 21, 2026

Please confirm.
```

The current UI should be designed so OCR can fit later without a rewrite.

---

# Insights Screen

## Goal

Answer:

- Where is my money going?
- What changed?
- What deserves attention?

## Recommended content

### Monthly summary

```text
This month
You spent 18% less than last month.
```

### Insight cards

Possible cards:

- top spending category
- largest expense
- spending change
- personal vs shared spending
- unsettled balances
- receipts attached
- imported transactions later
- tax readiness later

### Charts

Use at most one or two restrained charts.

Charts must answer a clear question.

Avoid:

- decorative pie charts
- trading-style graphs
- dense dashboards
- charts without actionable meaning

## Tone

Insights should feel like short helpful observations, similar to a personal financial briefing.

---

# Spaces

## Goal

Turn Groups into collaborative financial spaces.

Use "Spaces" in the mobile presentation layer.

Backend models and APIs may remain named groups.

## Space examples

- Japan Trip
- Roommates
- Family Budget
- Camping Weekend
- Business Expenses
- Wedding Planning

## Space card design

Inspired by clean property and travel cards.

Each card may show:

- space name
- optional visual identity or gradient cover
- member initials
- latest activity
- current user balance
- small status label

Example:

```text
Japan Trip

KM  ST  XC

You owe $24
Dinner added 2h ago
```

Avoid fake:

- unread counts
- online status
- typing indicators
- chat previews

## Space detail

Recommended structure:

```text
Overview | Activity | Members
```

Future sections may include:

```text
Plans | Discussion | Chat
```

but should not appear until implemented.

### Overview

Show:

- current user balance
- total shared spending
- quick actions
- pairwise balances
- recent activity

### Activity

Show:

- shared expenses
- settlements
- future member events

### Members

Show:

- member identity
- role
- current-user label
- balance where supported

## Future product direction

Spaces may later support:

- plans
- polls
- discussion posts
- comments
- checklists
- chat
- notifications
- attachments

Keep social models separate from financial models.

---

# Visual Design Direction

## Overall style

- modern dark interface
- calm and trustworthy
- compact information hierarchy
- premium without looking like a bank
- consistent across web and native

## Color roles

- dark navy: primary background
- off-white: primary text
- muted blue-gray: secondary text
- purple: brand and active states
- mint: positive money and success
- coral: outgoing money and warnings

Avoid using purple on every surface.

## Cards

Use fewer but better cards.

Cards should be:

- compact
- easy to scan
- clearly prioritized
- consistent in border radius and padding
- not oversized

Use the property-card inspiration for Spaces:

- clear top visual or identity
- strong title hierarchy
- compact metadata
- obvious primary action

## Typography

Define a clear scale:

- Display: screen hero values
- Heading: screen and section titles
- Body: main content
- Caption: timestamps and supporting metadata
- Label: compact uppercase only where useful

Avoid excessive oversized headings.

## Spacing

Use a consistent spacing system such as:

```text
4, 8, 12, 16, 24, 32
```

Reduce unnecessary vertical empty space while preserving touch comfort.

## Buttons

Use:

- one primary filled action
- one secondary tonal action
- one text action
- destructive action only where necessary

## Empty states

Every empty state should include:

- clear explanation
- one useful action
- no technical wording

Example:

```text
No activity yet

Capture your first expense or income to start your timeline.

[Capture now]
```

## Feedback

Success and error feedback should be:

- short
- contextual
- dismissible
- auto-dismissing where appropriate
- never presented like raw API messages

---

# v0.9 Scope

## Current Priority

1. Create shared design tokens and reusable components.
2. Rename and restructure bottom navigation:
   - Today
   - Activity
   - Capture
   - Insights
   - Spaces
3. Redesign Today.
4. Redesign Activity.
5. Build capture-first action sheet and receipt-first flow.
6. Redesign Insights around useful observations.
7. Rename Groups to Spaces in presentation.
8. Redesign Space cards and Space overview.
9. Improve empty, loading, error, and success states.
10. Improve responsive behavior and accessibility.
11. Review profile/settings access.
12. Prepare native usability checklist.

## Explicitly Deferred

- OCR
- AI extraction
- chat
- polls
- plans
- push notifications
- payment integrations
- recurring transactions
- complex budgeting
- tax automation
- database/API rename from groups to spaces

---

# Implementation Sequence

## Phase 1: Foundation

- audit current components
- define colors, spacing, typography, cards, and button hierarchy
- preserve existing business logic
- rename tabs at the presentation layer
- create Capture action shell

## Phase 2: Today and Activity

- redesign Today
- create mixed activity view model
- group activity by time
- reuse existing personal and space data

## Phase 3: Insights and Spaces

- create useful insight cards from existing data
- rename Groups to Spaces in UI
- redesign Space cards and detail header
- preserve existing routes and APIs

## Phase 4: Capture and Polish

- simplify capture flow
- prioritize receipt scanning
- improve forms and review state
- improve empty/loading/error states
- accessibility and responsive checks

## Phase 5: Usability Trial

Ask at least three users to complete:

1. Add income.
2. Add expense.
3. Capture a receipt.
4. Find a previous activity.
5. Open a Space.
6. Add a shared expense.
7. Record a settlement.
8. Explain their current balance.

Observe hesitation before providing help.

---

# Success Criteria

v0.9 succeeds when a new user can understand Munmai quickly and complete the main workflows without explanation.

The app should feel:

- useful within the first minute
- fast for daily capture
- trustworthy with financial information
- engaging enough to revisit
- distinct from generic expense trackers
- ready for a native MVP release

## Product Story

> Munmai is the Money OS that helps you capture what happened, understand where you stand, and manage money together.
