import axios from 'axios';
export const api = axios.create({ baseURL: '/api', withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
export function errorMessage(err) { return err.response?.data?.error || 'Request failed. Check the server and try again.'; }
