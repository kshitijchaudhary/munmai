export type CaptureActionId =
  | 'scan-receipt'
  | 'add-expense'
  | 'add-income'
  | 'split-expense';

export interface CaptureAction {
  description: string;
  id: CaptureActionId;
  label: string;
  pathname: string;
  params?: Readonly<Record<string, string>>;
}

interface CaptureRoutes {
  groups: string;
  transactionForm: string;
}

export function getCaptureActions(routes: CaptureRoutes): readonly CaptureAction[] {
  return [
    {
      id: 'scan-receipt',
      label: 'Scan receipt',
      description: 'Add a receipt image to a new expense.',
      pathname: routes.transactionForm,
      params: { capture: 'receipt', type: 'expense' },
    },
    {
      id: 'add-expense',
      label: 'Add expense',
      description: 'Record money you spent.',
      pathname: routes.transactionForm,
      params: { type: 'expense' },
    },
    {
      id: 'add-income',
      label: 'Add income',
      description: 'Record money you received.',
      pathname: routes.transactionForm,
      params: { type: 'income' },
    },
    {
      id: 'split-expense',
      label: 'Split expense',
      description: 'Choose a Space and add a shared expense.',
      pathname: routes.groups,
      params: { intent: 'split' },
    },
  ] as const;
}
