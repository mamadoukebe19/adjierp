// Types pour l'authentification
export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'production' | 'manager' | 'user';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

// Types pour les produits PBA
export interface PBAProduct {
  id: number;
  code: string;
  name: string;
  description?: string;
  unitPrice: number;
  category: '9AR' | '12AR' | '12B' | '10B';
  isActive: boolean;
  createdAt: string;
}

// Types pour les matériaux
export interface Material {
  id: number;
  code: string;
  name: string;
  unit: 'kg' | 't' | 'g' | 'sac' | 'barre';
  unitPrice: number;
  category: 'fer' | 'ciment' | 'etrier';
  isActive: boolean;
  createdAt: string;
}

// Types pour les armatures
export interface Armature {
  id: number;
  code: string;
  name: string;
  pbaProductId?: number;
  unitPrice: number;
  isActive: boolean;
  createdAt: string;
}

// Types pour les stocks
export interface PBAStock {
  id: number;
  pbaProductId: number;
  initialStock: number;
  currentStock: number;
  totalProduced: number;
  totalDelivered: number;
  lastUpdated: string;
  code: string;
  name: string;
  category: string;
  unitPrice: number;
}

export interface ArmatureStock {
  id: number;
  armatureId: number;
  currentStock: number;
  totalEntries: number;
  lastUpdated: string;
  code: string;
  name: string;
  unitPrice: number;
}

export interface MaterialStock {
  id: number;
  materialId: number;
  currentStock: number;
  unit: string;
  lastUpdated: string;
  code: string;
  name: string;
  category: string;
  unitPrice: number;
}

// Types pour les rapports journaliers
export interface DailyReport {
  id: number;
  userId: number;
  reportDate: string;
  firstName: string;
  lastName: string;
  observations?: string;
  status: 'draft' | 'submitted' | 'validated';
  createdAt: string;
  updatedAt: string;
  username: string;
  userRole: string;
  pbaProduction: PBAProduction[];
  materialUsage: MaterialUsage[];
  armatureProduction: ArmatureProduction[];
  personnel: Personnel[];
}

export interface PBAProduction {
  id: number;
  productId: number;
  quantity: number;
  code: string;
  name: string;
  category: string;
}

export interface MaterialUsage {
  id: number;
  materialId: number;
  quantity: number;
  unit: string;
  additionalInfo?: string;
  code: string;
  name: string;
  category: string;
}

export interface ArmatureProduction {
  id: number;
  armatureId: number;
  quantity: number;
  code: string;
  name: string;
}

export interface Personnel {
  position: 'production' | 'soudeur' | 'ferrailleur' | 'ouvrier' | 'macon' | 'manoeuvre';
  quantity: number;
}

// Types pour les rapports - formulaire
export interface ReportFormData {
  reportDate: string;
  firstName: string;
  lastName: string;
  pbaProduction: {
    productId: number;
    quantity: number;
  }[];
  materialUsage: {
    materialId: number;
    quantity: number;
    unit: string;
    additionalInfo?: string;
  }[];
  armatureProduction: {
    armatureId: number;
    quantity: number;
  }[];
  personnel: {
    position: string;
    quantity: number;
  }[];
  observations?: string;
}

// Types pour les clients
export interface Client {
  id: number;
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Types pour les commandes
export interface Order {
  id: number;
  orderNumber: string;
  clientId: number;
  status: 'draft' | 'confirmed' | 'quoted' | 'paid' | 'invoiced' | 'delivered' | 'cancelled';
  orderDate: string;
  deliveryDate?: string;
  totalAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  clientName: string;
  contactPerson?: string;
  clientCity?: string;
  createdByUsername: string;
  createdByFirstName: string;
  createdByLastName: string;
}

export interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productCode: string;
  productName: string;
  productCategory: string;
}

export interface OrderDetails {
  order: Order & {
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    clientPostalCode?: string;
    clientCountry?: string;
  };
  items: OrderItem[];
  quote?: Quote;
  invoice?: Invoice;
  payments: Payment[];
}

// Types pour les devis
export interface Quote {
  id: number;
  quoteNumber: string;
  orderId: number;
  quoteDate: string;
  validityDate: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

// Types pour les factures
export interface Invoice {
  id: number;
  invoiceNumber: string;
  orderId: number;
  invoiceDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  totalAmount: number;
  paidAmount: number;
  notes?: string;
  createdAt: string;
}

// Types pour les paiements
export interface Payment {
  id: number;
  paymentDate: string;
  amount: number;
  paymentMethod: 'cash' | 'check' | 'transfer' | 'card';
  reference?: string;
  notes?: string;
}

// Types pour les mouvements de stock
export interface StockMovement {
  id: number;
  movementType: 'production' | 'delivery' | 'adjustment' | 'initial';
  quantity: number;
  referenceType: 'report' | 'order' | 'manual';
  referenceId?: number;
  notes?: string;
  createdAt: string;
  productCode: string;
  productName: string;
  createdByUsername: string;
  createdByFirstName: string;
  createdByLastName: string;
}

// Types pour le dashboard
export interface DashboardStats {
  totalStats: {
    activeUsers: number;
    activeClients: number;
    reports30d: number;
    pendingOrders: number;
    revenue30d: number;
    totalPbaStock: number;
    lowStockItems: number;
  };
  recentReports: DailyReport[];
  stockAlerts: PBAStock[];
  pendingOrders: Order[];
  recentOrders: Order[];
  monthlyProduction: {
    month: string;
    totalProduced: number;
    reportCount: number;
    activeUsers: number;
  }[];
  topProducts: {
    code: string;
    name: string;
    category: string;
    totalProduced: number;
    reportCount: number;
  }[];
}

// Types pour les alertes
export interface Alert {
  type: 'error' | 'warning' | 'info' | 'success';
  category: 'stock' | 'orders' | 'quotes' | 'system';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
}

// Types pour les réponses API
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  };
}

export interface PaginatedApiResponse<T> {
  success: boolean;
  data: T[] & {
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  };
}

// Types pour les formulaires
export interface FormErrors {
  [key: string]: string;
}

export interface SelectOption {
  value: string | number;
  label: string;
}

// Types pour les permissions
export type Permission = 'create' | 'read' | 'update' | 'delete';
export type Resource = 'users' | 'clients' | 'orders' | 'reports' | 'stock' | 'dashboard';

export interface UserPermissions {
  [key: string]: Permission[];
}
