const Modal = ({ title, description, open, onClose, children }) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-6 backdrop-blur-sm md:py-10">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 md:px-6">
          <div>
            <h2 className="text-xl font-black text-slate-900">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
