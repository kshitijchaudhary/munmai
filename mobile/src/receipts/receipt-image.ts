export const RECEIPT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export type SupportingDocumentKind = 'income-proof' | 'receipt';
export type ReceiptImageMimeType = 'application/pdf' | 'image/jpeg' | 'image/png';
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

export interface PdfDocumentPickerAsset {
  file?: File;
  mimeType?: string;
  name: string;
  size?: number;
  uri: string;
}

export type PdfDocumentPickerResult =
  | { assets: null; canceled: true }
  | { assets: PdfDocumentPickerAsset[]; canceled: false };

const mimeTypeByExtension: Record<string, ReceiptImageMimeType> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
};

const extensionByMimeType: Record<ReceiptImageMimeType, string> = {
  'application/pdf': '.pdf',
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

  if (normalizedValue === 'application/pdf') {
    return 'application/pdf';
  }

  return null;
}

function getKnownFileSize(
  pickerFileSize: number | undefined,
  webFileSize: number | undefined,
): number | null {
  if (Number.isFinite(pickerFileSize) && (pickerFileSize ?? 0) > 0) {
    return pickerFileSize ?? null;
  }

  if (Number.isFinite(webFileSize) && (webFileSize ?? 0) > 0) {
    return webFileSize ?? null;
  }

  return null;
}

function buildFileName(
  sourceName: string,
  mimeType: ReceiptImageMimeType,
  timestamp: number,
  documentKind: SupportingDocumentKind,
): string {
  const baseName = getBaseName(sourceName);

  if (!baseName) {
    const prefix = documentKind === 'income-proof' ? 'income-proof' : 'receipt';
    return `${prefix}-${timestamp}${extensionByMimeType[mimeType]}`;
  }

  return getExtension(baseName)
    ? baseName
    : `${baseName}${extensionByMimeType[mimeType]}`;
}

export function normalizeReceiptImage(
  asset: ReceiptImageAsset,
  timestamp = Date.now(),
  documentKind: SupportingDocumentKind = 'receipt',
): ReceiptImageValidationResult {
  const isIncomeProof = documentKind === 'income-proof';
  const uri = asset.uri?.trim();

  if (!uri || (asset.type && asset.type !== 'image' && asset.type !== 'pdf')) {
    return {
      ok: false,
      code: 'invalid-metadata',
      message: isIncomeProof
        ? 'Choose a valid income document.'
        : 'Choose a valid receipt.',
    };
  }

  const webFile = asset.webFile;
  const sourceName = webFile?.name || asset.fileName || (isIncomeProof ? '' : getBaseName(uri));
  const extension = getExtension(sourceName);
  const mimeType = normalizeMimeType(webFile?.type || asset.mimeType);
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
      message: isIncomeProof
        ? 'Income document must be a JPEG, PNG, or PDF up to 5 MB.'
        : 'Receipt must be a JPEG, PNG, or PDF up to 5 MB.',
    };
  }

  const resolvedMimeType = mimeType ?? extensionMimeType;

  if (!resolvedMimeType) {
    return {
      ok: false,
      code: 'unsupported-type',
      message: isIncomeProof
        ? 'Income document must be a JPEG, PNG, or PDF up to 5 MB.'
        : 'Receipt must be a JPEG, PNG, or PDF up to 5 MB.',
    };
  }

  const fileSize = getKnownFileSize(asset.fileSize, webFile?.size);

  if (fileSize !== null && fileSize > RECEIPT_MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      code: 'too-large',
      message: isIncomeProof
        ? 'Income document must be a JPEG, PNG, or PDF up to 5 MB.'
        : 'Receipt must be a JPEG, PNG, or PDF up to 5 MB.',
    };
  }

  return {
    ok: true,
    image: {
      uri,
      fileName: buildFileName(sourceName, resolvedMimeType, timestamp, documentKind),
      fileSize,
      mimeType: resolvedMimeType,
      webFile,
    },
  };
}

export function isPdfSupportingDocument(document: ReceiptImage): boolean {
  return document.mimeType === 'application/pdf';
}

export function getSupportingDocumentDisplayModel(document: ReceiptImage) {
  return {
    fileName: document.fileName,
    preview: isPdfSupportingDocument(document) ? ('pdf' as const) : ('image' as const),
  };
}

export function normalizePdfDocumentPickerResult(
  result: PdfDocumentPickerResult,
  documentKind: SupportingDocumentKind,
  timestamp = Date.now(),
): ReceiptImageValidationResult | null {
  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const webFile = asset.file;

  return normalizeReceiptImage(
    {
      fileName: asset.name || webFile?.name,
      fileSize: asset.size ?? webFile?.size,
      mimeType: asset.mimeType || webFile?.type || 'application/pdf',
      type: 'pdf',
      uri: asset.uri,
      webFile,
    },
    timestamp,
    documentKind,
  );
}

export function formatSupportingDocumentFileSize(fileSize: number | null): string {
  if (!fileSize || !Number.isFinite(fileSize) || fileSize < 0) {
    return 'Size unavailable.';
  }

  if (fileSize < 1024) {
    return `${fileSize} ${fileSize === 1 ? 'byte' : 'bytes'}`;
  }

  if (fileSize < 1024 * 1024) {
    return `${(fileSize / 1024).toFixed(fileSize < 10 * 1024 ? 1 : 0)} KB`;
  }

  return `${(fileSize / (1024 * 1024)).toFixed(2)} MB`;
}

export function receiptSelectionReducer(
  state: ReceiptImage | null,
  action: ReceiptSelectionAction,
): ReceiptImage | null {
  return action.type === 'select' ? action.image : null;
}
