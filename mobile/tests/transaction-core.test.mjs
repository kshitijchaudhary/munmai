import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  MAX_MONEY_AMOUNT,
  MONEY_AMOUNT_MAX_MESSAGE,
  MONEY_AMOUNT_MIN_MESSAGE,
  MONEY_AMOUNT_NUMBER_MESSAGE,
  MONEY_AMOUNT_POSITIVE_MESSAGE,
  MONEY_AMOUNT_PRECISION_MESSAGE,
} from '../src/money/money-amount.js';
import {
  buildTransactionRequest,
  confirmOldTransactionSubmission,
  createInitialTransactionFormValues,
  formatTransactionDateValue,
  getLocalDateFromValue,
  getLocalDateValue,
  getMinimumTransactionDateValue,
  getOldTransactionCutoffValue,
  OLD_TRANSACTION_CONFIRMATION_MESSAGE,
  requiresOldTransactionConfirmation,
  resolveTransactionDateSelection,
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
      amount: MONEY_AMOUNT_POSITIVE_MESSAGE,
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
      amount: MONEY_AMOUNT_NUMBER_MESSAGE,
      date: 'Use a valid date in YYYY-MM-DD format.',
    },
  );
});

test('transaction amounts match the backend precision and maximum constraints', () => {
  for (const amount of [
    '0.01',
    '0.10',
    '1.2',
    '1.20',
    '12.34',
    '999.99',
    '99999999.99',
    String(MAX_MONEY_AMOUNT),
  ]) {
    assert.deepEqual(
      validateTransactionForm(
        {
          type: 'income',
          amount,
          description: 'Payroll',
          date: '2026-07-16',
        },
        today,
      ),
      {},
    );
  }

  const invalidCases = [
    ['0.00000000000000000001', MONEY_AMOUNT_MIN_MESSAGE],
    ['1.999', MONEY_AMOUNT_PRECISION_MESSAGE],
    ['0.001', MONEY_AMOUNT_MIN_MESSAGE],
    ['0.005', MONEY_AMOUNT_MIN_MESSAGE],
    ['12.345', MONEY_AMOUNT_PRECISION_MESSAGE],
    ['99999999.99999999', MONEY_AMOUNT_PRECISION_MESSAGE],
    ['100000000.001', MONEY_AMOUNT_PRECISION_MESSAGE],
    ['100000000.009', MONEY_AMOUNT_PRECISION_MESSAGE],
    ['0', MONEY_AMOUNT_POSITIVE_MESSAGE],
    ['-1', MONEY_AMOUNT_POSITIVE_MESSAGE],
    ['Infinity', MONEY_AMOUNT_NUMBER_MESSAGE],
    ['not-money', MONEY_AMOUNT_NUMBER_MESSAGE],
    [String(MAX_MONEY_AMOUNT + 0.01), MONEY_AMOUNT_MAX_MESSAGE],
  ];

  for (const type of ['income', 'expense']) {
    for (const [amount, message] of invalidCases) {
      assert.deepEqual(
        validateTransactionForm(
          {
            type,
            amount,
            description: type === 'income' ? 'Payroll' : 'Vendor',
            date: '2026-07-16',
          },
          today,
        ),
        { amount: message },
      );
    }
  }
});

test('transaction payloads preserve canonical amounts without rounding', () => {
  const oneDecimal = buildTransactionRequest(
    {
      type: 'income',
      amount: '1.2',
      description: 'Payroll',
      date: '2026-07-16',
    },
    today,
  );
  const exactMaximum = buildTransactionRequest(
    {
      type: 'expense',
      amount: String(MAX_MONEY_AMOUNT),
      description: 'Vendor',
      date: '2026-07-16',
    },
    today,
  );

  assert.equal(oneDecimal.payload.amount, 1.2);
  assert.equal(exactMaximum.payload.amount, MAX_MONEY_AMOUNT);
  assert.throws(
    () =>
      buildTransactionRequest(
        {
          type: 'expense',
          amount: '1.999',
          description: 'Vendor',
          date: '2026-07-16',
        },
        today,
      ),
    /invalid form values/i,
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

test('transaction validation rejects future dates and dates before the rolling 12-month minimum', () => {
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
        date: '2025-07-15',
      },
      today,
    ),
    { date: 'Date must be on or after Jul 16, 2025.' },
  );
});

