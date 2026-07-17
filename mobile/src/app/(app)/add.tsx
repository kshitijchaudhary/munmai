import { useLocalSearchParams } from 'expo-router';

import { AddTransactionScreen } from '@/screens/add-transaction-screen';
import { type TransactionType } from '@/transactions/transaction-form';

export default function AddRoute() {
  const { intent, type } = useLocalSearchParams<{ intent?: string; type?: string }>();
  const initialType: TransactionType = type === 'income' ? 'income' : 'expense';
  const formKey = `${initialType}-${intent ?? 'tab'}`;

  return <AddTransactionScreen key={formKey} initialType={initialType} />;
}
