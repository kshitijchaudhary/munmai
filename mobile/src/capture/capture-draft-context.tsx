import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import {
  clearCaptureDraft,
  createCaptureDraft,
  replaceCaptureDraftAttachment,
  setCaptureDraftType,
  type CaptureDraft,
} from '@/capture/capture-draft';
import type { ReceiptImage } from '@/receipts/receipt-image';
import type { TransactionType } from '@/transactions/transaction-form';

interface CaptureDraftContextValue {
  clearDraft: (id?: string) => void;
  createDraft: (attachment: ReceiptImage, type?: TransactionType | null) => string;
  draft: CaptureDraft | null;
  replaceDraftAttachment: (id: string, attachment: ReceiptImage) => void;
  setDraftType: (id: string, type: TransactionType) => void;
}

const CaptureDraftContext = createContext<CaptureDraftContextValue | null>(null);

export function CaptureDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState<CaptureDraft | null>(null);

  const clearDraft = useCallback((id?: string) => {
    setDraft((current) => clearCaptureDraft(current, id));
  }, []);

  const createDraft = useCallback((attachment: ReceiptImage, type: TransactionType | null = null) => {
    const nextDraft = createCaptureDraft(attachment, type);
    setDraft(nextDraft);
    return nextDraft.id;
  }, []);

  const replaceDraftAttachment = useCallback((id: string, attachment: ReceiptImage) => {
    setDraft((current) => replaceCaptureDraftAttachment(current, id, attachment));
  }, []);

  const setDraftType = useCallback((id: string, type: TransactionType) => {
    setDraft((current) => setCaptureDraftType(current, id, type));
  }, []);

  const value = useMemo(
    () => ({
      clearDraft,
      createDraft,
      draft,
      replaceDraftAttachment,
      setDraftType,
    }),
    [clearDraft, createDraft, draft, replaceDraftAttachment, setDraftType],
  );

  return (
    <CaptureDraftContext.Provider value={value}>
      {children}
    </CaptureDraftContext.Provider>
  );
}

export function useCaptureDraft() {
  const context = useContext(CaptureDraftContext);

  if (!context) {
    throw new Error('useCaptureDraft must be used within a CaptureDraftProvider.');
  }

  return context;
}
