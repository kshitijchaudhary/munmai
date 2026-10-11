import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import process from 'node:process';
import { calculateSafeToSpend } from '../../server/services/safeToSpendService.js';
import { prepareNextPlanningCycle } from '../../server/services/planningRecurrenceService.js';

// Run against a local build with isolated API fixtures. No real account/data writes.
const enabled = Boolean(process.env.PLANNING_UI_URL && process.env.PLANNING_PLAYWRIGHT_PATH);
const require = createRequire(import.meta.url);
const payment = (id, name, amount, dueDate, recurring = false, amountType = null) => ({
  _id: id, name, amount, dueDate, certainty: 'confirmed', category: 'bill', note: '',
  recurring, amountType, cadence: recurring ? 'monthly' : null,
});
const baseline = {
  currentCash: 100, essentialBuffer: 300, nextPayday: '2099-11-01', currency: 'CAD',
  obligations: [
    payment('fixed', 'Fixed bill', 100, '2099-10-01', true, 'fixed'),
    payment('variable', 'Variable bill', 100, '2099-10-20', true, 'variable'),
    payment('once', 'One-off', 33, '2099-11-01'),
  ],
};

for (const width of [1440, 375, 320]) {
  test(`Planning rendered interactions at ${width}px`, { skip: enabled ? false : 'Set PLANNING_UI_URL and PLANNING_PLAYWRIGHT_PATH to run browser fixtures.' }, async (t) => {
    const { chromium } = require(process.env.PLANNING_PLAYWRIGHT_PATH);
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const origin = new URL(process.env.PLANNING_UI_URL).origin;
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.addInitScript(() => localStorage.setItem('user', JSON.stringify({
      name: 'Planning test', token: 'test.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.fixture',
    })));
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let saved = structuredClone(baseline);
    let mode = 'normal';
    const calls = [];
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith('/api/')) {
        return url.origin === origin ? route.continue() : route.abort();
      }
      const path = url.pathname.slice(5);
      const method = route.request().method();
      calls.push(`${method} ${path}`);
      const send = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
      if (path === 'planning' && method === 'PUT') {
        if (mode === 'reject') return send({ message: 'Fixture save rejected' }, 500);
        const payload = route.request().postDataJSON();
        saved = { ...payload, obligations: payload.obligations.map((item, index) => ({ ...item, _id: item._id || `new-${index}` })) };
        return send({ planning: saved });
      }
      if (path === 'planning') return mode === 'plan-read-fail' ? send({ message: 'Plan read failed' }, 500) : send({ planning: saved });
      if (path === 'planning/safe-to-spend') return mode === 'result-read-fail' ? send({ message: 'Result read failed' }, 500) : send(calculateSafeToSpend(saved, { asOf: '2099-10-10' }));
      if (path === 'planning/prepare-next-cycle') return send(prepareNextPlanningCycle(saved, { nextPayday: route.request().postDataJSON().nextPayday, asOf: new Date('2099-10-10T12:00:00Z') }));
      return send(['income', 'expenses'].includes(path) ? [] : {});
    });
    const navigate = async (name) => {
      if (!(await page.getByRole('link', { name, exact: true }).isVisible())) {
        await page.getByRole('button', { name: 'Menu', exact: true }).click();
      }
      await page.getByRole('link', { name, exact: true }).click();
    };
    const waitForRefresh = () => page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Retry refresh' && !button.disabled));
    const writes = () => calls.filter((call) => call === 'PUT planning').length;
    const fresh = async () => {
      await page.goto(`${origin}/planning`);
      await page.getByRole('button', { name: 'Edit plan', exact: true }).waitFor();
    };
    const save = () => page.getByRole('button', { name: /^Save (plan|all changes)$/ }).click();
    const prepare = () => page.getByRole('button', { name: 'Prepare next payday plan', exact: true }).click();
    const assertOnePaymentEditor = async () => assert.equal(await page.locator('input[placeholder="Phone, car payment, Amex"]').count(), 1);
    await fresh();

    await t.test('exclusive tasks preserve details, existing payment, and separate new draft', async () => {
      const breakdown = page.locator('section[aria-labelledby="safe-to-spend-heading"] details');
      assert.equal(await breakdown.evaluate(node => node.open), false);
      await page.getByText('See breakdown', { exact: true }).click();
      await page.getByRole('button', { name: 'Edit plan', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: /^Save (plan|all changes)$/ }).count(), 0);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      assert.equal(await page.locator('#planning-current-cash').count(), 0);
      await page.getByRole('button', { name: 'Edit plan', exact: true }).click();
      await prepare();
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      assert.equal(await page.locator('#planning-current-cash').inputValue(), '100');
      await page.locator('#planning-current-cash').fill('150');
      assert.equal(await breakdown.evaluate(node => node.open), true);
      await page.getByText('See breakdown', { exact: true }).click();
      assert.equal(await page.getByRole('article', { name: 'Fixed bill' }).getByText('Unsaved changes', { exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Edit Fixed bill', exact: true }).click();
      assert.equal(await page.locator('#planning-current-cash').count(), 0);
      await page.getByLabel('How much?', { exact: false }).fill('120');
      await page.getByRole('button', { name: 'Edit Variable bill', exact: true }).click();
      await assertOnePaymentEditor();
      await page.getByRole('button', { name: 'Edit Fixed bill', exact: true }).click();
      assert.equal(await page.getByLabel('How much?', { exact: false }).inputValue(), '120');
      await page.getByRole('button', { name: '+ Add payment', exact: true }).click();
      await assertOnePaymentEditor();
      const draft = page.locator('#new-payment-editor');
      await draft.locator('input[id$="-name"]').fill('Pending payment');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.evaluate(() => window.scrollTo(0, 0));
      if (process.env.PLANNING_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.PLANNING_SCREENSHOT_DIR}/payment-flow-${width}.png`, fullPage: true });
      await prepare();
      assert.equal(await page.locator('input[placeholder="Phone, car payment, Amex"]').count(), 0);
      await page.getByRole('button', { name: 'Cancel preview', exact: true }).click();
      assert.equal(await draft.locator('input[id$="-name"]').inputValue(), 'Pending payment');
      await draft.getByRole('button', { name: 'Cancel', exact: true }).click();
      await assertOnePaymentEditor();
      assert.equal(await page.getByLabel('How much?', { exact: false }).inputValue(), '120');
      await page.getByRole('button', { name: 'Edit plan', exact: true }).click();
      assert.equal(await page.locator('#planning-current-cash').inputValue(), '150');
      assert.equal(await page.locator('input[placeholder="Phone, car payment, Amex"]').count(), 0);
      await page.getByRole('button', { name: 'Cancel all changes', exact: true }).click();
    });

    await t.test('preview replacement includes unadded draft, Back retains date, review preserves values', async () => {
      await page.getByRole('button', { name: '+ Add payment', exact: true }).click();
      await page.locator('#new-payment-editor input[id$="-name"]').fill('Unadded edit');
      await prepare();
      await page.getByLabel('New next payday', { exact: true }).fill('2099-12-01');
      await page.getByRole('button', { name: 'Preview next plan', exact: true }).click();
      await page.getByRole('button', { name: 'Use this plan', exact: true }).waitFor();
      await page.getByText('Some payments need a new amount. Review them before saving.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      assert.equal(await page.getByLabel('New next payday', { exact: true }).inputValue(), '2099-12-01');
      await page.getByRole('button', { name: 'Preview next plan', exact: true }).click();
      await page.getByRole('button', { name: 'Use this plan', exact: true }).click();
      await page.getByRole('button', { name: 'Discard edits and use prepared plan', exact: true }).waitFor();
      assert.equal(writes(), 0);
      await page.getByRole('button', { name: 'Keep current plan', exact: true }).click();
      assert.equal(await page.locator('#new-payment-editor input[id$="-name"]').inputValue(), 'Unadded edit');
      await prepare();
      await page.getByRole('button', { name: 'Use this plan', exact: true }).click();
      await page.getByRole('button', { name: 'Discard edits and use prepared plan', exact: true }).click();
      assert.equal(await page.locator('#planning-current-cash').inputValue(), '');
      assert.equal(await page.locator('#new-payment-editor').count(), 0);
      assert.equal(saved.nextPayday, baseline.nextPayday);
      await page.locator('#planning-current-cash').fill('900');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.evaluate(() => window.scrollTo(0, 0));
      if (process.env.PLANNING_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.PLANNING_SCREENSHOT_DIR}/review-flow-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Back to preview', exact: true }).click();
      await page.getByRole('button', { name: 'Use this plan', exact: true }).click();
      assert.equal(await page.locator('#planning-current-cash').inputValue(), '900');
      await page.getByRole('button', { name: 'Cancel all changes', exact: true }).click();
    });

    await t.test('router Stay/Discard, removal and new-draft guards, native warning only for pending values', async () => {
      assert.equal(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }), false);
      await page.getByRole('button', { name: 'Remove Fixed bill', exact: true }).click();
      await navigate('Dashboard');
      const dialog = page.getByRole('dialog', { name: 'Leave your payday plan?' });
      await dialog.waitFor();
      await dialog.getByRole('button', { name: 'Stay', exact: true }).click();
      assert.equal(await page.getByRole('article', { name: 'Fixed bill' }).count(), 0);
      assert.equal(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }), true);
      let nativeWarning = false;
      page.once('dialog', async (prompt) => { nativeWarning = prompt.type() === 'beforeunload'; await prompt.dismiss(); });
      await page.reload({ timeout: 1000 }).catch(() => {});
      assert.equal(nativeWarning, true);
      assert.equal(await page.getByRole('article', { name: 'Fixed bill' }).count(), 0);
      await navigate('Dashboard');
      await dialog.getByRole('button', { name: 'Discard and leave', exact: true }).click();
      await page.waitForURL('**/dashboard');
      await navigate('Plan');
      await page.getByRole('button', { name: '+ Add payment', exact: true }).click();
      await page.evaluate(() => history.back());
      await dialog.waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#new-payment-editor').count(), 1);
      await page.locator('#new-payment-editor').getByRole('button', { name: 'Cancel', exact: true }).click();
    });

    await t.test('failed PUT retains edits; both partial read failures recover with reads only', async () => {
      await page.getByRole('button', { name: 'Edit plan', exact: true }).click();
      await page.locator('#planning-current-cash').fill('150');
      mode = 'reject'; await save();
      await page.getByText('Fixture save rejected', { exact: true }).waitFor();
      assert.equal(await page.locator('#planning-current-cash').inputValue(), '150');
      for (const failure of ['result-read-fail', 'plan-read-fail']) {
        mode = failure;
        await save();
        await waitForRefresh();
        assert.equal(await page.locator('#safe-to-spend-heading').innerText(), 'Saved result unavailable');
        const count = writes();
        // A second partial refresh cannot mix a fresh result with an older plan baseline.
        mode = failure === 'plan-read-fail' ? 'result-read-fail' : 'plan-read-fail';
        await page.getByRole('button', { name: 'Retry refresh', exact: true }).click();
        await waitForRefresh();
        assert.equal(writes(), count);
        assert.equal(await page.locator('#safe-to-spend-heading').innerText(), 'Saved result unavailable');
        mode = 'normal';
        await page.getByRole('button', { name: 'Retry refresh', exact: true }).click();
        await page.getByText('Saved result refreshed.', { exact: true }).waitFor();
        assert.equal(writes(), count);
        await page.getByRole('button', { name: 'Edit plan', exact: true }).click();
        await page.locator('#planning-current-cash').fill(failure === 'result-read-fail' ? '200' : '250');
      }
      await page.getByRole('button', { name: 'Cancel all changes', exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.evaluate(() => window.scrollTo(0, 0));
      if (process.env.PLANNING_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.PLANNING_SCREENSHOT_DIR}/focused-flow-${width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
    });
    await t.test('one added unknown payment retains its ID through edit, shared save and reload', async () => {
      await page.getByRole('button', { name: '+ Add payment', exact: true }).click();
      const draft = page.locator('#new-payment-editor');
      await draft.getByRole('button', { name: 'Add to plan', exact: true }).click();
      assert.equal(await draft.count(), 1);
      assert.equal(await page.getByRole('article').count(), saved.obligations.length);
      await draft.locator('input[id$="-name"]').fill('Added bill');
      await draft.locator('input[id$="-dueDate"]').fill('2099-10-31');
      await draft.getByLabel("I don't know the amount yet", { exact: true }).check();
      // Activate the same control twice before React closes it; avoid clicking a different control after layout changes.
      await draft.getByRole('button', { name: 'Add to plan', exact: true }).evaluate(button => { button.click(); button.click(); });
      assert.equal(await page.getByRole('article', { name: 'Added bill' }).count(), 1);
      assert.equal(await page.locator('#new-payment-editor').count(), 0);
      await save();
      await page.getByText('Plan saved', { exact: true }).waitFor();
      const id = saved.obligations.find(item => item.name === 'Added bill')._id;
      await page.getByRole('button', { name: 'Edit Added bill', exact: true }).click();
      await page.getByLabel('What is it?', { exact: true }).fill('Renamed bill');
      await save();
      await page.getByText('Plan saved', { exact: true }).waitFor();
      assert.equal(saved.obligations.find(item => item.name === 'Renamed bill')._id, id);
      assert.equal(saved.obligations.find(item => item._id === 'fixed').amount, 100);
      await fresh();
      assert.equal(await page.getByRole('article', { name: 'Renamed bill' }).count(), 1);
    });
    await t.test('prepared-plan partial save has no remaining draft and can retry reads without another PUT', async () => {
      await prepare();
      await page.getByLabel('New next payday', { exact: true }).fill('2100-01-01');
      await page.getByRole('button', { name: 'Preview next plan', exact: true }).click();
      await page.getByRole('button', { name: 'Use this plan', exact: true }).click();
      await page.locator('#planning-current-cash').fill('500');
      mode = 'result-read-fail';
      await save(); await waitForRefresh();
      assert.equal(await page.getByText('Unsaved changes', { exact: true }).count(), 0);
      const count = writes(); mode = 'normal';
      await page.getByRole('button', { name: 'Retry refresh', exact: true }).click();
      await page.getByText('Saved result refreshed.', { exact: true }).waitFor();
      assert.equal(writes(), count);
      assert.equal(saved.nextPayday, '2100-01-01');
    });
    await t.test('sign-out stays authenticated until explicit discard', async () => {
      await page.getByRole('button', { name: 'Edit plan', exact: true }).click();
      await page.locator('#planning-current-cash').fill('550');
      const signOut = async () => {
        if (!(await page.getByRole('button', { name: 'Sign Out', exact: true }).isVisible())) await page.getByRole('button', { name: 'Menu', exact: true }).click();
        await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
      };
      await signOut();
      const dialog = page.getByRole('dialog', { name: 'Leave your payday plan?' });
      await dialog.getByRole('button', { name: 'Stay', exact: true }).click();
      assert.equal(await page.locator('#planning-current-cash').inputValue(), '550');
      assert.equal(await page.evaluate(() => Boolean(localStorage.getItem('user'))), true);
      await signOut();
      await dialog.getByRole('button', { name: 'Discard and leave', exact: true }).click();
      await page.waitForURL('**/login');
      assert.equal(await page.evaluate(() => localStorage.getItem('user')), null);
    });
  });
}
