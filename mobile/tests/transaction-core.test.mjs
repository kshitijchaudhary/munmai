import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTransactionRequest,
  createInitialTransactionFormValues,
  getLocalDateValue,
  validateTransactionForm,
} from '../src/transactions/transaction-form.ts';

const today = new Date(2026, 6, 16, 12);

test('transaction validation requires positive amount, description, and a real calendar date', () => {
  assert.deepEqual(
    validateTransactionForm({ type: 'income', amount: '', description: '  ', date: '' }, today),
    {
      amount: 'Amount is required.',
      description: 'Source is required.',
      date: 'Date is required.',
    },
  );
  assert.deepEqual(
    validateTransactionForm(
      {
        type: 'expense',
        amount: '-4.50',
        description: '',
        date: '2026-02-30',
      },
      today,
    ),
    {
      amount: 'Enter an amount greater than 0.',
      description: 'Vendor is required.',
      date: 'Use a valid date in YYYY-MM-DD format.',
    },
  );
  assert.deepEqual(
    validateTransactionForm(
      {
        type: 'expense',
        amount: 'not-money',
        description: 'Vendor',
        date: '07/16/2026',
      },
      today,
    ),
    {
      amount: 'Enter an amount greater than 0.',
      date: 'Use a valid date in YYYY-MM-DD format.',
    },
  );
});

test('income payload trims source and uses only backend-supported fields', () => {
  assert.deepEqual(
    buildTransactionRequest(
      {
        type: 'income',
        amount: ' 1250.50 ',
        description: '  Acme Payroll  ',
        date: '2026-07-16',
      },
      today,
    ),
    {
      type: 'income',
      payload: {
        amount: 1250.5,
        source: 'Acme Payroll',
        category: 'Uncategorized',
        date: '2026-07-16',
      },
    },
  );
});

test('expense payload trims vendor and matches personal non-deductible defaults', () => {
  assert.deepEqual(
    buildTransactionRequest(
      {
        type: 'expense',
        amount: '42.75',
        description: '  Corner Market ',
        date: '2026-07-15',
      },
      today,
    ),
    {
      type: 'expense',
      payload: {
        amount: 42.75,
        recipient: 'Corner Market',
        category: 'Other',
        expenseType: 'personal',
        deductible: false,
        date: '2026-07-15',
      },
    },
  );
});

test('invalid values cannot produce a transaction payload', () => {
  assert.throws(
    () =>
      buildTransactionRequest(
        {
          type: 'expense',
          amount: '0',
          description: 'Vendor',
          date: '2026-07-15',
        },
        today,
      ),
    /invalid form values/i,
  );
});

test('transaction validation rejects future and unsupported old dates without mutation', () => {
  const futureValues = {
    type: 'income',
    amount: '25',
    description: 'Client',
    date: '2026-07-17',
  };
  const originalValues = { ...futureValues };

  assert.deepEqual(validateTransactionForm(futureValues, today), {
    date: 'Date cannot be in the future.',
  });
  assert.deepEqual(futureValues, originalValues);
  assert.deepEqual(
    validateTransactionForm(
      {
        type: 'expense',
        amount: '25',
        description: 'Vendor',
        date: '1999-12-31',
      },
      today,
    ),
    { date: 'Date must be on or after January 1, 2000.' },
  );
});

test('transaction validation accepts today and supported past dates', () => {
  for (const date of ['2026-07-16', '2026-07-15', '2000-01-01']) {
    assert.deepEqual(
      validateTransactionForm(
        { type: 'expense', amount: '25', description: 'Vendor', date },
        today,
      ),
      {},
    );
  }
});

test('new transaction values use a local YYYY-MM-DD date and reset to expense', () => {
  assert.equal(getLocalDateValue(new Date(2026, 0, 5, 12)), '2026-01-05');
  assert.deepEqual(createInitialTransactionFormValues('income'), {
    type: 'income',
    amount: '',
    description: '',
    date: getLocalDateValue(),
  });
  assert.equal(createInitialTransactionFormValues().type, 'expense');
});
