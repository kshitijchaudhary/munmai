import { Stack, useLocalSearchParams } from 'expo-router';

import { AddTransactionScreen } from '@/screens/add-transaction-screen';

export default function AddTransactionRoute() {
  const { capture, intent, type } = useLocalSearchParams<{
    capture?: string;
    intent?: string;
    type?: string;
  }>();
  const initialType = type === 'income' ? 'income' : 'expense';
  const formKey = `${initialType}-${intent ?? 'direct'}-${capture ?? 'standard'}`;

  return (
    <>
      <Stack.Screen
        options={{ title: capture === 'receipt' ? 'Scan receipt' : 'Add transaction' }}
      />
      <AddTransactionScreen
        key={formKey}
        initialType={initialType}
        receiptFirst={capture === 'receipt'}
      />
    </>
  );
}
