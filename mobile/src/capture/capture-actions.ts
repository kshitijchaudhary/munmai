export type CaptureActionId =
  | 'scan-document'
  | 'manual-entry';

export interface CaptureAction {
  description: string;
  id: CaptureActionId;
  label: string;
  pathname: string | null;
  primary: boolean;
}

interface CaptureRoutes {
  transactionForm: string;
}

export function getCaptureActions(routes: CaptureRoutes): readonly CaptureAction[] {
  return [
    {
      id: 'scan-document',
      label: 'Scan document',
      description: 'Take a photo and review the transaction.',
      pathname: null,
      primary: true,
    },
    {
      id: 'manual-entry',
      label: 'Manual entry',
      description: 'Enter income or expense details yourself.',
      pathname: routes.transactionForm,
      primary: false,
    },
  ] as const;
}
