import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api', timeout: 20000 });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('credentialing_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(r => r, error => {
  if (error.response?.status === 401 && !String(error.config?.url).includes('/auth/login')) {
    localStorage.removeItem('credentialing_token'); localStorage.removeItem('credentialing_user'); window.dispatchEvent(new Event('credentialing:logout'));
  }
  return Promise.reject(error);
});
export default api;
