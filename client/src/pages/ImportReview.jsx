import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  archiveImportHistoryBatch,
  commitImportBatch,
  confirmPdfImportRows,
  deleteImportBatch,
  getImportHistoryBatchRows,
  getImportHistoryBatches,
  getImportHistorySummary,
  getImportBatches,
  getImportRows,
  previewBankStatementPdf,
  revertImportHistoryBatch,
  updateImportRow,
  uploadImportCsv,
} from "../api/imports";
import { getLiabilities } from "../api/liabilities";
import Sidebar from "../components/Sidebar";

const classificationOptions = [
  { value: "unclassified", label: "Choose classification" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "debt_payment", label: "Debt Payment" },
  { value: "transfer", label: "Transfer" },
  { value: "ignore", label: "Ignore" },
];

const statusLabels = {
  pending_review: "Pending Review",
  partially_imported: "Partially Imported",
  imported: "Imported",
  cancelled: "Cancelled",
  reverted: "Reverted",
  needs_review: "Needs Review",
  ready: "Ready",
  ignored: "Ignored",
  skipped: "Skipped",
  duplicate_skipped: "Duplicate skipped",
  error: "Error",
};

const emptyImportHistorySummary = {
  totalBatches: 0,
  csvBatches: 0,
  pdfBatches: 0,
  totalImported: 0,
  totalDuplicates: 0,
  totalErrors: 0,
};

const historySourceOptions = [
  { value: "", label: "All" },
  { value: "csv", label: "CSV" },
  { value: "pdf", label: "PDF" },
];

const importTabs = [
  { value: "upload", label: "Upload & Preview" },
  { value: "review", label: "Review Queue" },
  { value: "history", label: "History" },
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-700 dark:disabled:bg-slate-800";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));

const formatNumber = (value) => new Intl.NumberFormat("en-CA").format(Number(value || 0));

const isImportablePdfType = (type) => ["income", "expense"].includes(type);

const getStatementFileType = (selectedFile) => {
  if (!selectedFile) return "";

  const name = String(selectedFile.name || "").toLowerCase();
  const mimeType = String(selectedFile.type || "").toLowerCase();

  if (name.endsWith(".csv") || mimeType === "text/csv") return "csv";
  if (name.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";

  return "unsupported";
};

const getPdfRowKey = (row) => String(row?.rowNumber || row?.rawText || "");

const normalizePdfRows = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    type: row.type || "unknown",
    category: row.category || "Other",
  }));

const buildDefaultPdfSelection = (rows) =>
  rows.reduce((selection, row) => {
    selection[getPdfRowKey(row)] = isImportablePdfType(row.type);
    return selection;
  }, {});

const getDateParts = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (isoDate) {
      return {
        year: isoDate[1],
        month: isoDate[2],
        day: isoDate[3],
      };
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, "0"),
    day: String(date.getUTCDate()).padStart(2, "0"),
  };
};

const formatDate = (value) => {
  const parts = getDateParts(value);

  if (!parts) {
    return "No date";
  }

  return `${parts.month}/${parts.day}/${parts.year}`;
};

