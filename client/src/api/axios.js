import axios from 'axios';
import { getApiBaseUrl } from './baseUrl';

const BASE_URL = getApiBaseUrl();

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
