import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const responseCache = new Map();
const inflightRequests = new Map();

const normalizeCacheValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCacheValue(item));
  }
  if (value && typeof value === 'object') {
    const sorted = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        sorted[key] = normalizeCacheValue(value[key]);
      });
    return sorted;
  }
  return value;
};

const stableStringify = (value) => {
  return JSON.stringify(normalizeCacheValue(value));
};

const getAuthToken = () => {
  try {
    const token = localStorage.getItem('token');
    if (typeof token === 'string') {
      return token;
    }
    return '';
  } catch (_err) {
    return '';
  }
};

const buildCacheKey = (method, url, config) => {
  const baseUrl = typeof api.defaults.baseURL === 'string' ? api.defaults.baseURL : '';
  const params = config && config.params ? stableStringify(config.params) : '';
  const token = getAuthToken();
  return `${method}:${baseUrl}${url}?${params}|${token}`;
};

const resolveCacheOptions = (options) => {
  const ttlMs = typeof options?.ttlMs === 'number' ? options.ttlMs : 0;
  return { ttlMs };
};

export const clearApiCache = () => {
  responseCache.clear();
  inflightRequests.clear();
};

export const cachedGet = (url, config = {}, options = {}) => {
  const { ttlMs } = resolveCacheOptions(options);
  const cacheKey = buildCacheKey('get', url, config);

  if (ttlMs > 0) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.response);
    }
  }

  const inflight = inflightRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const requestPromise = api
    .get(url, config)
    .then((response) => {
      inflightRequests.delete(cacheKey);
      if (ttlMs > 0) {
        responseCache.set(cacheKey, {
          response,
          expiresAt: Date.now() + ttlMs,
        });
      }
      return response;
    })
    .catch((error) => {
      inflightRequests.delete(cacheKey);
      throw error;
    });

  inflightRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

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
      // Only redirect if we're on an /app/* route (logged-in area)
      if (window.location.pathname.startsWith('/app')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getMe: (options) => cachedGet('/auth/me', {}, options),
  updateProfile: (userData) => api.put('/auth/profile', userData),
};

// Users API
export const usersAPI = {
  getAll: (params, options) => cachedGet('/users', { params }, options),
  getById: (id, options) => cachedGet(`/users/${id}`, {}, options),
  update: (id, userData) => api.put(`/users/${id}`, userData),
  delete: (id) => api.delete(`/users/${id}`),
  getStats: (id, options) => cachedGet(`/users/${id}/stats`, {}, options),
  getTimelineStats: (id, options) => cachedGet(`/users/${id}/timeline-stats`, {}, options),
  getBadges: (id, options) => cachedGet(`/users/${id}/badges`, {}, options),
  getEloHistory: (id, params, options) => cachedGet(`/users/${id}/elo-history`, { params }, options),
  getPublicProfile: (username, options) => cachedGet(`/users/profile/${username}`, {}, options),
  checkBadgesTables: () => api.post('/users/check-badges-tables'),
};

// Leagues API
export const leaguesAPI = {
  getAll: (params, options) => cachedGet('/leagues', { params }, options),
  create: (leagueData) => api.post('/leagues', leagueData),
  getById: (id, options) => cachedGet(`/leagues/${id}`, {}, options),
  update: (id, leagueData) => api.put(`/leagues/${id}`, leagueData),
  delete: (id) => api.delete(`/leagues/${id}`),
  getMembers: (id, options) => cachedGet(`/leagues/${id}/members`, {}, options),
  invite: (id, userData) => api.post(`/leagues/${id}/invite`, userData),
  join: (id, inviteCode) => api.post(`/leagues/${id}/join`, inviteCode ? { invite_code: inviteCode } : {}),
  leave: (id) => api.delete(`/leagues/${id}/leave`),
  getLeaderboard: (id, params, options) => cachedGet(`/leagues/${id}/leaderboard`, { params }, options),
  getMatches: (id, params, options) => cachedGet(`/leagues/${id}/matches`, { params }, options),
  // Admin tools
  listInvites: (id, params, options) => cachedGet(`/leagues/${id}/invites`, { params }, options),
  revokeInvite: (id, inviteId) => api.delete(`/leagues/${id}/invites/${inviteId}`),
  promoteMember: (id, userId) => api.post(`/leagues/${id}/members/${userId}/promote`),
  demoteMember: (id, userId) => api.post(`/leagues/${id}/members/${userId}/demote`),
  setParticipation: (id, isParticipating) => api.post(`/leagues/${id}/participation`, { is_participating: isParticipating }),
  // Roster tools (placeholder members)
  createRosterMember: (id, display_name) => api.post(`/leagues/${id}/roster`, { display_name }),
  assignRosterMember: (id, rosterId, user_id) => api.post(`/leagues/${id}/roster/${rosterId}/assign`, { user_id }),
  getRosterEloHistory: (id, rosterId, params, options) => cachedGet(`/leagues/${id}/roster/${rosterId}/elo-history`, { params }, options),
};

// Matches API
export const matchesAPI = {
  getAll: (params, options) => cachedGet('/matches', { params }, options),
  create: (matchData) => api.post('/matches', matchData),
  getById: (id, options) => cachedGet(`/matches/${id}`, {}, options),
  update: (id, matchData) => api.put(`/matches/${id}`, matchData),
  delete: (id) => api.delete(`/matches/${id}`),
  accept: (id) => api.post(`/matches/${id}/accept`),
  reject: (id, reason) => api.post(`/matches/${id}/reject`, { reason }),
  getPending: (params, options) => cachedGet('/matches/pending', { params }, options),
  previewElo: (matchData) => api.post('/matches/preview-elo', matchData),
  consolidateLeague: (leagueId) => api.post(`/matches/leagues/${leagueId}/consolidate`),
  debugConsolidation: (leagueId, options) => cachedGet(`/matches/debug/consolidation/${leagueId}`, {}, options),
};

// Notifications API
export const notificationsAPI = {
  getAll: (params, options) => cachedGet('/notifications', { params }, options),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  delete: (id) => api.delete(`/notifications/${id}`),
  markAllAsRead: () => api.post('/notifications/mark-all-read'),
  getStats: (options) => cachedGet('/notifications/stats', {}, options),
};

// Badges API
export const badgesAPI = {
  getAll: (params, options) => cachedGet('/badges', { params }, options),
  create: (badgeData) => api.post('/badges', badgeData),
  update: (id, badgeData) => api.put(`/badges/${id}`, badgeData),
  delete: (id) => api.delete(`/badges/${id}`),
  getUsers: (id, options) => cachedGet(`/badges/${id}/users`, {}, options),
  awardToUser: (userId, badgeData) => api.post(`/badges/users/${userId}/badges`, badgeData),
  removeFromUser: (userId, badgeId) => api.delete(`/badges/users/${userId}/badges/${badgeId}`),
};

// Tickets API (support/feedback)
export const ticketsAPI = {
  create: (ticketData) => api.post('/tickets', ticketData),
  getAll: (params, options) => cachedGet('/tickets', { params }, options),
  updateStatus: (id, status) => api.patch(`/tickets/${id}`, { status }),
};

export default api;

