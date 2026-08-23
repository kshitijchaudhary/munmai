# Product Principles

These principles preserve the durable product reasoning from earlier Munmai
planning and UX documents without retaining obsolete implementation plans.

## Product role

Munmai should feel like a personal financial companion rather than an
accounting console. It should help a user answer practical questions:

- What happened to my money?
- Am I doing okay this month?
- What needs my attention now?
- Who owes whom in a Space?
- Can I capture this transaction or document and move on?

Munmai is not a bank, trading platform, tax-filing engine, or formal accounting
ledger.

## Daily-use hierarchy

Capabilities should be grouped by how often a person needs them:

1. **Daily:** capture income/expenses and supporting documents; understand the
   immediate financial pulse.
2. **Review:** inspect Activity, statements, receipts, summaries, and records
   that need attention.
3. **Occasional:** administer Spaces, review liabilities, prepare exports,
   establish opening balances, or change settings.

Occasional workflows should remain discoverable without competing with the
daily path.

## Experience principles

- **Lead with the answer.** Decision surfaces should present the useful answer
  first, then make the inputs and explanation easy to inspect or change.
- **Capture first.** Recording what just happened should be fast and obvious.
- **Show meaning, not raw accounting.** Prefer contextual language and one
  meaningful priority over equal-weight metric grids. Use plain language in the
  interface instead of exposing internal domain-model terminology.
- **Explain consequential numbers.** A recommendation should show the inputs,
  inclusions, exclusions, and uncertainty that produced it.
- **Keep the interface calm.** Avoid turning ordinary money tracking into
  administrative work.
- **Make shared money human.** Spaces should explain people, contributions,
  balances, and settlements—not only totals.
- **Use one clear primary action.** A user should understand the next action
  without studying the screen.
- **Use progressive disclosure.** Capture the minimum useful record first and
  expose optional organization when it is relevant.
- **Preserve review before commit.** Imported financial data should be reviewed
  before it creates personal records. A prepared planning cycle likewise stays
  a preview until the user explicitly accepts and saves it.
- **Prefer manual control before automation.** Current cash, payday changes,
  and planning-cycle transitions should remain explicit until automated
  behavior can preserve the same correctness and review safeguards.
- **Keep saved state and previews distinct.** The current plan, a next-cycle
  preview, and unsaved edits must never be presented as the same state.
- **Prefer trustworthy records over speculative automation.** OCR, AI
  classification, and bank sync remain deferred until their lifecycle,
  correction, privacy, and failure behavior can be supported responsibly.

## Current mobile expression

The five mobile destinations reflect these principles:

- **Today:** current context and the highest-priority action.
- **Activity:** chronological personal and shared financial events.
- **Capture:** receipt-first or manual transaction entry.
- **Insights:** restrained summaries supported by current data.
- **Spaces:** collaborative expenses, exact persisted splits, balances, and
  settlements.

This document describes product intent, not a promise that every proposed
future capability is implemented.

## Known UX follow-up

Next-cycle preparation is functionally correct but still more complex than
ideal. Future polish should simplify the Prepare → Preview → Use → Edit → Save
flow without weakening financial safeguards.
