import axios from 'axios';

const BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
});

// Attach token automatically
api.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('user'));

  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }

  return config;
});

export default api;