const formatDateTime = (value) => {
  if (!value) {
    return "Not committed";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not committed";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const toDateInputValue = (value) => {
  const parts = getDateParts(value);

  if (!parts) {
    return "";
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getBatchProgress = (batch) => {
  const total = Number(batch.totalRows || 0);

  if (!total) {
    return "0 reviewed";
  }

  return `${Number(batch.reviewedRows || 0)} reviewed / ${Number(
    batch.importedRows || 0
  )} imported`;
};

const getEffectiveClassification = (row) => {
  if (row.classification && row.classification !== "unclassified") {
    return row.classification;
  }

  return row.suggestedClassification || "unclassified";
};

const getClassificationLabel = (value) =>
  classificationOptions.find((option) => option.value === value)?.label ||
  "Unclassified";

const buildSummaryFromRows = (rows) => {
  const summary = {
    incomeImported: 0,
    expensesImported: 0,
    debtPaymentsImported: 0,
    transfersSkipped: 0,
    ignored: 0,
    errors: [],
    totalProcessed: 0,
  };

  for (const row of rows) {
    if (row.importedRecordType === "income") summary.incomeImported += 1;
    if (row.importedRecordType === "expense") summary.expensesImported += 1;
    if (row.importedRecordType === "liability_payment") {
      summary.debtPaymentsImported += 1;
    }
    if (row.importedRecordType === "transfer") summary.transfersSkipped += 1;
    if (row.importedRecordType === "ignore") summary.ignored += 1;
    if (row.status === "error") {
      summary.errors.push({
        rowId: row._id,
        message: "Import failed. Review this row.",
      });
    }
  }

  summary.totalProcessed =
    summary.incomeImported +
    summary.expensesImported +
    summary.debtPaymentsImported +
    summary.transfersSkipped +
    summary.ignored +
    summary.errors.length;

  return summary;
};

const buildRowPayload = (row) => ({
  classification: getEffectiveClassification(row),
  category: row.category || "",
  linkedLiability:
    typeof row.linkedLiability === "object"
      ? row.linkedLiability?._id || ""
      : row.linkedLiability || "",
  notes: row.notes || "",
  parsedDate: toDateInputValue(row.parsedDate),
  description: row.description || "",
  amount: row.amount || "",
});

const buildSkipRowPayload = (row) => ({
  ...buildRowPayload(row),
  classification: "ignore",
});

const buildUndoSkipRowPayload = (row) => ({
  ...buildRowPayload(row),
  classification: "unclassified",
  status: "needs_review",
});

const rowNeedsDebtLink = (row) =>
  getEffectiveClassification(row) === "debt_payment" && !getLinkedLiabilityId(row);

const getLinkedLiabilityId = (row) =>
  typeof row.linkedLiability === "object"
    ? row.linkedLiability?._id || ""
    : row.linkedLiability || "";

const ImportReview = () => {
  const [activeTab, setActiveTab] = useState("upload");
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [rows, setRows] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [statementFile, setStatementFile] = useState(null);
  const [statementInputKey, setStatementInputKey] = useState(0);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [pdfRows, setPdfRows] = useState([]);
  const [selectedPdfRows, setSelectedPdfRows] = useState({});
  const [pdfStatus, setPdfStatus] = useState(null);
  const [pdfConfirmStatus, setPdfConfirmStatus] = useState(null);
  const [pdfConfirmResult, setPdfConfirmResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewingPdf, setPreviewingPdf] = useState(false);
  const [confirmingPdf, setConfirmingPdf] = useState(false);
  const [savingRowId, setSavingRowId] = useState("");
  const [committing, setCommitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState(null);
  const [commitSummary, setCommitSummary] = useState(null);
  const [importComplete, setImportComplete] = useState(false);
  const [historySummary, setHistorySummary] = useState(emptyImportHistorySummary);
  const [historyBatches, setHistoryBatches] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  });
  const [historySource, setHistorySource] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [expandedHistoryBatchId, setExpandedHistoryBatchId] = useState("");
  const [historyRowsByBatch, setHistoryRowsByBatch] = useState({});
  const [historyRowsLoadingId, setHistoryRowsLoadingId] = useState("");
  const [archivingHistoryBatchId, setArchivingHistoryBatchId] = useState("");
  const [revertingHistoryBatchId, setRevertingHistoryBatchId] = useState("");
  const pdfRowsSectionRef = useRef(null);
  const pdfInputRef = useRef(null);

  const activeLiabilities = useMemo(
    () => liabilities.filter((liability) => liability.status === "active"),
    [liabilities]
  );

  const statementFileType = useMemo(
    () => getStatementFileType(statementFile),
    [statementFile]
  );

  const statementButtonLabel = useMemo(() => {
    if (!statementFile) return "Choose a statement file";
    if (statementFileType === "csv") return "Create Review Queue";
    if (statementFileType === "pdf") return "Preview PDF";
    return "Unsupported file type";
  }, [statementFile, statementFileType]);

  const statementSubmitDisabled =
    uploading ||
    previewingPdf ||
    !statementFile ||
    statementFileType === "unsupported";

  const reviewQueueBatches = useMemo(
    () =>
      batches.filter(
        (batch) =>
          batch.importSource !== "pdf" &&
          ["pending_review", "partially_imported", "cancelled"].includes(batch.status)
      ),
    [batches]
  );

  const selectedPdfRowsForImport = useMemo(
    () =>
      pdfRows.filter(
        (row) => selectedPdfRows[getPdfRowKey(row)] && isImportablePdfType(row.type)
      ),
    [pdfRows, selectedPdfRows]
  );

  const loadBatches = useCallback(async () => {
    const data = await getImportBatches();
    setBatches(Array.isArray(data?.batches) ? data.batches : []);
  }, []);

  const loadRows = useCallback(async (batch, { preserveSummary = false } = {}) => {
    if (!batch?._id) return;

    setRowsLoading(true);
    try {
      const data = await getImportRows(batch._id);
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setSelectedBatch(batch);
      setImportComplete(batch.status === "imported");

      if (!preserveSummary) {
        setCommitSummary(null);
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to load import rows.",
      });
    } finally {
      setRowsLoading(false);
    }
  }, []);

  const loadImportHistory = useCallback(
    async ({ source = historySource, page = 1 } = {}) => {
      try {
        setHistoryLoading(true);
        setHistoryError("");

        const [summaryData, batchData] = await Promise.all([
          getImportHistorySummary(),
          getImportHistoryBatches({
            source: source || undefined,
            page,
            limit: historyPagination.limit,
          }),
        ]);

        setHistorySummary({
          ...emptyImportHistorySummary,
          ...(summaryData || {}),
        });
        setHistoryBatches(Array.isArray(batchData?.batches) ? batchData.batches : []);
        setHistoryPagination({
          page: batchData?.pagination?.page || page,
          limit: batchData?.pagination?.limit || historyPagination.limit,
          total: batchData?.pagination?.total || 0,
          pages: batchData?.pagination?.pages || 1,
        });
      } catch (error) {
        setHistorySummary(emptyImportHistorySummary);
        setHistoryBatches([]);
        setHistoryError(
          error.response?.data?.message || "Failed to load import history."
        );
      } finally {
        setHistoryLoading(false);
      }
    },
    [historyPagination.limit, historySource]
  );

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);

      const [batchData, debtData] = await Promise.all([
        getImportBatches(),
        getLiabilities({ status: "active" }),
      ]);

      setBatches(Array.isArray(batchData?.batches) ? batchData.batches : []);
      setLiabilities(Array.isArray(debtData) ? debtData : []);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to load imports.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    setExpandedHistoryBatchId("");
    setHistoryRowsByBatch({});
    loadImportHistory({ page: 1 });
  }, [historySource, loadImportHistory]);

  const uploadCsvFile = async (csvFile) => {
    if (!csvFile) {
      setMessage({ type: "error", text: "Choose a CSV file to upload." });
      return;
    }

    try {
      setUploading(true);
      setMessage(null);
      setCommitSummary(null);

      const result = await uploadImportCsv(csvFile);
      const batch = result?.batch;

      setMessage({
        type: "success",
        text: `Created review queue with ${result.rowsCreated || 0} row(s).`,
      });
      setStatementFile(null);
      setStatementInputKey((currentKey) => currentKey + 1);
      setImportComplete(false);
      await loadBatches();
      await loadImportHistory({ page: 1 });

      if (batch) {
        await loadRows(batch);
        setActiveTab("review");
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to upload CSV.",
      });
    } finally {
      setUploading(false);
    }
  };

  const previewPdfFile = async (fileToPreview) => {
    if (!fileToPreview) {
      setPdfStatus({ type: "error", text: "Choose a PDF statement to preview." });
      return;
    }

    try {
      setPreviewingPdf(true);
      setPdfStatus(null);
      setPdfPreview(null);
      setPdfRows([]);
      setSelectedPdfRows({});
      setPdfConfirmStatus(null);
      setPdfConfirmResult(null);

      const result = await previewBankStatementPdf(fileToPreview);
      const previewRows = normalizePdfRows(result.parsedRows);
      setPdfPreview(result);
      setPdfRows(previewRows);
      setSelectedPdfRows(buildDefaultPdfSelection(previewRows));
      setPdfStatus({
        type: "success",
        text: "Preview ready. Transactions are not saved until you import selected rows.",
      });
    } catch (error) {
      setPdfStatus({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to preview PDF statement.",
      });
    } finally {
      setPreviewingPdf(false);
    }
  };

  const handleStatementFileChange = (selectedFile) => {
    setStatementFile(selectedFile);
    setMessage(null);
    setPdfStatus(null);
  };

  const handleStatementSubmit = async (event) => {
    event.preventDefault();

    if (statementFileType === "csv") {
      await uploadCsvFile(statementFile);
      return;
    }

    if (statementFileType === "pdf") {
      await previewPdfFile(statementFile);
      return;
    }

    setMessage({
      type: "error",
      text: statementFile
        ? "Unsupported file type. Choose a CSV or PDF statement."
        : "Choose a statement file.",
    });
  };

  const clearPdfPreview = ({ focusInput = false } = {}) => {
    setStatementFile(null);
    setStatementInputKey((currentKey) => currentKey + 1);
    setPdfPreview(null);
    setPdfRows([]);
    setSelectedPdfRows({});
    setPdfConfirmStatus(null);
    setPdfConfirmResult(null);
    setPdfStatus(null);

    if (focusInput) {
      window.setTimeout(() => {
        pdfInputRef.current?.focus();
      }, 0);
    }
  };

  const handleReviewParsedRows = () => {
    if (!pdfRowsSectionRef.current) {
      return;
    }

    pdfRowsSectionRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    pdfRowsSectionRef.current.focus({ preventScroll: true });
  };

  const updatePdfRow = (rowKey, updates) => {
    setPdfRows((currentRows) =>
      currentRows.map((row) =>
        getPdfRowKey(row) === rowKey ? { ...row, ...updates } : row
      )
    );

    if (Object.prototype.hasOwnProperty.call(updates, "type")) {
      setSelectedPdfRows((currentSelection) => ({
        ...currentSelection,
        [rowKey]: isImportablePdfType(updates.type)
          ? Boolean(currentSelection[rowKey])
          : false,
      }));
    }
  };

  const togglePdfRowSelection = (rowKey) => {
    const row = pdfRows.find((currentRow) => getPdfRowKey(currentRow) === rowKey);

    if (!row || !isImportablePdfType(row.type)) {
      return;
    }

    setSelectedPdfRows((currentSelection) => ({
      ...currentSelection,
      [rowKey]: !currentSelection[rowKey],
    }));
  };

  const handleConfirmPdfRows = async () => {
    if (!selectedPdfRowsForImport.length) {
      setPdfConfirmStatus({
        type: "error",
        text: "Select at least one income or expense row to import.",
      });
      return;
    }

    try {
      setConfirmingPdf(true);
      setPdfConfirmStatus(null);
      setPdfConfirmResult(null);

      const result = await confirmPdfImportRows({
        fileName: pdfPreview?.fileName || statementFile?.name || "statement.pdf",
        rows: selectedPdfRowsForImport.map((row) => ({
          rowNumber: row.rowNumber,
          date: row.date,
          description: row.description,
          amount: row.amount,
          type: row.type,
          confidence: row.confidence,
          rawText: row.rawText,
          category: row.category || "Other",
        })),
      });

      setPdfConfirmResult(result);
      setPdfConfirmStatus({
        type: "success",
        text: result.message || "PDF rows processed.",
      });
      await loadImportHistory({ page: historyPagination.page });
    } catch (error) {
      setPdfConfirmStatus({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to import selected PDF rows.",
      });
    } finally {
      setConfirmingPdf(false);
    }
  };

  const handleToggleHistoryRows = async (batch) => {
    if (!batch?._id) {
      return;
    }

    if (expandedHistoryBatchId === batch._id) {
      setExpandedHistoryBatchId("");
      return;
    }

    setExpandedHistoryBatchId(batch._id);

    if (historyRowsByBatch[batch._id]) {
      return;
    }

    try {
      setHistoryRowsLoadingId(batch._id);
      setHistoryError("");

      const data = await getImportHistoryBatchRows(batch._id);
      setHistoryRowsByBatch((currentRows) => ({
        ...currentRows,
        [batch._id]: Array.isArray(data?.rows) ? data.rows : [],
      }));
    } catch (error) {
      setHistoryError(
        error.response?.data?.message || "Failed to load import history rows."
      );
    } finally {
      setHistoryRowsLoadingId("");
    }
  };

  const handleArchiveHistoryBatch = async (batch) => {
    if (!batch?._id) {
      return;
    }

    if (
      !window.confirm(
        "Archive this import batch? It will be hidden from your default history, but the audit trail will not be deleted."
      )
    ) {
      return;
    }

    try {
      setArchivingHistoryBatchId(batch._id);
      setHistoryError("");

      await archiveImportHistoryBatch(batch._id);

      if (expandedHistoryBatchId === batch._id) {
        setExpandedHistoryBatchId("");
      }

      await loadImportHistory({ page: historyPagination.page });
    } catch (error) {
      setHistoryError(
        error.response?.data?.message || "Failed to archive import batch."
      );
    } finally {
      setArchivingHistoryBatchId("");
    }
  };

  const handleRevertHistoryBatch = async (batch) => {
    if (!batch?._id || batch.revertedAt || batch.status === "reverted") {
      return;
    }

    if (
      !window.confirm(
        "This will remove the income/expense records created by this import from your account totals. Import history will be kept for audit. Continue?"
      )
    ) {
      return;
    }

    try {
      setRevertingHistoryBatchId(batch._id);
      setHistoryError("");
      setMessage(null);

      const result = await revertImportHistoryBatch(batch._id);

      if (expandedHistoryBatchId === batch._id) {
        setExpandedHistoryBatchId("");
      }

      setHistoryRowsByBatch((currentRows) => {
        const nextRows = { ...currentRows };
        delete nextRows[batch._id];
        return nextRows;
      });
      setMessage({
        type: "success",
        text: result.message || "Import batch reverted.",
      });
      await loadImportHistory({ page: historyPagination.page });
    } catch (error) {
      setHistoryError(
        error.response?.data?.message || "Failed to revert import batch."
      );
    } finally {
      setRevertingHistoryBatchId("");
    }
  };

  const updateLocalRow = (rowId, updates) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row._id === rowId ? { ...row, ...updates } : row))
    );
  };

  const handleSaveRow = async (row) => {
    try {
      setSavingRowId(row._id);
      setMessage(null);

      const result = await updateImportRow(row._id, buildRowPayload(row));
      setRows((currentRows) =>
        currentRows.map((currentRow) =>
          currentRow._id === row._id ? result.row : currentRow
        )
      );
      await loadBatches();
      setMessage({ type: "success", text: "Import row saved." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to save import row.",
      });
    } finally {
      setSavingRowId("");
    }
  };

  const handleSkipRow = async (row) => {
    if (!window.confirm("Skip this row? This row will not be added to Munmai.")) {
      return;
    }

    try {
      setSavingRowId(row._id);
      setMessage(null);

      const result = await updateImportRow(row._id, buildSkipRowPayload(row));
      setRows((currentRows) =>
        currentRows.map((currentRow) =>
          currentRow._id === row._id ? result.row : currentRow
        )
      );
      await loadBatches();
      setMessage({ type: "success", text: "Row skipped." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to skip row.",
      });
    } finally {
      setSavingRowId("");
    }
  };

  const handleUndoSkipRow = async (row) => {
    try {
      setSavingRowId(row._id);
      setMessage(null);

      const result = await updateImportRow(row._id, buildUndoSkipRowPayload(row));
      setRows((currentRows) =>
        currentRows.map((currentRow) =>
          currentRow._id === row._id ? result.row : currentRow
        )
      );
      await loadBatches();
      setMessage({ type: "success", text: "Row restored to review." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to restore row.",
      });
    } finally {
      setSavingRowId("");
    }
  };

  const handleCommit = async () => {
    if (!selectedBatch?._id) {
      return;
    }

    try {
      setCommitting(true);
      setMessage(null);
      setCommitSummary(null);

      const result = await commitImportBatch(selectedBatch._id);
      const summary = result.summary || {};
      const hasErrors = Array.isArray(summary.errors) && summary.errors.length > 0;

      await loadBatches();
      await loadRows(result.batch || selectedBatch, { preserveSummary: true });
      await loadImportHistory({ page: historyPagination.page });
      setCommitSummary(summary);
      setImportComplete(!hasErrors);
      setMessage({
        type: hasErrors ? "error" : "success",
        text: hasErrors
          ? "Some rows could not be imported. Review the row errors below."
          : "Import reviewed rows completed.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to import reviewed rows.",
      });
    } finally {
      setCommitting(false);
    }
  };

  const handleRemoveBatch = async (batch) => {
    if (!batch?._id) {
      return;
    }

    if (
      !window.confirm(
        "Remove this import batch? This will delete its review rows."
      )
    ) {
      return;
    }

    try {
      setCancelling(true);
      setMessage(null);
      const result = await deleteImportBatch(batch._id);

      if (selectedBatch?._id === batch._id) {
        setRows([]);
        setSelectedBatch(null);
        setCommitSummary(null);
        setImportComplete(false);
      }

      setMessage({
        type: "success",
        text: result.message || "Import removed.",
      });
      await loadBatches();
      await loadImportHistory({ page: historyPagination.page });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to remove import batch.",
      });
    } finally {
      setCancelling(false);
    }
  };

  const readyOrIgnoredRows = rows.filter((row) =>
    ["ready", "ignored"].includes(row.status)
  );
  const unresolvedDebtRows = rows.filter(rowNeedsDebtLink);
  const displayedSummary =
    commitSummary ||
    (selectedBatch?.status === "imported" ? buildSummaryFromRows(rows) : null);
  const rowErrorsById = new Map(
    (commitSummary?.errors || []).map((error) => [String(error.rowId), error.message])
  );
  const readOnlyRows = importComplete || selectedBatch?.status === "imported";
  const commitDisabled =
    committing ||
    selectedBatch?.status === "imported" ||
    readyOrIgnoredRows.length === 0 ||
    unresolvedDebtRows.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Sidebar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-indigo-600">Money</p>
            <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
              Import Statements
            </h1>
            <p className="mt-2 max-w-2xl text-slate-500">
              Upload CSV or PDF bank statements and review rows before adding
              them to Munmai.
            </p>
          </div>
        </header>

        {message?.text && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mb-6 rounded-3xl border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {importTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                  activeTab === tab.value
                    ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "upload" && (
          <div className="space-y-8">
            {!pdfConfirmResult && (
              <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 md:p-6">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                      Upload statement
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                      Upload a CSV or text-based PDF bank statement. CSV files create
                      a review queue. PDF files are previewed before import.
                    </p>
                  </div>

                  {statementFile && (
                    <StatementTypeBadge type={statementFileType} />
                  )}
                </div>

                <form onSubmit={handleStatementSubmit} className="space-y-4">
                  <input
                    key={statementInputKey}
                    ref={pdfInputRef}
                    type="file"
                    accept=".csv,.pdf,text/csv,application/pdf"
                    onChange={(event) =>
                      handleStatementFileChange(event.target.files?.[0] || null)
                    }
                    className={inputClass}
                  />

                  {statementFile && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
                      Selected file:{" "}
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {statementFile.name}
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={statementSubmitDisabled}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                  >
                    {uploading
                      ? "Creating queue..."
                      : previewingPdf
                      ? "Previewing PDF..."
                      : statementButtonLabel}
                  </button>
                </form>

                {pdfStatus?.text && (
                  <div
                    className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
                      pdfStatus.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300"
                        : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300"
                    }`}
                  >
                    {pdfStatus.text}
                  </div>
                )}

                {pdfPreview && (
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                    <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">
                      Preview actions
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={handleReviewParsedRows}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                      >
                        Review parsed rows
                      </button>
                      <button
                        type="button"
                        onClick={() => clearPdfPreview({ focusInput: true })}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Choose another file
                      </button>
                      <button
                        type="button"
                        onClick={() => clearPdfPreview()}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Clear preview
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {!pdfPreview && !pdfConfirmResult && (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <p className="font-bold text-slate-700 dark:text-slate-200">
                  Upload a CSV or PDF statement to begin.
                </p>
                <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
                  CSV files create a review queue. Text-based PDFs can be
                  previewed before importing selected rows.
                </p>
              </div>
            )}

            {pdfPreview && (
              <PdfPreviewSection
                preview={pdfPreview}
                rows={pdfRows}
                selectedRows={selectedPdfRows}
                selectedCount={selectedPdfRowsForImport.length}
                confirming={confirmingPdf}
                confirmStatus={pdfConfirmStatus}
                confirmResult={pdfConfirmResult}
                onToggleRow={togglePdfRowSelection}
                onUpdateRow={updatePdfRow}
                onConfirm={handleConfirmPdfRows}
                onViewHistory={() => setActiveTab("history")}
                onImportAnother={() => clearPdfPreview({ focusInput: true })}
                rowsSectionRef={pdfRowsSectionRef}
              />
            )}
          </div>
        )}

        {activeTab === "review" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between md:px-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                    CSV review queue
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Open a CSV batch to review, classify, and import rows.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadInitialData}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <EmptyState title="Loading imports..." />
              ) : reviewQueueBatches.length === 0 ? (
                <EmptyState
                  title="No review batches"
                  description="Create a CSV review queue from the Upload & Preview tab."
                />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reviewQueueBatches.map((batch) => (
                    <BatchRow
                      key={batch._id}
                      batch={batch}
                      selected={selectedBatch?._id === batch._id}
                      onOpen={() => loadRows(batch)}
                      onRemove={() => handleRemoveBatch(batch)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between md:px-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                    Review rows
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedBatch
                      ? selectedBatch.originalFilename
                      : "Open a CSV review batch to review rows."}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  {selectedBatch &&
                    ["cancelled", "pending_review"].includes(selectedBatch.status) && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBatch(selectedBatch)}
                      disabled={cancelling}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:text-rose-300 dark:border-rose-900/70 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    >
                      {cancelling
                        ? "Removing..."
                        : selectedBatch.status === "cancelled"
                        ? "Remove Batch"
                        : "Cancel Batch"}
                    </button>
                  )}
                  {!readOnlyRows && (
                    <button
                      type="button"
                      onClick={handleCommit}
                      disabled={commitDisabled}
                      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                    >
                      {committing ? "Importing..." : "Import Reviewed Rows"}
                    </button>
                  )}
                </div>
              </div>

              {commitSummary && !importComplete && <CommitSummary summary={commitSummary} />}

              {importComplete && displayedSummary && (
                <ImportCompleteCard
                  summary={displayedSummary}
                  onImportAnother={() => {
                    setSelectedBatch(null);
                    setRows([]);
                    setCommitSummary(null);
                    setImportComplete(false);
                    setMessage(null);
                    setActiveTab("upload");
                  }}
                />
              )}

              {!readOnlyRows && unresolvedDebtRows.length > 0 && (
                <div className="mx-5 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300 md:mx-6">
                  Choose which debt this payment belongs to.
                </div>
              )}

              {!selectedBatch ? (
                <EmptyState
                  title="No batch selected"
                  description="Open a CSV review batch to review rows."
                />
              ) : rowsLoading ? (
                <EmptyState title="Loading rows..." />
              ) : rows.length === 0 ? (
                <EmptyState title="No rows found" description="No rows found in this import." />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row) => (
                    <ImportRowEditor
                      key={row._id}
                      row={row}
                      liabilities={activeLiabilities}
                      readOnly={readOnlyRows}
                      rowError={rowErrorsById.get(String(row._id))}
                      saving={savingRowId === row._id}
                      onChange={(updates) => updateLocalRow(row._id, updates)}
                      onSave={() => handleSaveRow(row)}
                      onSkip={() => handleSkipRow(row)}
                      onUndoSkip={() => handleUndoSkipRow(row)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "history" && (
          <ImportHistorySection
            summary={historySummary}
            batches={historyBatches}
            pagination={historyPagination}
            source={historySource}
            loading={historyLoading}
            error={historyError}
            expandedBatchId={expandedHistoryBatchId}
            rowsByBatch={historyRowsByBatch}
            rowsLoadingId={historyRowsLoadingId}
            onSourceChange={setHistorySource}
            onRefresh={() => loadImportHistory({ page: historyPagination.page })}
            onPageChange={(page) => loadImportHistory({ page })}
            onToggleRows={handleToggleHistoryRows}
            onArchiveBatch={handleArchiveHistoryBatch}
            onRevertBatch={handleRevertHistoryBatch}
            archivingBatchId={archivingHistoryBatchId}
            revertingBatchId={revertingHistoryBatchId}
          />
        )}
      </main>
    </div>
  );
};

const ImportHistorySection = ({
  summary,
  batches,
  pagination,
  source,
  loading,
  error,
  expandedBatchId,
  rowsByBatch,
  rowsLoadingId,
  archivingBatchId,
  onSourceChange,
  onRefresh,
  onPageChange,
  onToggleRows,
  onArchiveBatch,
  onRevertBatch,
  revertingBatchId,
}) => (
  <section className="mt-8 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 dark:border-slate-800 md:flex-row md:items-start md:justify-between md:px-6">
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
          Audit Trail
        </p>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
          Import History
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Review previous CSV/PDF import batches and confirmed PDF imports.
        </p>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Refresh history
      </button>
    </div>

    <div className="space-y-6 p-5 md:p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <HistoryMetric label="Total batches" value={summary.totalBatches} />
        <HistoryMetric label="CSV batches" value={summary.csvBatches} />
        <HistoryMetric label="PDF batches" value={summary.pdfBatches} />
        <HistoryMetric label="Imported" value={summary.totalImported} />
        <HistoryMetric label="Duplicates" value={summary.totalDuplicates} />
        <HistoryMetric label="Errors" value={summary.totalErrors} tone="text-rose-600 dark:text-rose-400" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {historySourceOptions.map((option) => (
            <button
              key={option.value || "all"}
              type="button"
              onClick={() => onSourceChange(option.value)}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                source === option.value
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Page {pagination.page || 1} of {pagination.pages || 1}
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center font-semibold text-slate-400 dark:border-slate-700">
          Loading import history...
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-700">
          <p className="font-bold text-slate-700 dark:text-slate-200">
            No import history found.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Confirm a PDF import or commit a CSV review batch to see history here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => (
            <ImportHistoryBatchCard
              key={batch._id}
              batch={batch}
              expanded={expandedBatchId === batch._id}
              rows={rowsByBatch[batch._id] || []}
              rowsLoading={rowsLoadingId === batch._id}
              archiving={archivingBatchId === batch._id}
              reverting={revertingBatchId === batch._id}
              onToggleRows={() => onToggleRows(batch)}
              onArchive={() => onArchiveBatch(batch)}
              onRevert={() => onRevertBatch(batch)}
            />
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:text-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={pagination.page >= pagination.pages}
            onClick={() => onPageChange(Math.min(pagination.pages, pagination.page + 1))}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:text-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Next
          </button>
        </div>
      )}
    </div>
  </section>
);

const HistoryMetric = ({ label, value, tone = "text-slate-900 dark:text-slate-100" }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`mt-1 text-2xl font-black ${tone}`}>
      {formatNumber(value)}
    </p>
  </div>
);

const SourceBadge = ({ source }) => {
  const normalizedSource = source === "pdf" ? "pdf" : "csv";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
        normalizedSource === "pdf"
          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {normalizedSource}
    </span>
  );
};

const StatementTypeBadge = ({ type }) => {
  const label =
    type === "csv" ? "CSV" : type === "pdf" ? "PDF" : "Unsupported";
  const tone =
    type === "csv"
      ? "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      : type === "pdf"
      ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/40 dark:text-indigo-300"
      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";

  return (
    <span
      className={`inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${tone}`}
    >
      {label}
    </span>
  );
};

const ImportHistoryBatchCard = ({
  batch,
  expanded,
  rows,
  rowsLoading,
  archiving,
  reverting,
  onToggleRows,
  onArchive,
  onRevert,
}) => {
  const summary = batch.summary || {};
  const duplicateCount = summary.duplicatesSkipped || 0;
  const errorCount = summary.errorsCount || 0;
  const isReverted = batch.revertedAt || batch.status === "reverted";
  const canRevert = Number(batch.importedRows || 0) > 0 && !isReverted;
  const committedLabel = batch.committedAt
    ? `Committed ${formatDateTime(batch.committedAt)}`
    : "Not committed";
  const revertedLabel = batch.revertedAt
    ? `Reverted ${formatDateTime(batch.revertedAt)}`
    : "";

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700 dark:hover:bg-slate-900/70">
      <div className="p-4 md:p-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge source={batch.importSource} />
              <StatusPill status={batch.status} />
              <h3 className="min-w-0 break-words font-black text-slate-900 dark:text-slate-100">
                {batch.fileName || "Import file"}
              </h3>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
              <span>Created {formatDateTime(batch.createdAt)}</span>
              <span>{committedLabel}</span>
              {revertedLabel && <span>{revertedLabel}</span>}
            </div>

            <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <span>Rows {formatNumber(batch.totalRows || 0)}</span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span>Imported {formatNumber(batch.importedRows || 0)}</span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span>Duplicates {formatNumber(duplicateCount)}</span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className={errorCount > 0 ? "text-rose-600 dark:text-rose-400" : ""}>
                Errors {formatNumber(errorCount)}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
            <button
              type="button"
              onClick={onToggleRows}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {expanded ? "Hide rows" : "View rows"}
            </button>
            {canRevert && (
              <button
                type="button"
                onClick={onRevert}
                disabled={reverting}
                className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:text-rose-300 dark:border-rose-900/70 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
              >
                {reverting ? "Reverting..." : "Revert import"}
              </button>
            )}
            <button
              type="button"
              onClick={onArchive}
              disabled={archiving}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:text-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {archiving ? "Archiving..." : "Archive batch"}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <ImportHistoryRows rows={rows} loading={rowsLoading} />
      )}
    </article>
  );
};

const ImportHistoryRows = ({ rows, loading }) => {
  if (loading) {
    return (
      <div className="border-t border-slate-100 px-5 py-8 text-center text-sm font-semibold text-slate-400 dark:border-slate-800">
        Loading rows...
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="border-t border-slate-100 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        No rows found for this import.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
      {rows.map((row, index) => (
        <ImportHistoryRow key={row._id} row={row} index={index} />
      ))}
    </div>
  );
};

const ImportHistoryRow = ({ row, index }) => {
  const rowNumber = row.sourceRowNumber || row.rowNumber || index + 1;
  const classification = row.classification || row.importedRecordType || "unclassified";
  const isDuplicate = row.status === "duplicate_skipped";
  const isError = row.status === "error";

  return (
    <div className="p-4 md:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white dark:bg-slate-100 dark:text-slate-950">
              Row {rowNumber}
            </span>
            <StatusPill status={row.status} />
          </div>
          <p className="break-words font-black text-slate-900 dark:text-slate-100">
            {row.description || row.rawDescription || "Imported row"}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {formatDate(row.parsedDate)} | {classification} |{" "}
            {row.category || "No category"}
          </p>
        </div>

        <p
          className={`text-lg font-black ${
            row.direction === "inflow"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {row.direction === "inflow" ? "+" : "-"}
          {formatCurrency(row.amount)}
        </p>
      </div>

      {isError && (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
          {row.errorMessage || "Import row failed."}
        </p>
      )}

      {isDuplicate && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
          <p>Already imported from a previous import.</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Duplicate skipped to protect your totals.
          </p>
        </div>
      )}
    </div>
  );
};

const PdfPreviewSection = ({
  preview,
  rows,
  selectedRows,
  selectedCount,
  confirming,
  confirmStatus,
  confirmResult,
  onToggleRow,
  onUpdateRow,
  onConfirm,
  onViewHistory,
  onImportAnother,
  rowsSectionRef,
}) => {
  const parsedRows = Array.isArray(rows) ? rows : [];
  const summary = preview?.parserSummary || {};
  const incomeCount = parsedRows.filter((row) => row.type === "income").length;
  const expenseCount = parsedRows.filter((row) => row.type === "expense").length;
  const needsReviewCount = parsedRows.filter(
    (row) => !isImportablePdfType(row.type)
  ).length;

  if (confirmResult) {
    return (
      <section className="mb-8 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <PdfConfirmResult
          result={confirmResult}
          onViewHistory={onViewHistory}
          onImportAnother={onImportAnother}
        />
      </section>
    );
  }

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 md:flex-row md:items-start md:justify-between md:px-6">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
            PDF Preview Only
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
            Bank statement preview
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review the rows Munmai found. Nothing is saved until you import
            selected rows.
          </p>
        </div>
      </div>

      <div className="space-y-6 p-5 md:p-6">
        <div>
          <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                Preview summary
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Rows are editable before import. Duplicates are checked when you import.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <PdfMetaCard label="Rows detected" value={parsedRows.length} />
            <PdfMetaCard
              label="Income"
              value={incomeCount}
              tone="text-emerald-600 dark:text-emerald-400"
            />
            <PdfMetaCard
              label="Expenses"
              value={expenseCount}
              tone="text-rose-600 dark:text-rose-400"
            />
            <PdfMetaCard
              label="Needs review"
              value={needsReviewCount}
              tone={needsReviewCount ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"}
            />
          </div>
        </div>

        {!preview.isTextReadable && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
            This PDF does not appear to contain readable text. Scanned/OCR PDFs
            are not supported yet.
          </div>
        )}

        <details className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
          <summary className="cursor-pointer text-sm font-black text-slate-700 dark:text-slate-200">
            Show technical preview details
          </summary>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <PdfMetaCard label="File" value={preview.fileName || "PDF statement"} />
              <PdfMetaCard label="Pages" value={preview.pageCount ?? "Unknown"} />
              <PdfMetaCard
                label="Text readable"
                value={preview.isTextReadable ? "Yes" : "No"}
                tone={preview.isTextReadable ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}
              />
              <PdfMetaCard label="Text length" value={formatNumber(preview.textLength)} />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <PdfMetaCard
              label="Parsed rows"
              value={summary.totalParsedRows || 0}
            />
            <PdfMetaCard
              label="High confidence"
              value={summary.highConfidenceRows || 0}
              tone="text-emerald-600 dark:text-emerald-400"
            />
            <PdfMetaCard
              label="Medium"
              value={summary.mediumConfidenceRows || 0}
              tone="text-amber-600 dark:text-amber-400"
            />
            <PdfMetaCard
              label="Low"
              value={summary.lowConfidenceRows || 0}
              tone="text-rose-600 dark:text-rose-400"
            />
            <PdfMetaCard
              label="Unknown type"
              value={summary.unknownTypeRows || 0}
            />
            </div>

            {preview.extractedTextSample && (
              <div className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  Extracted text sample
                </p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {preview.extractedTextSample}
                </pre>
              </div>
            )}
          </div>
        </details>

        <div ref={rowsSectionRef} tabIndex={-1} className="outline-none">
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                Parsed preview rows
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {selectedCount} selected for import. Duplicates will be skipped,
                not treated as failures.
              </p>
            </div>

            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming || selectedCount === 0}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
            >
              {confirming ? "Importing..." : "Import Selected PDF Rows"}
            </button>
          </div>

          {confirmStatus?.text && (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
                confirmStatus.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300"
              }`}
            >
              {confirmStatus.text}
            </div>
          )}

          {parsedRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
              <p className="font-bold text-slate-700 dark:text-slate-200">No transaction-like rows found.</p>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
                This PDF may use unsupported formatting, scanned pages, or a
                table layout that needs a future parser update.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {parsedRows.map((row) => (
                <PdfParsedRow
                  key={`${row.rowNumber}-${row.rawText}`}
                  row={row}
                  selected={Boolean(selectedRows[getPdfRowKey(row)])}
                  onToggle={() => onToggleRow(getPdfRowKey(row))}
                  onUpdate={(updates) => onUpdateRow(getPdfRowKey(row), updates)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const PdfMetaCard = ({ label, value, tone = "text-slate-900 dark:text-slate-100" }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`mt-1 break-words text-lg font-black ${tone}`}>{value}</p>
  </div>
);

const getPdfResultDescription = (rowResult) => {
  if (rowResult.status === "imported") {
    return `${rowResult.recordType === "income" ? "Income" : "Expense"} added`;
  }

  if (rowResult.status === "duplicate_skipped") {
    return "Already imported from a previous import.";
  }

  if (rowResult.status === "skipped") {
    return rowResult.reason || "Skipped";
  }

  if (rowResult.status === "error") {
    return rowResult.message || "Could not import this row.";
  }

  return rowResult.reason || rowResult.message || "Processed";
};

const PdfConfirmResult = ({ result, onViewHistory, onImportAnother }) => {
  const summary = result?.summary || {};
  const results = Array.isArray(result?.results) ? result.results : [];
  const hasDuplicates = Number(summary.duplicatesSkipped || 0) > 0;
  const importedCount =
    Number(summary.incomeImported || 0) + Number(summary.expensesImported || 0);
  const duplicateOnly = importedCount === 0 && hasDuplicates;

  return (
    <div className="space-y-6 p-5 md:p-6">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
          {duplicateOnly ? "No new rows imported" : "Import complete"}
        </p>
        <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
          {duplicateOnly
            ? "These rows were already imported before, so Munmai skipped them to protect your totals."
            : "Your selected PDF rows were added to Munmai."}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Start another import to upload a new CSV or PDF statement.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <PdfMetaCard label="Processed" value={summary.totalProcessed || 0} />
          <PdfMetaCard
            label="Income imported"
            value={summary.incomeImported || 0}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <PdfMetaCard
            label="Expenses imported"
            value={summary.expensesImported || 0}
            tone="text-rose-600 dark:text-rose-400"
          />
          <PdfMetaCard
            label="Duplicates skipped"
            value={summary.duplicatesSkipped || 0}
            tone={hasDuplicates ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"}
          />
          <PdfMetaCard label="Skipped" value={summary.unsupportedSkipped || 0} />
          <PdfMetaCard
            label="Errors"
            value={summary.errorsCount || 0}
            tone={summary.errorsCount ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"}
          />
        </div>

        {hasDuplicates && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
            Duplicates were skipped to protect your totals.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={onImportAnother}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
          >
            Import another statement
          </button>
          <Link
            to="/money/transactions"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            View transactions
          </Link>
          <button
            type="button"
            onClick={onViewHistory}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            View import history
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="mb-3 text-sm font-black uppercase tracking-widest text-slate-400">
            Row results
          </p>
          <div className="space-y-2">
            {results.map((rowResult) => (
              <div
                key={`${rowResult.rowNumber}-${rowResult.status}`}
                className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    Row {rowResult.rowNumber}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {getPdfResultDescription(rowResult)}
                  </p>
                </div>
                <PdfResultStatus status={rowResult.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PdfResultStatus = ({ status }) => {
  const label = String(status || "processed").replace(/_/g, " ");
  const tone =
    status === "imported"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
      : status === "duplicate_skipped" || status === "skipped"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
      : status === "error"
      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${tone}`}
    >
      {label}
    </span>
  );
};

const PdfParsedRow = ({ row, selected, onToggle, onUpdate }) => {
  const importable = isImportablePdfType(row.type);

  return (
    <article
      className={`rounded-2xl border p-4 dark:border-slate-800 ${
        selected
          ? "border-slate-300 bg-white dark:bg-slate-900"
          : "border-slate-100 bg-slate-50 dark:bg-slate-950/70"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <input
            type="checkbox"
            checked={selected}
            disabled={!importable}
            onChange={onToggle}
            className="mt-1 h-5 w-5 rounded border-slate-300 text-slate-900 disabled:opacity-40"
            aria-label={`Select PDF row ${row.rowNumber}`}
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                Row {row.rowNumber}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {row.confidence || "low"} confidence
              </span>
              {!importable && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  Not importable
                </span>
              )}
            </div>
            <p className="mt-3 font-black text-slate-900 dark:text-slate-100">
              {row.description || "No description"}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{row.date || "No date"}</p>
          </div>
        </div>

        <p
          className={`text-lg font-black ${
            row.type === "income"
              ? "text-emerald-600 dark:text-emerald-400"
              : row.type === "expense"
              ? "text-rose-600 dark:text-rose-400"
              : "text-slate-900 dark:text-slate-100"
          }`}
        >
          {formatCurrency(row.amount)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <FormField label="Type">
          <select
            value={row.type || "unknown"}
            onChange={(event) => onUpdate({ type: event.target.value })}
            className={inputClass}
          >
            <option value="unknown">Unknown</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </FormField>

        <FormField label="Category">
          <input
            type="text"
            value={row.category || ""}
            onChange={(event) => onUpdate({ category: event.target.value })}
            disabled={!importable}
            placeholder={row.type === "income" ? "Salary, Other" : "Other"}
            className={inputClass}
          />
        </FormField>
      </div>

      {!importable && (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
          Unknown rows are not importable until you classify them as income or
          expense.
        </p>
      )}

      {row.rawText && (
        <div className="mt-3 rounded-xl border border-slate-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Raw text
          </p>
          <p className="break-words text-sm text-slate-600 dark:text-slate-300">
            {row.rawText}
          </p>
        </div>
      )}
    </article>
  );
};

const BatchRow = ({ batch, selected, onOpen, onRemove }) => (
  <article
    className={`p-5 transition hover:bg-slate-50 dark:hover:bg-slate-900/80 ${
      selected ? "bg-slate-50 dark:bg-slate-900/70" : "dark:bg-slate-950/20"
    }`}
  >
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words font-black text-slate-900">
            {batch.originalFilename}
          </h3>
          <StatusPill status={batch.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {Number(batch.totalRows || 0)} rows - {getBatchProgress(batch)}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
        >
          {batch.status === "imported" ? "View Summary" : "Open Review"}
        </button>
        {["cancelled", "pending_review"].includes(batch.status) && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-900/70 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
          >
            {batch.status === "cancelled" ? "Remove" : "Cancel"}
          </button>
        )}
      </div>
    </div>
  </article>
);

const ImportRowEditor = ({
  row,
  liabilities,
  readOnly,
  rowError,
  saving,
  onChange,
  onSave,
  onSkip,
  onUndoSkip,
}) => {
  const imported = row.status === "imported" || Boolean(row.importedRecordType);
  const skipped = row.status === "ignored" && row.classification === "ignore";
  const locked = readOnly || imported;
  const effectiveClassification = getEffectiveClassification(row);
  const debtPayment = effectiveClassification === "debt_payment";
  const linkedLiabilityId = getLinkedLiabilityId(row);

  return (
    <article
      className={`p-5 md:p-6 ${
        skipped
          ? "bg-slate-50/80 opacity-80 dark:bg-slate-900/60"
          : "dark:bg-slate-950/20"
      }`}
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-slate-900">
              {row.description || row.rawDescription || "Imported row"}
            </p>
            <StatusPill status={row.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {formatDate(row.parsedDate)} - {row.direction} - Suggested:{" "}
            <span className="font-semibold">
              {getClassificationLabel(row.suggestedClassification || "unclassified")}
            </span>
          </p>
        </div>

        <p
          className={`text-lg font-black ${
            row.direction === "inflow" ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {row.direction === "inflow" ? "+" : "-"}
          {formatCurrency(row.amount)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <FormField label="Date">
          <input
            type="date"
            value={toDateInputValue(row.parsedDate)}
            onChange={(event) => onChange({ parsedDate: event.target.value })}
            disabled={locked || skipped || saving}
            className={inputClass}
          />
        </FormField>

        <FormField label="Description">
          <input
            type="text"
            value={row.description || ""}
            onChange={(event) => onChange({ description: event.target.value })}
            disabled={locked || skipped || saving}
            className={inputClass}
          />
        </FormField>

        <FormField label="Amount">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={row.amount || ""}
            onChange={(event) => onChange({ amount: event.target.value })}
            disabled={locked || skipped || saving}
            className={inputClass}
          />
        </FormField>

        <FormField label="Classification">
          <select
            value={effectiveClassification}
            onChange={(event) => onChange({ classification: event.target.value })}
            disabled={locked || skipped || saving}
            className={inputClass}
          >
            {classificationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Category">
          <input
            type="text"
            value={row.category || ""}
            onChange={(event) => onChange({ category: event.target.value })}
            disabled={
              locked ||
              skipped ||
              saving ||
              ["transfer", "ignore"].includes(effectiveClassification)
            }
            placeholder={
              effectiveClassification === "income"
                ? "Salary, Freelance, Other"
                : "Food, Rent, Other"
            }
            className={inputClass}
          />
        </FormField>

        {debtPayment && (
          <FormField label="Linked debt">
            <select
              value={linkedLiabilityId}
              onChange={(event) => onChange({ linkedLiability: event.target.value })}
              disabled={locked || skipped || saving}
              className={inputClass}
            >
              <option value="">Choose a debt</option>
              {liabilities.map((liability) => (
                <option key={liability._id} value={liability._id}>
                  {liability.creditorName} - {formatCurrency(liability.currentBalance)}
                </option>
              ))}
            </select>
          </FormField>
        )}

        <div className="lg:col-span-2">
          <FormField label="Notes">
            <input
              type="text"
              value={row.notes || ""}
              onChange={(event) => onChange({ notes: event.target.value })}
              disabled={locked || skipped || saving}
              placeholder="Optional notes"
              className={inputClass}
            />
          </FormField>
        </div>
      </div>

      {debtPayment && !linkedLiabilityId && !locked && (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Choose which debt this payment belongs to.
        </p>
      )}

      {skipped && (
        <p className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          This row will not be added to Munmai.
        </p>
      )}

      {(rowError || row.status === "error") && (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {rowError || "Import failed. Review this row."}
        </p>
      )}

      {!readOnly && (
        <div className="mt-4 flex flex-col justify-end gap-2 sm:flex-row">
          {skipped ? (
            <button
              type="button"
              onClick={onUndoSkip}
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:text-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
            >
              {saving ? "Restoring..." : "Undo Skip"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onSkip}
                disabled={imported || saving}
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 disabled:text-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 sm:w-auto"
              >
                {saving ? "Skipping..." : "Skip Row"}
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={imported || saving}
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:text-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
              >
                {saving ? "Saving..." : imported ? "Imported" : "Save Row"}
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
};

const ImportCompleteCard = ({ summary, onImportAnother }) => (
  <div className="border-b border-slate-100 bg-emerald-50/70 px-5 py-5 dark:border-slate-800 dark:bg-emerald-950/20 md:px-6">
    <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-900/60 dark:bg-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-emerald-600">
            Import Complete
          </p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">
            Reviewed rows were imported.
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Your imported records are now available in the relevant Munmai sections.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
          >
            Go to Dashboard
          </Link>
          <Link
            to="/money/transactions"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            View Transactions
          </Link>
          <Link
            to="/debt-reality"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            View Debt Reality
          </Link>
          <button
            type="button"
            onClick={onImportAnother}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Import Another CSV
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MiniMetric label="Processed" value={summary.totalProcessed || 0} />
        <MiniMetric label="Income" value={summary.incomeImported || 0} />
        <MiniMetric label="Expenses" value={summary.expensesImported || 0} />
        <MiniMetric label="Debt Payments" value={summary.debtPaymentsImported || 0} />
        <MiniMetric label="Transfers" value={summary.transfersSkipped || 0} />
        <MiniMetric label="Ignored" value={summary.ignored || 0} />
      </div>

      {summary.errors?.length > 0 && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {summary.errors.length} row(s) had errors.
        </div>
      )}
    </div>
  </div>
);

const CommitSummary = ({ summary }) => (
  <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/70 md:px-6">
    <p className="mb-3 text-sm font-black uppercase tracking-widest text-slate-400">
      Import Summary
    </p>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <MiniMetric label="Processed" value={summary.totalProcessed || 0} />
      <MiniMetric label="Income" value={summary.incomeImported || 0} />
      <MiniMetric label="Expenses" value={summary.expensesImported || 0} />
      <MiniMetric label="Debt Payments" value={summary.debtPaymentsImported || 0} />
      <MiniMetric label="Transfers" value={summary.transfersSkipped || 0} />
      <MiniMetric label="Ignored" value={summary.ignored || 0} />
    </div>
    {summary.errors?.length > 0 && (
      <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {summary.errors.length} row(s) failed. Review rows marked Error.
      </div>
    )}
  </div>
);

const FormField = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">
      {label}
    </span>
    {children}
  </label>
);

const MiniMetric = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
  </div>
);

const StatusPill = ({ status }) => (
  <span
    className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
      status === "imported" || status === "ready"
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        : status === "reverted"
        ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      : status === "error"
        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
      : status === "ignored" || status === "cancelled"
        ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
        : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    }`}
  >
    {statusLabels[status] || status}
  </span>
);

const EmptyState = ({ title, description }) => (
  <div className="px-6 py-12 text-center">
    <p className="font-bold text-slate-700">{title}</p>
    {description && (
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{description}</p>
    )}
  </div>
);

export default ImportReview;
