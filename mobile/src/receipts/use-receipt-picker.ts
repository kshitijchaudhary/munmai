import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import {
  normalizeReceiptImage,
  receiptSelectionReducer,
  type ReceiptImage,
} from '@/receipts/receipt-image';

type ReceiptPickerSource = 'camera' | 'library';

export interface ReceiptPermissionIssue {
  canOpenSettings: boolean;
  message: string;
  source: ReceiptPickerSource;
}

export interface ReceiptPickerState {
  chooseFromLibrary: () => Promise<void>;
  isPicking: boolean;
  openSettings: () => Promise<void>;
  permissionIssue: ReceiptPermissionIssue | null;
  pickerError: string | null;
  receipt: ReceiptImage | null;
  removeReceipt: () => void;
  takePhoto: () => Promise<void>;
}

const pickerOptions: ImagePicker.ImagePickerOptions = {
  allowsEditing: false,
  allowsMultipleSelection: false,
  mediaTypes: ['images'],
};

function permissionMessage(source: ReceiptPickerSource, canAskAgain: boolean): string {
  const permissionName = source === 'camera' ? 'camera' : 'photo library';

  if (!canAskAgain) {
    return `Munmai cannot access your ${permissionName}. Open system settings to allow access, or continue without a receipt.`;
  }

  return `Allow ${permissionName} access to attach a receipt, or continue without one.`;
}

export function useReceiptPicker(): ReceiptPickerState {
  const [receipt, dispatchReceipt] = useReducer(receiptSelectionReducer, null);
  const [permissionIssue, setPermissionIssue] = useState<ReceiptPermissionIssue | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const pickingRef = useRef(false);
  const mountedRef = useRef(true);

  const handleAsset = useCallback((asset: ImagePicker.ImagePickerAsset) => {
    if (Platform.OS === 'web' && !asset.file) {
      setPickerError(
        'This browser did not provide an uploadable image file. Choose another receipt image.',
      );
      return;
    }

    const result = normalizeReceiptImage({
      uri: asset.uri,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType,
      type: asset.type,
      webFile: asset.file,
    });

    if (!result.ok) {
      setPickerError(result.message);
      return;
    }

    dispatchReceipt({ type: 'select', image: result.image });
    setPermissionIssue(null);
    setPickerError(null);
  }, []);

  const handlePickerResult = useCallback(
    (result: ImagePicker.ImagePickerResult) => {
      if (!result.canceled && result.assets[0]) {
        handleAsset(result.assets[0]);
      }
    },
    [handleAsset],
  );

  useEffect(() => {
    let active = true;
    mountedRef.current = true;

    void ImagePicker.getPendingResultAsync()
      .then((result) => {
        if (!active || !result) {
          return;
        }

        if ('canceled' in result) {
          handlePickerResult(result);
        } else {
          setPickerError(result.message || 'Munmai could not recover the selected image.');
        }
      })
      .catch(() => {
        if (active) {
          setPickerError('Munmai could not recover the selected image. Choose it again.');
        }
      });

    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, [handlePickerResult]);

  const requestPermission = useCallback(async (source: ReceiptPickerSource) => {
    if (Platform.OS === 'web') {
      return true;
    }

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.granted) {
      return true;
    }

    if (mountedRef.current) {
      setPermissionIssue({
        source,
        canOpenSettings: !permission.canAskAgain,
        message: permissionMessage(source, permission.canAskAgain),
      });
    }
    return false;
  }, []);

  const launchPicker = useCallback(
    async (source: ReceiptPickerSource) => {
      if (pickingRef.current) {
        return;
      }

      pickingRef.current = true;
      setIsPicking(true);
      setPermissionIssue(null);
      setPickerError(null);

      try {
        if (Platform.OS !== 'web') {
          const hasPermission = await requestPermission(source);

          if (!hasPermission) {
            return;
          }
        }

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync(pickerOptions)
            : await ImagePicker.launchImageLibraryAsync(pickerOptions);

        if (mountedRef.current) {
          handlePickerResult(result);
        }
      } catch {
        if (mountedRef.current) {
          setPickerError(
            source === 'camera'
              ? 'Munmai could not open the camera. Try again or choose from your library.'
              : 'Munmai could not open your photo library. Try again or continue without a receipt.',
          );
        }
      } finally {
        pickingRef.current = false;

        if (mountedRef.current) {
          setIsPicking(false);
        }
      }
    },
    [handlePickerResult, requestPermission],
  );

  const takePhoto = useCallback(() => launchPicker('camera'), [launchPicker]);
  const chooseFromLibrary = useCallback(() => launchPicker('library'), [launchPicker]);

  const removeReceipt = useCallback(() => {
    dispatchReceipt({ type: 'remove' });
    setPermissionIssue(null);
    setPickerError(null);
  }, []);

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      if (mountedRef.current) {
        setPickerError('Open your device settings to allow receipt access for Munmai.');
      }
    }
  }, []);

  return {
    chooseFromLibrary,
    isPicking,
    openSettings,
    permissionIssue,
    pickerError,
    receipt,
    removeReceipt,
    takePhoto,
  };
}
