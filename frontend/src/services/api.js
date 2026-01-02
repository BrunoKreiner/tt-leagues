import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateProfile: (userData) => api.put('/auth/profile', userData),
};

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, userData) => api.put(`/users/${id}`, userData),
  delete: (id) => api.delete(`/users/${id}`),
  getStats: (id) => api.get(`/users/${id}/stats`),
  getBadges: (id) => api.get(`/users/${id}/badges`),
  getEloHistory: (id, params) => api.get(`/users/${id}/elo-history`, { params }),
      getPublicProfile: (username) => api.get(`/users/profile/${username}`),
    checkBadgesTables: () => api.post('/users/check-badges-tables'),
};

// Leagues API
export const leaguesAPI = {
  getAll: (params) => api.get('/leagues', { params }),
  create: (leagueData) => api.post('/leagues', leagueData),
  getById: (id) => api.get(`/leagues/${id}`),
  update: (id, leagueData) => api.put(`/leagues/${id}`, leagueData),
  delete: (id) => api.delete(`/leagues/${id}`),
  getMembers: (id) => api.get(`/leagues/${id}/members`),
  invite: (id, userData) => api.post(`/leagues/${id}/invite`, userData),
  join: (id, inviteCode) => api.post(`/leagues/${id}/join`, inviteCode ? { invite_code: inviteCode } : {}),
  leave: (id) => api.delete(`/leagues/${id}/leave`),
  getLeaderboard: (id, params) => api.get(`/leagues/${id}/leaderboard`, { params }),
  getMatches: (id, params) => api.get(`/leagues/${id}/matches`, { params }),
  // Admin tools
  listInvites: (id, params) => api.get(`/leagues/${id}/invites`, { params }),
  revokeInvite: (id, inviteId) => api.delete(`/leagues/${id}/invites/${inviteId}`),
  promoteMember: (id, userId) => api.post(`/leagues/${id}/members/${userId}/promote`),
  demoteMember: (id, userId) => api.post(`/leagues/${id}/members/${userId}/demote`),
};

// Matches API
export const matchesAPI = {
  getAll: (params) => api.get('/matches', { params }),
  create: (matchData) => api.post('/matches', matchData),
  getById: (id) => api.get(`/matches/${id}`),
  update: (id, matchData) => api.put(`/matches/${id}`, matchData),
  delete: (id) => api.delete(`/matches/${id}`),
  accept: (id) => api.post(`/matches/${id}/accept`),
  reject: (id, reason) => api.post(`/matches/${id}/reject`, { reason }),
  getPending: (params) => api.get('/matches/pending', { params }),
  previewElo: (matchData) => api.post('/matches/preview-elo', matchData),
  consolidateLeague: (leagueId) => api.post(`/matches/leagues/${leagueId}/consolidate`),
  debugConsolidation: (leagueId) => api.get(`/matches/debug/consolidation/${leagueId}`),
};

// Notifications API
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  delete: (id) => api.delete(`/notifications/${id}`),
  markAllAsRead: () => api.post('/notifications/mark-all-read'),
  getStats: () => api.get('/notifications/stats'),
};

// Badges API
export const badgesAPI = {
  getAll: (params) => api.get('/badges', { params }),
  create: (badgeData) => api.post('/badges', badgeData),
  update: (id, badgeData) => api.put(`/badges/${id}`, badgeData),
  delete: (id) => api.delete(`/badges/${id}`),
  getUsers: (id) => api.get(`/badges/${id}/users`),
  awardToUser: (userId, badgeData) => api.post(`/badges/users/${userId}/badges`, badgeData),
  removeFromUser: (userId, badgeId) => api.delete(`/badges/users/${userId}/badges/${badgeId}`),
};

export default api;

