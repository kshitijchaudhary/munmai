import { useState } from 'react';
import api from '../api/axios';

const AddTransaction = ({ onTransactionAdded }) => {
  const [type, setType] = useState('expense'); // 'income' or 'expense'
  const [formData, setFormData] = useState({
    amount: '',
    source: '',     // for income
    recipient: '',  // for expense
    category: 'Other',
    notes: ''
  });
  const [file, setFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (type === 'expense' && file) {
        // Use FormData only for Expenses with Receipts
        const data = new FormData();
        Object.keys(formData).forEach(key => data.append(key, formData[key]));
        data.append('receipt', file);
        await api.post('/expenses', data);
      } else {
        // Use standard JSON for Income or expenses without files
        const endpoint = type === 'income' ? '/income' : '/expenses';
        await api.post(endpoint, formData);
      }
      
      alert('Success!');
      onTransactionAdded(); 
    } catch (err) {
      alert("Error saving transaction");
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
      <h3 className="text-xl font-bold mb-4">Add New Transaction</h3>
      <div className="flex gap-4 mb-4">
        <button 
          onClick={() => setType('income')} 
          className={`px-4 py-2 rounded ${type === 'income' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
        >Income</button>
        <button 
          onClick={() => setType('expense')} 
          className={`px-4 py-2 rounded ${type === 'expense' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
        >Expense</button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input 
          type="number" placeholder="Amount" required
          className="border p-2 rounded"
          onChange={(e) => setFormData({...formData, amount: e.target.value})}
        />
        <input 
          type="text" placeholder={type === 'income' ? "Source (e.g. Salary)" : "Recipient (e.g. Amazon)"} 
          required className="border p-2 rounded"
          onChange={(e) => setFormData({...formData, [type === 'income' ? 'source' : 'recipient']: e.target.value})}
        />
        {type === 'expense' && (
          <input 
            type="file" 
            className="border p-2 rounded"
            onChange={(e) => setFile(e.target.files[0])}
          />
        )}
        <button type="submit" className="md:col-span-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
          Save {type}
        </button>
      </form>
    </div>
  );
};

export default AddTransaction;