# Munmai v1.2.0 Smoke Test Checklist

Use this checklist before tagging or deploying v1.2.0.

## Account

- [ ] Register a new user with name, username, email, password, and confirm password.
- [ ] Confirm registration fails when username is missing.
- [ ] Confirm duplicate username validation shows a clear error.
- [ ] Confirm username accepts only letters, numbers, and underscores.
- [ ] Request forgot password for an existing account.
- [ ] Confirm forgot password response does not reveal whether the email exists.
- [ ] Open reset password link and set a new password successfully.
- [ ] Confirm reused reset link fails after successful reset.
- [ ] Confirm expired or invalid reset token fails safely.
- [ ] Login with the new password.
- [ ] Open Profile page and confirm name, username, and read-only email render.
- [ ] Update name and username successfully.
- [ ] Confirm duplicate username update fails clearly.

## Invitations

- [ ] From Group Summary, invite an existing Munmai user by email.
- [ ] Confirm inviting an unregistered email shows: "This email is not registered on Munmai yet."
- [ ] Open Group Invitations page as invited user.
- [ ] Confirm inviter name appears when available.
- [ ] Accept an invitation and confirm the group becomes accessible.
- [ ] Decline an invitation and confirm it leaves the pending list.
- [ ] Confirm Group Invitations empty state appears when there are no pending invitations.

## Shared Money

- [ ] Add a shared expense from Group Summary modal.
- [ ] Confirm only active group members appear in payer and participant fields.
- [ ] Confirm pending invitees do not appear in shared expense or settlement member lists.
- [ ] Confirm Group Summary refreshes after shared expense creation.
- [ ] Confirm Balance Breakdown shows You owe, You are owed, and Other group balances.
- [ ] Use Settle button from a balance the current user owes.
- [ ] Confirm settlement form pre-fills payer, receiver, amount, and note.
- [ ] Record settlement and confirm balance updates after refresh.
- [ ] Confirm no-balance empty state says: "No outstanding balances yet. Add a shared expense to start tracking."

## Transactions

- [ ] Open `/money/transactions`.
- [ ] Click `+ Add Transaction` and confirm the modal opens.
- [ ] Open `/money/transactions?type=income#add-transaction` and confirm Income is selected.
- [ ] Add an income transaction successfully.
- [ ] Open `/money/transactions?type=expense#add-transaction` and confirm Expense is selected.
- [ ] Add an expense transaction successfully.
- [ ] Confirm transaction filters still work for All, Income, and Expense.
- [ ] Edit an existing transaction and confirm existing behavior still works.

## Dashboard

- [ ] Confirm top summary cards show only Net Balance, Income Total, Expense Total, and Shared Net Balance.
- [ ] Confirm You Owe and You Are Owed appear in the Shared Money section.
- [ ] Confirm quick action links work for Add Income, Add Expense, View Transactions, and Tax Pack.
- [ ] Confirm Monthly Snapshot cards still show selected month income, expense, and balance.
- [ ] Confirm Spending Breakdown and Recent Transactions still render below the snapshot.
- [ ] Confirm onboarding checklist hides when all steps are complete.

## Group Summary

- [ ] Confirm page header shows group title and subtitle.
- [ ] Confirm top actions are visible: Add Shared Expense, Record Settlement, Invite Member.
- [ ] Confirm each action opens a modal.
- [ ] Confirm invite form is not always visible on the page.
- [ ] Confirm summary cards show Expenses, Settlements, Total Expenses, and Net Balance.
- [ ] Confirm Balance Breakdown remains the primary content section.

## Mobile

- [ ] Test Dashboard on phone width.
- [ ] Test Money Transactions modal on phone width.
- [ ] Test Money Receipts and Tax Pack pages on phone width.
- [ ] Test Groups page on phone width.
- [ ] Test Group Summary modals and Balance Breakdown on phone width.
- [ ] Test Group Invitations page on phone width.
- [ ] Confirm sidebar/mobile navigation remains accessible.
- [ ] Confirm no page has horizontal overflow.
