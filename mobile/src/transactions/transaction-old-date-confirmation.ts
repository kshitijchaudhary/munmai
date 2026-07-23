import { Alert } from 'react-native';

export function requestOldTransactionConfirmation(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    let hasResolved = false;
    const settle = (confirmed: boolean) => {
      if (!hasResolved) {
        hasResolved = true;
        resolve(confirmed);
      }
    };

    Alert.alert(
      'Check transaction date',
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => settle(false) },
        { text: 'Add anyway', onPress: () => settle(true) },
      ],
      { cancelable: true, onDismiss: () => settle(false) },
    );
  });
}
