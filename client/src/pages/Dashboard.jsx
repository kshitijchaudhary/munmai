import { useEffect, useState, useContext, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import AddTransaction from '../components/AddTransaction';

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [data, setData] = useState({ income: [], expenses: [] });
  const [loading, setLoading] = useState(true);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, exp] = await Promise.all([
        api.get('/income'),
        api.get('/expenses')
      ]);
      setData({ income: inc.data, expenses: exp.data });
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- CHART LOGIC ---
  const chartData = useMemo(() => {
    const categoryMap = data.expenses.reduce((acc, curr) => {
      const cat = curr.category || 'Other';
      acc[cat] = (acc[cat] || 0) + curr.amount;
      return acc;
    }, {});

    return Object.keys(categoryMap).map(name => ({
      name,
      value: categoryMap[name]
    }));
  }, [data.expenses]);

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];
  // -------------------

  const totalInc = data.income.reduce((a, b) => a + b.amount, 0);
  const totalExp = data.expenses.reduce((a, b) => a + b.amount, 0);
  const balance = totalInc - totalExp;

  return (
    <div className="min-h-screen bg-[#F8FAFC] antialiased pb-20">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-slate-900">FinTrack<span className="text-indigo-600">.io</span></h1>
          <button onClick={logout} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <header className="mb-10">
          <h2 className="text-4xl font-black text-slate-900 leading-tight">Dashboard Overview</h2>
          <p className="text-slate-500 font-medium">Tracking {data.expenses.length + data.income.length} transactions.</p>
        </header>

        {/* 1. Statistics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Net Balance</p>
            <p className={`text-3xl font-black ${balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              ${balance.toLocaleString()}
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">Total Inflow</p>
            <p className="text-3xl font-black text-emerald-600">+${totalInc.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-2">Total Outflow</p>
            <p className="text-3xl font-black text-rose-600">-${totalExp.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 2. Form Column (Left) */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Add Entry</h3>
              <AddTransaction onTransactionAdded={fetchAllData} />
            </div>

            {/* 3. Visual Analytics Card */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-[400px]">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Spending Breakdown</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="85%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-medium italic">
                  No data to visualize yet.
                </div>
              )}
            </div>
          </div>

          {/* 4. Transaction History (Right) */}
          <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Recent Transactions</h3>
              <button onClick={fetchAllData} className="text-indigo-600 text-sm font-bold hover:underline">Refresh</button>
            </div>
            
            <div className="divide-y divide-slate-50">
              {loading ? (
                <div className="p-20 text-center animate-pulse text-slate-400 font-bold">Syncing Ledger...</div>
              ) : [...data.income, ...data.expenses].length === 0 ? (
                <div className="p-20 text-center text-slate-400 font-medium">No activity recorded.</div>
              ) : (
                [...data.income, ...data.expenses]
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((item) => (
                    <div key={item._id} className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${item.source ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                          {item.source ? '💰' : '🛒'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{item.source || item.recipient}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category} • {new Date(item.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <p className={`text-lg font-black ${item.source ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {item.source ? '+' : '-'}${item.amount.toLocaleString()}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;