import { unlink } from "fs/promises";
import {
  archiveReceipt as archiveReceiptService,
  createReceipt as createReceiptService,
  getReceiptById,
  getReceiptFile as getReceiptFileService,
  listReceipts as listReceiptsService,
  updateReceipt as updateReceiptService,
} from "../services/receiptInboxService.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    if (error.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({
        message: error.message,
        requestId: req.requestId || "",
      });
    }

    if (error.statusCode) {
      res.status(error.statusCode);
    }

    return next(error);
  }
};

const getUserId = (req) => req.user?.id || req.user?._id;

const cleanupUploadedFile = async (file) => {
  if (!file?.path) {
    return;
  }

  try {
    await unlink(file.path);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("Failed to clean up receipt inbox upload", {
        filePath: file.path,
        error: error?.message,
      });
    }
  }
};

export const createReceipt = asyncHandler(async (req, res) => {
  try {
    const receipt = await createReceiptService(getUserId(req), req.file, req.body || {});
    return res.status(201).json({ receipt });
  } catch (error) {
    await cleanupUploadedFile(req.file);
    throw error;
  }
});

export const listReceipts = asyncHandler(async (req, res) => {
  const result = await listReceiptsService(getUserId(req), req.query || {});
  return res.status(200).json(result);
});

export const getReceipt = asyncHandler(async (req, res) => {
  const receipt = await getReceiptById(getUserId(req), req.params.receiptId, {
    includeArchived: String(req.query.includeArchived || "").toLowerCase() === "true",
  });

  return res.status(200).json({ receipt });
});

export const updateReceipt = asyncHandler(async (req, res) => {
  const receipt = await updateReceiptService(
    getUserId(req),
    req.params.receiptId,
    req.body || {}
  );

  return res.status(200).json({ receipt });
});

export const archiveReceipt = asyncHandler(async (req, res) => {
  const result = await archiveReceiptService(getUserId(req), req.params.receiptId);
  return res.status(200).json(result);
});

export const getReceiptFile = asyncHandler(async (req, res) => {
  const file = await getReceiptFileService(getUserId(req), req.params.receiptId);

  if (file.mimeType) {
    res.type(file.mimeType);
  }

  return res.sendFile(file.filePath, (error) => {
    if (error && !res.headersSent) {
      res.status(error.statusCode || 500).json({ message: "Receipt file not found" });
    }
  });
});
