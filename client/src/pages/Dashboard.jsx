import { useEffect, useState, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [data, setData] = useState({ income: [], expenses: [] });

  useEffect(() => {
    const fetchTotals = async () => {
      const [inc, exp] = await Promise.all([
        api.get('/income'),
        api.get('/expenses')
      ]);
      setData({ income: inc.data, expenses: exp.data });
    };
    fetchTotals();
  }, []);

  const totalInc = data.income.reduce((a, b) => a + b.amount, 0);
  const totalExp = data.expenses.reduce((a, b) => a + b.amount, 0);

  return (
    <div className="p-10">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">Welcome, {user?.name}</h1>
        <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-green-100 rounded-lg shadow">
          <h3 className="text-green-700 font-bold">Total Income</h3>
          <p className="text-3xl font-bold">${totalInc.toFixed(2)}</p>
        </div>
        <div className="p-6 bg-red-100 rounded-lg shadow">
          <h3 className="text-red-700 font-bold">Total Expenses</h3>
          <p className="text-3xl font-bold">${totalExp.toFixed(2)}</p>
        </div>
        <div className="p-6 bg-blue-100 rounded-lg shadow">
          <h3 className="text-blue-700 font-bold">Net Balance</h3>
          <p className="text-3xl font-bold">${(totalInc - totalExp).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;