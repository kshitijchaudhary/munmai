import { useMemo, useState } from "react";
import api from "../api/axios";
import { parseCsvText } from "../utils/parseCsv";
import {
  buildReviewRows,
  guessMappings,
  validateReviewRow,
} from "../utils/importReview";
import { trackError, trackEvent } from "../utils/telemetry";
import {
  TRANSACTION_DATE_FUTURE_MESSAGE,
  getLocalDateValue,
  getTransactionDateValidationError,
  submitWithTransactionDateBatchGuard,
} from "../utils/transactionDateValidation";

const ImportTransactions = ({ onImportComplete }) => {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importMode, setImportMode] = useState("infer_sign");
  const [mappings, setMappings] = useState({
    date: "",
    amount: "",
    description: "",
    category: "",
    type: "",
  });
  const [reviewRows, setReviewRows] = useState([]);
  const [bulkType, setBulkType] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [message, setMessage] = useState(null);
  const [importing, setImporting] = useState(false);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);
  const readyCount = useMemo(
    () => reviewRows.filter((row) => row.issues.length === 0).length,
    [reviewRows]
  );
  const selectedCount = useMemo(
    () => reviewRows.filter((row) => row.selected).length,
    [reviewRows]
  );
  const needsReviewCount = reviewRows.length - readyCount;

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCsvText(text);

      if (!parsed.headers.length || !parsed.rows.length) {
        setMessage({
          type: "error",
          text: "That file did not contain any CSV rows we could import.",
        });
        setHeaders([]);
        setRows([]);
        setReviewRows([]);
        setFileName("");
        return;
      }

      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setReviewRows([]);
      setFileName(file.name);
      setMappings(guessMappings(parsed.headers));
      trackEvent("csv_loaded", {
        fileName: file.name,
        rowCount: parsed.rows.length,
      });
      setMessage({
        type: "success",
        text: `Loaded ${parsed.rows.length} rows from ${file.name}. Map the columns, then build the review queue.`,
      });
    } catch (error) {
      console.error("CSV read error:", error);
      trackError("csv_read_failed", error.message);
      setMessage({
        type: "error",
        text: "We could not read that CSV file.",
      });
    }
  };

  const handleMappingChange = (field, value) => {
    setMappings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleBuildReviewQueue = () => {
    if (!mappings.date || !mappings.amount || !mappings.description) {
      setMessage({
        type: "error",
        text: "Map the date, amount, and description columns before building the review queue.",
      });
      return;
    }

    if (importMode === "type_column" && !mappings.type) {
      setMessage({
        type: "error",
        text: "Choose a type column or switch to a different import mode.",
      });
      return;
    }

    const nextReviewRows = buildReviewRows({
      rows,
      mappings,
      importMode,
    });

    setReviewRows(nextReviewRows);
    trackEvent("import_review_queue_built", {
      totalRows: nextReviewRows.length,
      readyRows: nextReviewRows.filter((row) => row.issues.length === 0).length,
    });
    setMessage({
      type: "success",
      text: `Review queue ready. ${nextReviewRows.filter((row) => row.issues.length === 0).length} rows are ready to import.`,
    });
  };

  const updateReviewRow = (rowId, updates) => {
    setReviewRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const nextRow = {
          ...row,
          ...updates,
        };

        nextRow.issues = validateReviewRow(nextRow);

        return nextRow;
      })
    );
  };

  const toggleRowSelection = (rowId) => {
    setReviewRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              selected: !row.selected,
            }
          : row
      )
    );
  };

  const selectAllReadyRows = () => {
    setReviewRows((prev) =>
      prev.map((row) => ({
        ...row,
        selected: row.issues.length === 0,
      }))
    );
  };

  const clearSelection = () => {
    setReviewRows((prev) =>
      prev.map((row) => ({
        ...row,
        selected: false,
      }))
    );
  };

  const applyBulkChanges = () => {
    if (!bulkType && !bulkCategory) {
      return;
    }

    setReviewRows((prev) =>
      prev.map((row) => {
        if (!row.selected) {
          return row;
        }

        const nextRow = {
          ...row,
          type: bulkType || row.type,
          category: bulkCategory || row.category,
        };

        nextRow.issues = validateReviewRow(nextRow);

        return nextRow;
      })
    );
  };

  const handleImport = async () => {
    const selectedRows = reviewRows.filter((row) => row.selected);
    const hasFutureDate = selectedRows.some(
      (row) =>
        getTransactionDateValidationError(row.date, {
          allowFlexibleFormat: true,
        }) === TRANSACTION_DATE_FUTURE_MESSAGE
    );

    const rowsToImport = selectedRows.filter(
      (row) => validateReviewRow(row).length === 0
    );

    if (!rowsToImport.length) {
      setMessage({
        type: "error",
        text: hasFutureDate
          ? TRANSACTION_DATE_FUTURE_MESSAGE
          : "Select at least one clean row to import.",
      });
      return;
    }

    try {
      setImporting(true);

      const submission = await submitWithTransactionDateBatchGuard({
        allowFlexibleFormat: true,
        entries: selectedRows,
        submit: () =>
          api.post("/transactions/import", {
            transactions: rowsToImport.map((row) => ({
              type: row.type,
              amount: row.amount,
              date: row.date,
              title: row.title,
              category: row.category,
            })),
          }),
      });
      if (!submission.submitted) {
        setMessage({ type: "error", text: submission.message });
        return;
      }

      const { data } = submission.value;
      trackEvent("csv_import_completed", {
        importedCount: data.importedCount,
        skippedCount: data.skippedCount,
      });

      setMessage({
        type: "success",
        text: `Imported ${data.importedCount} transactions. ${data.skippedCount} row(s) were skipped.`,
      });

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error("Import error:", error);
      trackError("csv_import_failed", error.message);
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Import failed.",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Import CSV</h3>
          <p className="text-sm text-slate-500">
            Upload bank-exported CSVs to onboard faster, then clean rows in a
            lightweight review queue before importing.
          </p>
        </div>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="w-full rounded-xl border border-slate-200 p-3 text-sm"
        />

        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {headers.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-slate-500 mb-1">Import mode</span>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="infer_sign">Infer from sign</option>
                  <option value="expenses_only">All expenses</option>
                  <option value="income_only">All income</option>
                  <option value="type_column">Use a type column</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="block text-slate-500 mb-1">Loaded file</span>
                <div className="border border-dashed border-slate-200 rounded-xl px-3 py-2 text-slate-700">
                  {fileName}
                </div>
              </label>

              <MappingSelect
                label="Date column"
                value={mappings.date}
                headers={headers}
                onChange={(value) => handleMappingChange("date", value)}
              />
              <MappingSelect
                label="Amount column"
                value={mappings.amount}
                headers={headers}
                onChange={(value) => handleMappingChange("amount", value)}
              />
              <MappingSelect
                label="Description column"
                value={mappings.description}
                headers={headers}
                onChange={(value) => handleMappingChange("description", value)}
              />
              <MappingSelect
                label="Category column"
                value={mappings.category}
                headers={headers}
                onChange={(value) => handleMappingChange("category", value)}
                optional
              />
              {importMode === "type_column" && (
                <MappingSelect
                  label="Type column"
                  value={mappings.type}
                  headers={headers}
                  onChange={(value) => handleMappingChange("type", value)}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleBuildReviewQueue}
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 sm:w-auto"
              >
                Build Review Queue
              </button>

              <div className="flex items-center text-sm text-slate-500">
                Previewing {previewRows.length} of {rows.length} loaded row(s)
              </div>
            </div>

            {reviewRows.length === 0 && (
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Raw Preview
                </p>
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="min-w-[520px] text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {headers.slice(0, 4).map((header) => (
                          <th key={header} className="text-left px-3 py-2 font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr key={`${fileName}-${rowIndex}`} className="border-t border-slate-50">
                          {headers.slice(0, 4).map((header) => (
                            <td key={`${rowIndex}-${header}`} className="px-3 py-2 text-slate-700">
                              {row[header] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {reviewRows.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniMetric label="Ready rows" value={readyCount} />
              <MiniMetric label="Needs review" value={needsReviewCount} />
              <MiniMetric label="Selected" value={selectedCount} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <label className="text-sm">
                <span className="block text-slate-500 mb-1">Bulk type</span>
                <select
                  value={bulkType}
                  onChange={(e) => setBulkType(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="">Leave as-is</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="block text-slate-500 mb-1">Bulk category</span>
                <input
                  type="text"
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  placeholder="Optional category"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                />
              </label>

              <button
                type="button"
                onClick={applyBulkChanges}
                className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200 sm:w-auto"
              >
                Apply to Selected
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={selectAllReadyRows}
                className="text-sm font-semibold text-slate-700 hover:underline"
              >
                Select ready rows
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-sm font-semibold text-slate-500 hover:underline"
              >
                Clear selection
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="min-w-[920px] text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Use</th>
                    <th className="text-left px-3 py-2 font-semibold">Row</th>
                    <th className="text-left px-3 py-2 font-semibold">Type</th>
                    <th className="text-left px-3 py-2 font-semibold">Date</th>
                    <th className="text-left px-3 py-2 font-semibold">Description</th>
                    <th className="text-left px-3 py-2 font-semibold">Amount</th>
                    <th className="text-left px-3 py-2 font-semibold">Category</th>
                    <th className="text-left px-3 py-2 font-semibold">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-50 align-top">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleRowSelection(row.id)}
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                      <td className="px-3 py-2">
                        <select
                          value={row.type}
                          onChange={(e) =>
                            updateReviewRow(row.id, { type: e.target.value })
                          }
                          className="border border-slate-200 rounded-lg px-2 py-1"
                        >
                          <option value="">Choose</option>
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={row.date}
                          max={getLocalDateValue()}
                          onChange={(e) =>
                            updateReviewRow(row.id, { date: e.target.value })
                          }
                          className="border border-slate-200 rounded-lg px-2 py-1 min-w-[130px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.title}
                          onChange={(e) =>
                            updateReviewRow(row.id, { title: e.target.value })
                          }
                          className="border border-slate-200 rounded-lg px-2 py-1 min-w-[180px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.amount}
                          onChange={(e) =>
                            updateReviewRow(row.id, { amount: e.target.value })
                          }
                          className="border border-slate-200 rounded-lg px-2 py-1 min-w-[100px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.category}
                          onChange={(e) =>
                            updateReviewRow(row.id, { category: e.target.value })
                          }
                          className="border border-slate-200 rounded-lg px-2 py-1 min-w-[140px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {row.issues.length > 0 ? (
                          <span className="text-rose-600 font-semibold">
                            {row.issues.join(", ")}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">
                            Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-300 sm:w-auto"
            >
              {importing ? "Importing..." : "Import Selected Rows"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const MappingSelect = ({ label, value, headers, onChange, optional = false }) => (
  <label className="text-sm">
    <span className="block text-slate-500 mb-1">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-200 rounded-xl px-3 py-2"
    >
      <option value="">{optional ? "Not used" : "Select a column"}</option>
      {headers.map((header) => (
        <option key={header} value={header}>
          {header}
        </option>
      ))}
    </select>
  </label>
);

const MiniMetric = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-100 p-4">
    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">
      {label}
    </p>
    <p className="text-xl font-black text-slate-900">{value}</p>
  </div>
);

export default ImportTransactions;
