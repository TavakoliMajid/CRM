/**
 * CRM Hira - Frontend API Client
 * Manages authentication token, JSON serialization, and error handling.
 */

const API = {
  tokenKey: 'crm_hira_token',
  userKey: 'crm_hira_user',

  getToken() {
    return localStorage.getItem(this.tokenKey);
  },

  setAuth(token, user) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  },

  getCurrentUser() {
    try {
      const u = localStorage.getItem(this.userKey);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(endpoint, { ...options, headers });
      if (res.status === 401 && !endpoint.includes('/api/auth/login')) {
        this.clearAuth();
        window.location.hash = '#login';
        window.dispatchEvent(new CustomEvent('auth:expired'));
        throw new Error('نشست شما منقضی شده است. لطفا مجددا وارد شوید.');
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || json.message || 'خطا در ارتباط با سرور');
        }
        return json;
      }
      return await res.text();
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  },

  // Auth
  async login(username, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.setAuth(res.token, res);
    return res;
  },

  async getMe() {
    return await this.request('/api/auth/me');
  },

  logout() {
    this.clearAuth();
    window.location.hash = '#login';
    window.location.reload();
  },

  // Dashboard & Visual Monitoring
  async getDashboardStats() {
    return await this.request('/api/dashboard/stats');
  },

  // Patients
  async getPatients(q = '', status = 'all') {
    return await this.request(`/api/patients?q=${encodeURIComponent(q)}&status=${status}`);
  },

  async getPatientDetails(id) {
    return await this.request(`/api/patients/${id}`);
  },

  async createPatient(data) {
    return await this.request('/api/patients', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async togglePatientStatus(id, isActive, reason = '') {
    return await this.request(`/api/patients/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive, reason })
    });
  },

  async addTreatment(patientId, data) {
    return await this.request(`/api/patients/${patientId}/treatments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async addProduct(patientId, data) {
    return await this.request(`/api/patients/${patientId}/products`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Follow-ups
  async getFollowups(status = 'all', patientId = '', today = '') {
    let url = `/api/followups?status=${status}`;
    if (patientId) url += `&patient_id=${patientId}`;
    if (today) url += `&today=${today}`;
    return await this.request(url);
  },

  async updateFollowup(id, status, notes = '') {
    return await this.request(`/api/followups/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes })
    });
  },

  // Leads & Retargeting
  async getLeads(status = 'all') {
    return await this.request(`/api/leads?status=${status}`);
  },

  async createLead(data) {
    return await this.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async convertLead(id) {
    return await this.request(`/api/leads/${id}/convert`, {
      method: 'POST'
    });
  },

  // Payments & Installments
  async getPayments() {
    return await this.request('/api/payments');
  },

  async getMonthlyInstallmentPrompts() {
    return await this.request('/api/installments/monthly-prompts');
  },

  async confirmInstallment(id, data = {}) {
    return await this.request(`/api/installments/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async createPaymentPlan(data) {
    return await this.request('/api/payments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Referrals
  async getReferralStats() {
    return await this.request('/api/referrals/stats');
  },

  // Services Catalog
  async getServices() {
    return await this.request('/api/services');
  },

  // Users & RBAC
  async getUsers() {
    return await this.request('/api/users');
  },

  async createUser(data) {
    return await this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async toggleUserStatus(id, isActive) {
    return await this.request(`/api/users/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive })
    });
  },

  // Google Sheets Sync
  async getSheetsConfig() {
    return await this.request('/api/sync/sheets/config');
  },

  async saveSheetsConfig(webhookUrl) {
    return await this.request('/api/sync/sheets/config', {
      method: 'POST',
      body: JSON.stringify({ webhook_url: webhookUrl })
    });
  },

  async triggerSheetsSync() {
    return await this.request('/api/sync/sheets/sync-now', {
      method: 'POST'
    });
  },

  // Backup & Google Drive
  async getBackups() {
    return await this.request('/api/backup/list');
  },

  async createBackup(destination = 'local', notes = '') {
    return await this.request('/api/backup/create', {
      method: 'POST',
      body: JSON.stringify({ destination, notes })
    });
  },

  async getGoogleDriveConfig() {
    return await this.request('/api/backup/cloud-config');
  },

  async saveGoogleDriveConfig(webhookUrl, folderId = '') {
    return await this.request('/api/backup/cloud-config', {
      method: 'POST',
      body: JSON.stringify({ webhook_url: webhookUrl, folder_id: folderId })
    });
  },

  async restoreBackup(filename) {
    return await this.request('/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ filename })
    });
  }
};

window.API = API;
