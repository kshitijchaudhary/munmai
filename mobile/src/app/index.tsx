import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/auth-context';

export default function Index() {
  const { status } = useAuth();

  return <Redirect href={status === 'authenticated' ? '/dashboard' : '/sign-in'} />;
}
