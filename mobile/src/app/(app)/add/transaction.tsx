import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { getMatchingCaptureDraft } from '@/capture/capture-draft';
import { useCaptureDraft } from '@/capture/capture-draft-context';
import { AddTransactionScreen } from '@/screens/add-transaction-screen';
import { PUBLIC_ROUTES } from '@/navigation/routes';

export default function AddTransactionRoute() {
  const router = useRouter();
  const { draft: draftId, intent, type } = useLocalSearchParams<{
    draft?: string;
    intent?: string;
    type?: string;
  }>();
  const { clearDraft, draft } = useCaptureDraft();
  const captureDraft = getMatchingCaptureDraft(draft, draftId);
  const initialType = captureDraft?.transactionType ?? (type === 'income' ? 'income' : 'expense');
  const formKey = `${initialType}-${intent ?? 'direct'}-${draftId ?? 'manual'}`;
  const isCaptureTypeLocked = Boolean(
    draftId && (captureDraft?.transactionType || type === 'income' || type === 'expense'),
  );

  const returnToCapture = () => {
    if (captureDraft && router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(PUBLIC_ROUTES.add as Href);
  };

  return (
    <AddTransactionScreen
      key={formKey}
      initialType={initialType}
      initialAttachment={captureDraft?.attachment ?? null}
      isCaptureTypeLocked={isCaptureTypeLocked}
      onBack={returnToCapture}
      onCaptureFinished={() => clearDraft(draftId)}
      onChangeCaptureType={returnToCapture}
    />
  );
}