test('rolling minimum accepts its boundary and remains local-calendar safe for leap days', () => {
  assert.equal(getMinimumTransactionDateValue(today), '2025-07-16');
  assert.equal(
    getMinimumTransactionDateValue(new Date(2024, 1, 29, 12)),
    '2023-02-28',
  );

  for (const date of ['2026-07-16', '2026-07-15', '2025-07-16']) {
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

test('selected transaction dates display clearly and keep their API value', () => {
  const selectedDate = getLocalDateFromValue('2026-07-22');

  assert.equal(formatTransactionDateValue('2026-07-22'), 'Jul 22, 2026');
  assert.equal(getLocalDateValue(selectedDate), '2026-07-22');
});

test('income and expense payloads submit the same chosen local calendar date', () => {
  const chosenDate = '2026-07-14';
  const income = buildTransactionRequest(
    { type: 'income', amount: '100', description: 'Client', date: chosenDate },
    today,
  );
  const expense = buildTransactionRequest(
    { type: 'expense', amount: '20', description: 'Market', date: chosenDate },
    today,
  );

  assert.equal(income.payload.date, chosenDate);
  assert.equal(expense.payload.date, chosenDate);
});

test('date-picker cancellation preserves the previous Android date', () => {
  assert.equal(
    resolveTransactionDateSelection('2026-07-15', undefined),
    '2026-07-15',
  );
  assert.equal(
    resolveTransactionDateSelection('2026-07-15', new Date(2026, 6, 12, 12)),
    '2026-07-12',
  );
});

test('local calendar conversion is stable across Toronto and extreme time zones', () => {
  const moduleUrl = new URL('../src/transactions/transaction-form.ts', import.meta.url).href;
  const script = `
    import {
      formatTransactionDateValue,
      getLocalDateFromValue,
      getLocalDateValue,
      getMinimumTransactionDateValue,
      getOldTransactionCutoffValue,
    } from ${JSON.stringify(moduleUrl)};
    const parsed = getLocalDateFromValue('2026-07-22');
    const referenceDate = new Date(2026, 6, 16, 12);
    process.stdout.write(JSON.stringify({
      apiValue: getLocalDateValue(parsed),
      displayValue: formatTransactionDateValue('2026-07-22'),
      minimumValue: getMinimumTransactionDateValue(referenceDate),
      oldDateCutoff: getOldTransactionCutoffValue(referenceDate),
    }));
  `;

  for (const timeZone of ['America/Toronto', 'Pacific/Kiritimati', 'Pacific/Honolulu']) {
    const result = spawnSync(
      process.execPath,
      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e', script],
      {
        encoding: 'utf8',
        env: { ...process.env, TZ: timeZone },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      apiValue: '2026-07-22',
      displayValue: 'Jul 22, 2026',
      minimumValue: '2025-07-16',
      oldDateCutoff: '2026-04-17',
    });
  }
});

test('old-transaction confirmation starts only after the 90-day boundary', () => {
  assert.equal(getOldTransactionCutoffValue(today), '2026-04-17');
  assert.equal(requiresOldTransactionConfirmation('2026-04-18', today), false);
  assert.equal(requiresOldTransactionConfirmation('2026-04-17', today), false);
  assert.equal(requiresOldTransactionConfirmation('2026-04-16', today), true);
});

test('income and expense old dates require the same confirmation', () => {
  for (const type of ['income', 'expense']) {
    const values = {
      type,
      amount: '25',
      description: type === 'income' ? 'Client' : 'Vendor',
      date: '2026-04-16',
    };

    assert.deepEqual(validateTransactionForm(values, today), {});
    assert.equal(requiresOldTransactionConfirmation(values.date, today), true);
  }
});

test('cancelling old-transaction confirmation preserves the form and blocks submission', async () => {
  const values = {
    type: 'expense',
    amount: '25',
    description: 'Vendor',
    date: '2026-04-16',
  };
  const originalValues = { ...values };
  const messages = [];

  const confirmed = await confirmOldTransactionSubmission(
    values.date,
    (message) => {
      messages.push(message);
      return false;
    },
    today,
  );

  assert.equal(confirmed, false);
  assert.deepEqual(messages, [OLD_TRANSACTION_CONFIRMATION_MESSAGE]);
  assert.deepEqual(values, originalValues);
});

test('accepted old dates proceed while current and 90-day boundary dates skip confirmation', async () => {
  let confirmationCount = 0;
  const confirm = () => {
    confirmationCount += 1;
    return true;
  };

  assert.equal(
    await confirmOldTransactionSubmission('2026-04-16', confirm, today),
    true,
  );
  assert.equal(
    await confirmOldTransactionSubmission('2026-04-17', confirm, today),
    true,
  );
  assert.equal(
    await confirmOldTransactionSubmission('2026-07-16', confirm, today),
    true,
  );
  assert.equal(confirmationCount, 1);
});
