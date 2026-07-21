export const RECEIPT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export type ReceiptImageMimeType = 'image/jpeg' | 'image/png';
export type ReceiptImageValidationCode = 'invalid-metadata' | 'unsupported-type' | 'too-large';

export interface ReceiptImageAsset {
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string | null;
  type?: string | null;
  uri: string;
  webFile?: File;
}

export interface ReceiptImage {
  fileName: string;
  fileSize: number | null;
  mimeType: ReceiptImageMimeType;
  uri: string;
  webFile?: File;
}

export type ReceiptImageValidationResult =
  | { image: ReceiptImage; ok: true }
  | { code: ReceiptImageValidationCode; message: string; ok: false };

export type ReceiptSelectionAction =
  | { image: ReceiptImage; type: 'select' }
  | { type: 'remove' };

const mimeTypeByExtension: Record<string, ReceiptImageMimeType> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

const extensionByMimeType: Record<ReceiptImageMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

function getBaseName(value: string): string {
  const withoutQuery = value.split(/[?#]/, 1)[0];
  const segments = withoutQuery.split(/[\\/]/);

  return segments.at(-1)?.trim() ?? '';
}

function getExtension(value: string): string {
  const fileName = getBaseName(value);
  const extensionIndex = fileName.lastIndexOf('.');

  return extensionIndex > 0 ? fileName.slice(extensionIndex).toLowerCase() : '';
}

function normalizeMimeType(value: string | null | undefined): ReceiptImageMimeType | null {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue === 'image/jpeg' || normalizedValue === 'image/jpg') {
    return 'image/jpeg';
  }

  if (normalizedValue === 'image/png') {
    return 'image/png';
  }

  return null;
}

function buildFileName(
  sourceName: string,
  mimeType: ReceiptImageMimeType,
  timestamp: number,
): string {
  const baseName = getBaseName(sourceName);

  if (!baseName) {
    return `receipt-${timestamp}${extensionByMimeType[mimeType]}`;
  }

  return getExtension(baseName)
    ? baseName
    : `${baseName}${extensionByMimeType[mimeType]}`;
}

export function normalizeReceiptImage(
  asset: ReceiptImageAsset,
  timestamp = Date.now(),
): ReceiptImageValidationResult {
  const uri = asset.uri?.trim();

  if (!uri || (asset.type && asset.type !== 'image')) {
    return {
      ok: false,
      code: 'invalid-metadata',
      message: 'Choose a valid receipt image.',
    };
  }

  const sourceName = asset.webFile?.name || asset.fileName || getBaseName(uri);
  const extension = getExtension(sourceName);
  const mimeType = normalizeMimeType(asset.webFile?.type || asset.mimeType);
  const extensionMimeType = extension ? mimeTypeByExtension[extension] : undefined;

  if (
    (asset.mimeType && !mimeType) ||
    (extension && !extensionMimeType) ||
    (!mimeType && !extensionMimeType) ||
    (mimeType && extensionMimeType && mimeType !== extensionMimeType)
  ) {
    return {
      ok: false,
      code: 'unsupported-type',
      message: 'Receipt images must be JPEG or PNG files.',
    };
  }

  const resolvedMimeType = mimeType ?? extensionMimeType;

  if (!resolvedMimeType) {
    return {
      ok: false,
      code: 'unsupported-type',
      message: 'Receipt images must be JPEG or PNG files.',
    };
  }

  const fileSize = asset.webFile?.size ?? asset.fileSize ?? null;

  if (fileSize !== null && (!Number.isFinite(fileSize) || fileSize <= 0)) {
    return {
      ok: false,
      code: 'invalid-metadata',
      message: 'Munmai could not read that image. Choose another receipt image.',
    };
  }

  if (fileSize !== null && fileSize > RECEIPT_MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      code: 'too-large',
      message: 'Receipt images must be 5 MB or smaller.',
    };
  }

  return {
    ok: true,
    image: {
      uri,
      fileName: buildFileName(sourceName, resolvedMimeType, timestamp),
      fileSize,
      mimeType: resolvedMimeType,
      webFile: asset.webFile,
    },
  };
}

export function receiptSelectionReducer(
  state: ReceiptImage | null,
  action: ReceiptSelectionAction,
): ReceiptImage | null {
  return action.type === 'select' ? action.image : null;
}
