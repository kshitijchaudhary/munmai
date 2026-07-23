import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import {
  normalizeReceiptImage,
  normalizePdfDocumentPickerResult,
  receiptSelectionReducer,
  type ReceiptImage,
  type SupportingDocumentKind,
} from '@/receipts/receipt-image';
import {
  PDF_DOCUMENT_PICKER_OPTIONS,
} from '@/receipts/document-picker-model';
import { getSupportingDocumentPermissionMessage } from '@/transactions/transaction-attachment-copy';

type ReceiptPickerSource = 'camera' | 'library';

export interface ReceiptPermissionIssue {
  canOpenSettings: boolean;
  message: string;
  source: ReceiptPickerSource;
}

export interface ReceiptPickerState {
  choosePdf: () => Promise<ReceiptImage | null>;
  chooseFromLibrary: () => Promise<ReceiptImage | null>;
  isPicking: boolean;
  openSettings: () => Promise<void>;
  permissionIssue: ReceiptPermissionIssue | null;
  pickerError: string | null;
  receipt: ReceiptImage | null;
  removeReceipt: () => void;
  takePhoto: () => Promise<ReceiptImage | null>;
}

const pickerOptions: ImagePicker.ImagePickerOptions = {
  allowsEditing: false,
  allowsMultipleSelection: false,
  mediaTypes: ['images'],
};

export function useReceiptPicker(
  documentKind: SupportingDocumentKind = 'receipt',
  initialReceipt: ReceiptImage | null = null,
): ReceiptPickerState {
  const [receipt, dispatchReceipt] = useReducer(receiptSelectionReducer, initialReceipt);
  const [permissionIssue, setPermissionIssue] = useState<ReceiptPermissionIssue | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const pickingRef = useRef(false);
  const mountedRef = useRef(true);
  const documentKindRef = useRef(documentKind);

  useEffect(() => {
    documentKindRef.current = documentKind;
  }, [documentKind]);

  const handleAsset = useCallback((asset: ImagePicker.ImagePickerAsset): ReceiptImage | null => {
    const currentDocumentKind = documentKindRef.current;

    if (Platform.OS === 'web' && !asset.file) {
      setPickerError(
        currentDocumentKind === 'income-proof'
          ? 'This browser did not provide an uploadable image file. Choose another income document.'
          : 'This browser did not provide an uploadable image file. Choose another receipt image.',
      );
      return null;
    }

    const result = normalizeReceiptImage(
      {
        uri: asset.uri,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
        type: asset.type,
        webFile: asset.file,
      },
      Date.now(),
      currentDocumentKind,
    );

    if (!result.ok) {
      setPickerError(result.message);
      return null;
    }

    dispatchReceipt({ type: 'select', image: result.image });
    setPermissionIssue(null);
    setPickerError(null);
    return result.image;
  }, []);

  const handlePickerResult = useCallback(
    (result: ImagePicker.ImagePickerResult): ReceiptImage | null => {
      if (!result.canceled && result.assets[0]) {
        return handleAsset(result.assets[0]);
      }

      return null;
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
        message: getSupportingDocumentPermissionMessage(
          source,
          permission.canAskAgain,
          documentKindRef.current,
        ),
      });
    }
    return false;
  }, []);

  const launchPicker = useCallback(
    async (source: ReceiptPickerSource) => {
      if (pickingRef.current) {
        return null;
      }

      pickingRef.current = true;
      setIsPicking(true);
      setPermissionIssue(null);
      setPickerError(null);

      try {
        if (Platform.OS !== 'web') {
          const hasPermission = await requestPermission(source);

          if (!hasPermission) {
            return null;
          }
        }

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync(pickerOptions)
            : await ImagePicker.launchImageLibraryAsync(pickerOptions);

        if (mountedRef.current) {
          return handlePickerResult(result);
        }

        return null;
      } catch {
        if (mountedRef.current) {
          const currentDocumentKind = documentKindRef.current;
          setPickerError(
            source === 'camera'
              ? 'Munmai could not open the camera. Try again or choose from your library.'
              : currentDocumentKind === 'income-proof'
                ? 'Munmai could not open your photo library. Try again or continue without proof of income.'
                : 'Munmai could not open your photo library. Try again or continue without a receipt.',
          );
        }
        return null;
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

  const choosePdf = useCallback(async () => {
    if (pickingRef.current) {
      return null;
    }

    pickingRef.current = true;
    setIsPicking(true);
    setPermissionIssue(null);
    setPickerError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync(PDF_DOCUMENT_PICKER_OPTIONS);

      if (!mountedRef.current) {
        return null;
      }

      const normalized = normalizePdfDocumentPickerResult(
        result,
        documentKindRef.current,
      );

      if (!normalized) {
        return null;
      }

      if (!normalized.ok) {
        setPickerError(normalized.message);
        return null;
      }

      dispatchReceipt({ type: 'select', image: normalized.image });
      return normalized.image;
    } catch {
      if (mountedRef.current) {
        setPickerError(
          documentKindRef.current === 'income-proof'
            ? 'Munmai could not open the file picker. Try again or continue without an income document.'
            : 'Munmai could not open the file picker. Try again or continue without a receipt.',
        );
      }
      return null;
    } finally {
      pickingRef.current = false;

      if (mountedRef.current) {
        setIsPicking(false);
      }
    }
  }, []);

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
        const currentDocumentKind = documentKindRef.current;
        setPickerError(
          currentDocumentKind === 'income-proof'
            ? 'Open your device settings to allow proof-of-income access for Munmai.'
            : 'Open your device settings to allow receipt access for Munmai.',
        );
      }
    }
  }, []);

  return {
    choosePdf,
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
