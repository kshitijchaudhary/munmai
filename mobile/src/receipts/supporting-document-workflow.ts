export interface PendingSupportingDocumentWorkflow<TPayload, TAttachment> {
  attachment: TAttachment | null;
  createdTransactionId: string | null;
  payload: TPayload;
}

interface SupportingDocumentWorkflowServices<TPayload, TAttachment> {
  createTransaction: (
    payload: TPayload,
    signal?: AbortSignal,
  ) => Promise<{ _id: string }>;
  uploadDocument: (
    transactionId: string,
    payload: TPayload,
    attachment: TAttachment,
    signal?: AbortSignal,
  ) => Promise<unknown>;
}

interface SupportingDocumentWorkflowOptions<TStage extends string> {
  invalidResponseMessage: string;
  savingStage: TStage;
  uploadingStage: TStage;
}

export interface SupportingDocumentMutationCallbacks {
  onDocumentUploaded?: (transactionId: string) => void;
  onTransactionCreated?: (transactionId: string) => void;
}

export type SupportingDocumentWorkflowResult<TPayload, TAttachment> =
  | { status: 'complete'; transactionId: string }
  | {
      error: unknown;
      pending: PendingSupportingDocumentWorkflow<TPayload, TAttachment>;
      status: 'create-failed' | 'upload-failed';
    };

function notifyMutation(
  callback: ((transactionId: string) => void) | undefined,
  transactionId: string,
  label: string,
): void {
  if (!callback) {
    return;
  }

  try {
    callback(transactionId);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`${label} refresh notification failed`, error);
    }
  }
}

export function createPendingSupportingDocumentWorkflow<TPayload, TAttachment>(
  payload: TPayload,
  attachment: TAttachment | null,
): PendingSupportingDocumentWorkflow<TPayload, TAttachment> {
  return {
    attachment,
    createdTransactionId: null,
    payload: { ...payload },
  };
}

export async function executeSupportingDocumentWorkflow<
  TPayload,
  TAttachment,
  TStage extends string,
>(
  pending: PendingSupportingDocumentWorkflow<TPayload, TAttachment>,
  services: SupportingDocumentWorkflowServices<TPayload, TAttachment>,
  options: SupportingDocumentWorkflowOptions<TStage>,
  signal?: AbortSignal,
  onStageChange?: (stage: TStage) => void,
  onMutation?: SupportingDocumentMutationCallbacks,
): Promise<SupportingDocumentWorkflowResult<TPayload, TAttachment>> {
  let transactionId = pending.createdTransactionId;

  if (!transactionId) {
    onStageChange?.(options.savingStage);

    try {
      const createdTransaction = await services.createTransaction(pending.payload, signal);

      if (!createdTransaction._id?.trim()) {
        throw new Error(options.invalidResponseMessage);
      }

      transactionId = createdTransaction._id;
    } catch (error) {
      return { status: 'create-failed', error, pending };
    }

    notifyMutation(
      onMutation?.onTransactionCreated,
      transactionId,
      'Transaction creation',
    );
  }

  if (!pending.attachment) {
    return { status: 'complete', transactionId };
  }

  const uploadPending = { ...pending, createdTransactionId: transactionId };
  onStageChange?.(options.uploadingStage);

  try {
    await services.uploadDocument(
      transactionId,
      pending.payload,
      pending.attachment,
      signal,
    );
  } catch (error) {
    return { status: 'upload-failed', error, pending: uploadPending };
  }

  notifyMutation(
    onMutation?.onDocumentUploaded,
    transactionId,
    'Supporting document upload',
  );

  return { status: 'complete', transactionId };
}
