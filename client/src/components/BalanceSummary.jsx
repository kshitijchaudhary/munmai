const formatCurrency = (value) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));
  
const BalanceSummary = ({ balances = [], loading = false, error = "" }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">Balance Summary</h3>
        <p className="text-sm text-slate-500">
          Current pairwise balances for this group.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Calculating balances...</p>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : balances.length === 0 ? (
        <p className="text-sm text-slate-500">
          No balances outstanding. This group is currently settled up.
        </p>
      ) : (
        <div className="space-y-3">
          {balances.map((balance) => (
            <div
              key={`${balance.fromUser}-${balance.toUser}`}
              className="rounded-xl border border-slate-200 px-4 py-3"
            >
              <p className="text-sm text-slate-800">
                <span className="font-semibold break-all">{balance.fromUser}</span>{" "}
                owes{" "}
                <span className="font-semibold break-all">{balance.toUser}</span>{" "}
                <span className="font-bold text-slate-900">
                  {formatCurrency(balance.amount)}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BalanceSummary;
