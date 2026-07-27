const DocumentUploadField = ({
  label = "Document",
  helperText = "",
  accept = "",
  selectedFile = null,
  onFileChange,
  supportedTypes = [],
  detectedType = "",
  disabled = false,
  inputKey = 0,
  trustText = "",
}) => {
  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const buttonClass = disabled
    ? "inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-slate-400 px-4 py-2 text-xs font-bold text-white dark:bg-slate-700 dark:text-slate-400"
    : "inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white";

  const renderFileInput = (buttonText) => (
    <label className={disabled ? "cursor-not-allowed" : "cursor-pointer"}>
      <input
        key={inputKey}
        type="file"
        accept={accept}
        onChange={(event) => onFileChange(event.target.files?.[0] || null)}
        disabled={disabled}
        className="sr-only"
      />
      <span className={buttonClass}>
        {buttonText}
      </span>
    </label>
  );

  return (
    <div className="sm:col-span-2">
      {selectedFile ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Selected file
              </p>
              <p
                className="truncate text-sm font-bold text-emerald-900 dark:text-emerald-100"
                title={selectedFile.name}
              >
                {selectedFile.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-700 dark:text-emerald-300">
                {selectedFile.size && (
                  <span>{formatFileSize(selectedFile.size)}</span>
                )}
                {detectedType && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold dark:bg-emerald-900/50">
                    {detectedType.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            {renderFileInput("Change file")}
          </div>
          {trustText && (
            <p className="mt-3 text-[10px] text-emerald-600 dark:text-emerald-400">
              {trustText}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition-colors hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <svg
                className="h-6 w-6 text-slate-400 dark:text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>

            <p className="mb-1 text-sm font-black text-slate-900 dark:text-white">
              {label}
            </p>
            {helperText && (
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                {helperText}
              </p>
            )}

            {supportedTypes.length > 0 && (
              <div className="mb-3 flex flex-wrap justify-center gap-1.5">
                {supportedTypes.map((type) => (
                  <span
                    key={type}
                    className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                  >
                    {type}
                  </span>
                ))}
              </div>
            )}

            {renderFileInput("Choose file")}

            {trustText && (
              <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
                {trustText}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUploadField;
