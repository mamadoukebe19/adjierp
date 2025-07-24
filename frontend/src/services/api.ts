import axios, { AxiosInstance } from 'axios';
import toast from 'react-hot-toast';

// Configuration de base d'axios
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Intercepteur de requête pour ajouter le token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Intercepteur de réponse pour gérer les erreurs
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const { response } = error;
        
        if (response?.status === 401) {
          // Token expiré, essayer de le rafraîchir
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const refreshResponse = await this.api.post('/auth/refresh', {
                refreshToken,
              });
              
              if (refreshResponse.data.success) {
                const newToken = refreshResponse.data.data.accessToken;
                localStorage.setItem('accessToken', newToken);
                
                // Refaire la requête originale avec le nouveau token
                const originalRequest = error.config;
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return this.api.request(originalRequest);
              }
            } catch (refreshError) {
              // Refresh failed, redirect to login
              this.logout();
              window.location.href = '/login';
            }
          } else {
            this.logout();
            window.location.href = '/login';
          }
        }

        // Afficher le message d'erreur
        if (response?.data?.message) {
          toast.error(response.data.message);
        } else {
          toast.error('Une erreur est survenue');
        }

        return Promise.reject(error);
      }
    );
  }

  // Méthodes d'authentification
  async login(credentials: { username: string; password: string }) {
    const response = await this.api.post('/auth/login', credentials);
    
    if (response.data.success) {
      const { accessToken, refreshToken, user } = response.data.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
    }
    
    return response.data;
  }

  async logout() {
    try {
      await this.api.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  }

  async getProfile() {
    const response = await this.api.get('/auth/profile');
    return response.data;
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    const response = await this.api.put('/auth/change-password', data);
    return response.data;
  }

  // Méthodes pour les rapports
  async getReports(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    const response = await this.api.get('/reports', { params });
    return response.data;
  }

  async getReport(id: number) {
    const response = await this.api.get(`/reports/${id}`);
    return response.data;
  }

  async createReport(data: any) {
    const response = await this.api.post('/reports', data);
    return response.data;
  }

  async submitReport(id: number) {
    const response = await this.api.put(`/reports/${id}/submit`);
    return response.data;
  }

  async previewReport(id: number) {
    const response = await this.api.get(`/reports/preview/${id}`);
    return response.data;
  }

  async deleteReport(id: number) {
    const response = await this.api.delete(`/reports/${id}`);
    return response.data;
  }

  // Données pour les rapports
  async getProducts() {
    const response = await this.api.get('/reports/data/products');
    return response.data;
  }

  async getMaterials() {
    const response = await this.api.get('/reports/data/materials');
    return response.data;
  }

  async getArmatures() {
    const response = await this.api.get('/reports/data/armatures');
    return response.data;
  }

  // Méthodes pour les stocks
  async getPBAStock(params?: {
    page?: number;
    limit?: number;
    category?: string;
    lowStock?: boolean;
  }) {
    const response = await this.api.get('/stock/pba', { params });
    return response.data;
  }

  async getArmatureStock(params?: { page?: number; limit?: number }) {
    const response = await this.api.get('/stock/armatures', { params });
    return response.data;
  }

  async getMaterialStock(params?: {
    page?: number;
    limit?: number;
    category?: string;
  }) {
    const response = await this.api.get('/stock/materials', { params });
    return response.data;
  }

  async getStockMovements(params?: {
    page?: number;
    limit?: number;
    productId?: number;
    startDate?: string;
    endDate?: string;
    movementType?: string;
  }) {
    const response = await this.api.get('/stock/movements/pba', { params });
    return response.data;
  }

  async adjustStock(data: {
    productId: number;
    quantity: number;
    adjustmentType: 'add' | 'remove' | 'set';
    notes?: string;
  }) {
    const response = await this.api.post('/stock/pba/manual-adjustment', data);
    return response.data;
  }

  async recordDelivery(data: {
    productId: number;
    quantity: number;
    orderId?: number;
    notes?: string;
  }) {
    const response = await this.api.post('/stock/pba/delivery', data);
    return response.data;
  }

  async getStockSummary() {
    const response = await this.api.get('/stock/summary');
    return response.data;
  }

  // Méthodes pour les clients
  async getClients(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    city?: string;
  }) {
    const response = await this.api.get('/clients', { params });
    return response.data;
  }

  async getClient(id: number) {
    const response = await this.api.get(`/clients/${id}`);
    return response.data;
  }

  async createClient(data: {
    companyName: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  }) {
    const response = await this.api.post('/clients', data);
    return response.data;
  }

  async updateClient(id: number, data: any) {
    const response = await this.api.put(`/clients/${id}`, data);
    return response.data;
  }

  async toggleClientStatus(id: number) {
    const response = await this.api.put(`/clients/${id}/toggle-status`);
    return response.data;
  }

  async searchClients(query: string, limit?: number) {
    const response = await this.api.get('/clients/search', {
      params: { q: query, limit },
    });
    return response.data;
  }

  // Méthodes pour les commandes
  async getOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    clientId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const response = await this.api.get('/orders', { params });
    return response.data;
  }

  async getOrder(id: number) {
    const response = await this.api.get(`/orders/${id}`);
    return response.data;
  }

  async createOrder(data: {
    clientId: number;
    orderDate: string;
    deliveryDate?: string;
    items: {
      productId: number;
      quantity: number;
      unitPrice: number;
    }[];
    notes?: string;
  }) {
    const response = await this.api.post('/orders', data);
    return response.data;
  }

  async confirmOrder(id: number) {
    const response = await this.api.put(`/orders/${id}/confirm`);
    return response.data;
  }

  async createQuote(id: number, data: { validityDays: number; notes?: string }) {
    const response = await this.api.post(`/orders/${id}/quote`, data);
    return response.data;
  }

  async acceptQuote(id: number) {
    const response = await this.api.put(`/orders/${id}/quote/accept`);
    return response.data;
  }

  async createInvoice(id: number, data: { dueDays: number; notes?: string }) {
    const response = await this.api.post(`/orders/${id}/invoice`, data);
    return response.data;
  }

  async recordPayment(id: number, data: {
    amount: number;
    paymentMethod: 'cash' | 'check' | 'transfer' | 'card';
    paymentDate: string;
    reference?: string;
    notes?: string;
  }) {
    const response = await this.api.post(`/orders/${id}/payment`, data);
    return response.data;
  }

  // Méthodes pour le dashboard
  async getDashboardOverview() {
    const response = await this.api.get('/dashboard/overview');
    return response.data;
  }

  async getUserOverview() {
    const response = await this.api.get('/dashboard/user-overview');
    return response.data;
  }

  async getQuickStats() {
    const response = await this.api.get('/dashboard/quick-stats');
    return response.data;
  }

  async getAlerts() {
    const response = await this.api.get('/dashboard/alerts');
    return response.data;
  }

  async getRecentActivity(limit?: number) {
    const response = await this.api.get('/dashboard/recent-activity', {
      params: { limit },
    });
    return response.data;
  }

  async getProductionStats(days?: number) {
    const response = await this.api.get('/dashboard/production-stats', {
      params: { days },
    });
    return response.data;
  }

  // Méthodes pour les utilisateurs (admin/manager seulement)
  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const response = await this.api.get('/users', { params });
    return response.data;
  }

  async getUser(id: number) {
    const response = await this.api.get(`/users/${id}`);
    return response.data;
  }

  async updateUser(id: number, data: any) {
    const response = await this.api.put(`/users/${id}`, data);
    return response.data;
  }

  async toggleUserStatus(id: number) {
    const response = await this.api.put(`/users/${id}/toggle-status`);
    return response.data;
  }

  async resetUserPassword(id: number, newPassword: string) {
    const response = await this.api.put(`/users/${id}/reset-password`, {
      newPassword,
    });
    return response.data;
  }

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
  }) {
    const response = await this.api.post('/auth/register', data);
    return response.data;
  }

  // Méthode utilitaire pour vérifier l'état de connexion
  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  }

  // Méthode utilitaire pour obtenir l'utilisateur actuel
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // Méthode utilitaire pour vérifier les permissions
  hasPermission(requiredRole: string | string[]): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    const userRole = user.role;
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    // Admin a toutes les permissions
    if (userRole === 'admin') return true;

    return requiredRoles.includes(userRole);
  }
}

// Instance singleton
export const apiService = new ApiService();
export default apiService;
