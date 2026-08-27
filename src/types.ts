export interface AuthUser {
  id: number;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'operador' | string;
  photoUrl?: string | null;
  isActive?: boolean;
  createdAt?: string;
}

export interface OperatorUser {
  id: number;
  username: string;
  email: string;
  name: string;
  role: 'operador';
  photoUrl?: string | null;
  isActive?: boolean;
  activationCode?: string | null;
  createdAt?: string;
}

export interface GoogleEmailConfig {
  id?: number;
  userId?: number;
  googleEmail: string;
  googleAppPassword?: string;
  hasAppPassword?: boolean;
  senderName: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  requireActivation: boolean;
  requireActivationGlobal?: boolean;
  isConfigured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: number;
  userId: number;
  name: string;
  sku: string;
  description: string | null;
  category: string;
  costPrice: string;
  salePrice: string;
  discountPercent?: number;
  stock: number;
  imageUrl: string | null;
  images?: string[];
  videoUrl?: string | null;
  supplierName: string | null;
  tags: string | null;
  extractedAttributes: string | null;
  status: 'available' | 'low_stock' | 'sold_out' | 'archived';
  rawTelegramMessage: string | null;
  marketingCopy?: string | ProductMarketingCopy | null;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramMessage {
  id: number;
  telegramMessageId: string | null;
  senderName: string | null;
  senderUsername: string | null;
  caption: string | null;
  photoUrl: string | null;
  processedStatus: 'processed' | 'pending' | 'error';
  extractedData: string | null;
  inventoryItemId: number | null;
  inventoryItemName?: string | null;
  inventoryItemSku?: string | null;
  inventoryItemPrice?: string | null;
  createdAt: string;
}

export interface TelegramConfig {
  id: number;
  userId: number;
  botToken: string | null;
  webhookSecret: string | null;
  supplierName: string;
  supplierUsername: string | null;
  autoApprove: boolean;
  defaultMarginPercent: number;
  currency: string;
  defaultStockEnabled?: boolean;
  defaultStockQuantity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleAiConfig {
  id?: number;
  userId?: number;
  apiKey: string | null;
  hasKey?: boolean;
  modelName: string;
  temperature: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryStats {
  totalProducts: number;
  totalUnits: number;
  totalCostValue: number;
  totalSaleValue: number;
  estimatedProfit: number;
  totalDiscountValue?: number;
  totalDiscountedSaleValue?: number;
  profitWithDiscounts?: number;
  discountedProductsCount?: number;
  categories: { name: string; count: number; stock: number }[];
}

export interface CostOption {
  label: string;
  price: number;
}

export interface CartItem {
  item: InventoryItem;
  quantity: number;
}

export interface Customer {
  id: number;
  userId?: number;
  name: string;
  fullName?: string;
  phone: string;
  ci?: string | null;
  email?: string | null;
  address?: string | null;
  fullAddress?: string | null;
  province?: string | null;
  canton?: string | null;
  parish?: string | null;
  exactAddress?: string | null;
  reference?: string | null;
  totalOrders: number;
  totalSpent: string | number;
  lastOrderDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerOrderItem {
  id: number;
  name: string;
  sku: string;
  salePrice: string;
  costPrice?: string;
  quantity: number;
  imageUrl?: string | null;
  supplierName?: string | null;
  stockAvailable?: number;
  isCustomOrder?: boolean;
}

export interface CustomerOrder {
  id: number;
  userId: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  customerCi?: string | null;
  ci?: string | null;
  items: CustomerOrderItem[];
  totalAmount: string;
  paymentMethod: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  paymentVoucher?: string | null;
  notes: string | null;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  trackingNotes?: string | null;
  fulfillmentStatus?: 'in_stock' | 'supplier_pending' | 'supplier_ordered' | 'supplier_received';
  linkedPurchaseId?: number | null;
  linkedPurchaseNumber?: string | null;
  purchaseId?: number | null;
  purchaseNumber?: string | null;
  createdAt: string;
}

export interface PurchaseItem {
  inventoryItemId?: number;
  name: string;
  sku?: string;
  costPrice: string | number;
  salePrice?: string | number;
  quantity: number;
  imageUrl?: string | null;
  supplierName?: string | null;
  customerOrderId?: number | null;
  orderNumber?: string | null;
  customerName?: string | null;
}

export interface PurchaseOrder {
  id: number;
  userId: number;
  purchaseNumber: string;
  supplierName: string;
  supplierContact?: string | null;
  items: PurchaseItem[];
  totalCost: string | number;
  status: 'pending' | 'ordered' | 'in_transit' | 'received' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid';
  linkedCustomerOrderId?: number | null;
  linkedCustomerOrderNumber?: string | null;
  receiptVoucher?: string | null;
  notes?: string | null;
  purchaseDate: string;
  receivedDate?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface FinancialReportSummary {
  period: string;
  totalPurchasesCost: number;
  totalPurchasesCount: number;
  totalPendingPurchasesCost: number;
  totalSalesRevenue: number;
  totalOrdersCount: number;
  costOfGoodsSold: number;
  grossProfit: number;
  netProfitMarginPercent: number;
  currentPhysicalStockUnits: number;
  currentPhysicalStockCostValue: number;
  currentPhysicalStockSaleValue: number;
  recentTransactions: Array<{
    type: 'purchase' | 'sale';
    id: number;
    reference: string;
    description: string;
    amount: number;
    cost?: number;
    profit?: number;
    date: string;
    status: string;
  }>;
}

export interface CourierPartner {
  id: string;
  name: string;
  logoUrl?: string;
  quoteUrl?: string; // URL to quote shipping costs from the courier / tarifario web
  active: boolean;
}

export interface PaymentMethodPartner {
  id: string;
  name: string;
  logoUrl?: string;
  details?: string;
  active: boolean;
}

export type StoreTheme = 'classic' | 'boutique' | 'brutalist' | 'cyber' | 'minimal' | 'fresh';

export interface StorePromoPopupConfig {
  active: boolean;
  theme?: 'christmas' | 'black_friday' | 'super_deals' | 'new_year' | 'clearance' | 'custom' | string;
  badge?: string; // e.g. "🎄 OFERTA NAVIDEÑA"
  title: string; // e.g. "¡Gran Venta Especial de Navidad!"
  description: string; // e.g. "Aprovecha hasta un 30% de descuento en regalos seleccionados y envíos rápidos."
  imageUrl?: string | null; // AI generated or custom promotional banner
  couponCode?: string; // e.g. "NAVIDAD2026"
  buttonText?: string; // e.g. "Aprovechar Descuento por WhatsApp"
  actionType?: 'whatsapp' | 'catalog' | 'url';
  actionUrl?: string;
}

export interface StoreConfig {
  id?: number;
  userId?: number;
  storeName: string;
  whatsappNumber: string;
  description: string;
  bannerText: string;
  deliveryFee: number;
  minOrderAmount: number;
  currency: string;
  showStock?: boolean;
  showOutOfStock?: boolean;
  instagramUrl?: string;
  websiteUrl?: string | null;
  address?: string;
  logoUrl?: string | null;
  courierLogos?: CourierPartner[] | string;
  paymentLogos?: PaymentMethodPartner[] | string;
  theme?: StoreTheme | string;
  themeColors?: Record<string, string[]> | string;
  promoPopup?: StorePromoPopupConfig | string | null;
  domain?: string;
}

export interface ProductMarketingOptions {
  showStock?: boolean;
  showPhone?: boolean;
  showSku?: boolean;
  showWebsite?: boolean;
  websiteUrl?: string;
  tone?: string;
  customPrice?: string;
  cityOrRegion?: string;
  whatsappContact?: string;
  storeAddress?: string;
  paymentTitlesInput?: string;
  shippingCompaniesInput?: string;
}

export interface ProductMarketingCopy {
  title?: string;
  price?: string;
  sku?: string;
  tags?: string[];
  universalDescription: string;
  paymentTitles?: string[];
  shippingCompanies?: string[];
  allInOne?: string;
  savedAt?: string;
  options?: ProductMarketingOptions;
  showStock?: boolean;
  showPhone?: boolean;
  showSku?: boolean;
  showWebsite?: boolean;
  websiteUrl?: string;
  marketplace?: {
    title: string;
    price: string;
    condition: string;
    description: string;
    fullText: string;
  };
  instagram?: {
    hook: string;
    body: string;
    callToAction: string;
    hashtags: string[];
    fullText: string;
  };
  whatsapp?: {
    shortMessage: string;
    fullCatalogText: string;
  };
  ecommerce?: {
    seoTitle: string;
    bulletPoints: string[];
    technicalDescription: string;
    fullText: string;
  };
}

export interface ServerDomainConfig {
  id?: number;
  userId?: number;
  adminDomain: string; // e.g. "admin.dominio1.com" or comma separated
  storeDomain: string; // e.g. "www.dominio1.com, dominio1.com"
  autoRouting: boolean; // whether to automatically route based on hostname
  defaultFallbackView: 'store' | 'admin'; // what to show if domain doesn't match
  createdAt?: string;
  updatedAt?: string;
}

export interface ParsedProductResult {
  name: string;
  sku: string;
  category: string;
  costPrice: number;
  costOptions?: CostOption[];
  profitMarginPercent?: number;
  salePrice: number;
  stock: number;
  description: string;
  tags: string[];
  attributes: Record<string, any>;
  supplierNotes?: string;
  confidenceScore: number;
}

export interface StoreAnalyticsSummary {
  totalVisits: number;
  uniqueVisitors: number;
  totalProductViews: number;
  totalCartAdditions: number;
  totalWhatsappClicks: number;
  totalOrdersCount: number;
  totalRevenue: number;
  conversionRate: number;
  viewToCartRate: number;
  cartToWhatsappRate: number;
  peakDayName: string;
  peakHourTime: string;
  starProduct?: {
    id: number;
    name: string;
    unitsSold: number;
    revenue: number;
    imageUrl?: string | null;
    salePrice: number;
  } | null;
  mostViewedProduct?: {
    id: number;
    name: string;
    views: number;
    imageUrl?: string | null;
    salePrice: number;
  } | null;
}

export interface StoreAnalyticsTimelinePoint {
  date: string;
  label: string;
  visits: number;
  productViews: number;
  cartAdds: number;
  orders: number;
  revenue: number;
}

export interface StoreAnalyticsProductPerformance {
  id: number;
  name: string;
  sku: string;
  category: string;
  salePrice: number;
  stock: number;
  imageUrl?: string | null;
  videoUrl?: string | null;
  views: number;
  cartAdds: number;
  unitsSold: number;
  revenue: number;
  conversionRate: number;
  cartConversionRate: number;
}

export interface StoreAnalyticsDashboardData {
  period: 'today' | '7d' | '30d' | '90d' | 'year' | 'all';
  targetProductId?: number | null;
  summary: StoreAnalyticsSummary;
  funnel: Array<{ step: string; count: number; percent: number }>;
  timeline: StoreAnalyticsTimelinePoint[];
  topViewedProducts: StoreAnalyticsProductPerformance[];
  topPurchasedProducts: StoreAnalyticsProductPerformance[];
  dayOfWeekDistribution: Array<{
    dayIndex: number;
    dayName: string;
    orders: number;
    revenue: number;
  }>;
  hourlyDistribution: Array<{
    hour: string;
    hourNumber: number;
    orders: number;
    revenue: number;
  }>;
  deviceBreakdown: Array<{ name: string; value: number }>;
  productPerformance: StoreAnalyticsProductPerformance[];
}
