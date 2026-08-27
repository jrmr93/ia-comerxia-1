import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { normalizeEcuadorPhone } from '../utils/phone.ts';

export interface LocalUser {
  id: number;
  uid: string;
  username: string;
  password: string;
  email: string;
  name: string;
  role: string;
  photoUrl?: string | null;
  isActive?: boolean;
  activationCode?: string | null;
  activationExpiresAt?: string | null;
  resetCode?: string | null;
  resetExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalInventoryItem {
  id: number;
  userId: number;
  name: string;
  sku: string;
  description?: string;
  category: string;
  costPrice: string;
  salePrice: string;
  discountPercent?: number | null;
  stock: number;
  imageUrl?: string | null;
  videoUrl?: string | null;
  images?: string[] | null;
  supplierName: string;
  tags?: string | null;
  extractedAttributes?: string | null;
  status: string;
  rawTelegramMessage?: string | null;
  marketingCopy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalTelegramMessage {
  id: number;
  userId: number;
  telegramMessageId?: string | null;
  senderName?: string;
  senderUsername?: string | null;
  caption?: string;
  photoUrl?: string | null;
  processedStatus: string;
  extractedData?: string | null;
  inventoryItemId?: number | null;
  createdAt: string;
}

export interface LocalTelegramConfig {
  id: number;
  userId: number;
  botToken?: string | null;
  webhookSecret?: string | null;
  supplierName: string;
  supplierUsername?: string | null;
  autoApprove: boolean;
  defaultMarginPercent: number;
  currency: string;
  defaultStockEnabled?: boolean | null;
  defaultStockQuantity?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalAiConfig {
  id: number;
  userId: number;
  apiKey?: string | null;
  modelName: string;
  temperature: number;
  createdAt: string;
  updatedAt: string;
}

export interface LocalStoreConfig {
  id: number;
  userId: number;
  storeName: string;
  whatsappNumber: string;
  description: string;
  bannerText: string;
  deliveryFee: string;
  minOrderAmount: string;
  currency: string;
  showStock?: boolean | null;
  showOutOfStock?: boolean | null;
  websiteUrl?: string | null;
  website_url?: string | null;
  instagramUrl?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  courierLogos?: string | null;
  paymentLogos?: string | null;
  theme?: string | null;
  themeColors?: string | null;
  promoPopup?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalServerDomainConfig {
  id: number;
  userId: number;
  adminDomain: string;
  storeDomain: string;
  autoRouting: boolean;
  defaultFallbackView: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalEmailConfig {
  id: number;
  userId: number;
  googleEmail?: string | null;
  googleAppPassword?: string | null;
  senderName: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  requireActivation: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalCustomer {
  id: number;
  userId: number;
  name: string;
  fullName?: string | null;
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
  totalSpent: string;
  lastOrderDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalCustomerOrder {
  id: number;
  userId: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerCi?: string | null;
  ci?: string | null;
  customerAddress?: string;
  items: string; // JSON
  totalAmount: string;
  paymentMethod: string;
  status: string;
  paymentVoucher?: string | null;
  notes?: string;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  trackingNotes?: string | null;
  fulfillmentStatus?: string | null;
  linkedPurchaseId?: number | null;
  linkedPurchaseNumber?: string | null;
  createdAt: string;
}

export interface LocalPurchase {
  id: number;
  userId: number;
  purchaseNumber: string;
  supplierName: string;
  supplierContact?: string | null;
  items: string; // JSON string of PurchaseItem[]
  totalCost: string;
  status: string; // 'pending', 'ordered', 'in_transit', 'received', 'cancelled'
  paymentStatus: string; // 'unpaid', 'paid'
  linkedCustomerOrderId?: number | null;
  linkedCustomerOrderNumber?: string | null;
  receiptVoucher?: string | null;
  notes?: string | null;
  purchaseDate: string;
  receivedDate?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface LocalAnalyticsEvent {
  id: number;
  userId?: number | null;
  eventType: string; // 'store_visit', 'product_view', 'add_to_cart', 'whatsapp_click', 'order_placed'
  productId?: number | null;
  productName?: string | null;
  sessionId?: string | null;
  deviceType?: string;
  metadata?: string | null;
  createdAt: string;
}

export interface DatabaseState {
  users: LocalUser[];
  inventoryItems: LocalInventoryItem[];
  telegramMessages: LocalTelegramMessage[];
  telegramConfigs: LocalTelegramConfig[];
  aiConfigs: LocalAiConfig[];
  emailConfigs: LocalEmailConfig[];
  storeConfigs: LocalStoreConfig[];
  serverDomainConfigs: LocalServerDomainConfig[];
  customers: LocalCustomer[];
  customerOrders: LocalCustomerOrder[];
  purchases: LocalPurchase[];
  storeAnalyticsEvents: LocalAnalyticsEvent[];
  nextId: {
    users: number;
    inventoryItems: number;
    telegramMessages: number;
    telegramConfigs: number;
    aiConfigs: number;
    emailConfigs: number;
    storeConfigs: number;
    serverDomainConfigs: number;
    customers: number;
    customerOrders: number;
    purchases: number;
    storeAnalyticsEvents: number;
  };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

class StorageManager {
  private state: DatabaseState;
  private isLoaded = false;

  constructor() {
    this.state = this.getDefaultState();
    this.init();
  }

  private getDefaultState(): DatabaseState {
    return {
      users: [],
      inventoryItems: [],
      telegramMessages: [],
      telegramConfigs: [
        {
          id: 1,
          userId: 1,
          botToken: null,
          webhookSecret: null,
          supplierName: 'Proveedor Telegram Principal',
          supplierUsername: null,
          autoApprove: true,
          defaultMarginPercent: 35,
          currency: 'USD',
          defaultStockEnabled: false,
          defaultStockQuantity: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      aiConfigs: [
        {
          id: 1,
          userId: 1,
          apiKey: null,
          modelName: 'gemini-3.7-flash',
          temperature: 0.2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      emailConfigs: [
        {
          id: 1,
          userId: 1,
          googleEmail: null,
          googleAppPassword: null,
          senderName: 'Comerxia App',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 465,
          smtpSecure: true,
          requireActivation: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      storeConfigs: [
        {
          id: 1,
          userId: 1,
          storeName: 'Comerxia Store',
          whatsappNumber: '',
          description: 'Catálogo digital con envíos y pedidos directos por WhatsApp',
          bannerText: '🔥 ¡Catálogo actualizado con las últimas novedades en stock!',
          deliveryFee: '0.00',
          minOrderAmount: '0.00',
          currency: 'USD',
          showStock: true,
          showOutOfStock: true,
          instagramUrl: null,
          address: null,
          logoUrl: null,
          courierLogos: null,
          paymentLogos: null,
          promoPopup: JSON.stringify({
            active: true,
            theme: 'christmas',
            badge: '🎄 OFERTA ESPECIAL',
            title: '¡Gran Venta Especial y Descuentos!',
            description: 'Aprovecha promociones exclusivas, envíos rápidos a todo el país y atención personalizada vía WhatsApp.',
            imageUrl: 'https://images.unsplash.com/photo-1543258103-a62bd96b300b?auto=format&fit=crop&w=900&q=85',
            couponCode: 'OFERTA2026',
            buttonText: '¡Pedir con Descuento por WhatsApp!',
            actionType: 'whatsapp',
            actionUrl: ''
          }),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      serverDomainConfigs: [
        {
          id: 1,
          userId: 1,
          adminDomain: 'admin.dominio1.com',
          storeDomain: 'www.dominio1.com, dominio1.com',
          autoRouting: true,
          defaultFallbackView: 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      customers: [],
      customerOrders: [],
      purchases: [],
      storeAnalyticsEvents: [],
      nextId: {
        users: 1,
        inventoryItems: 1,
        telegramMessages: 1,
        telegramConfigs: 2,
        aiConfigs: 2,
        emailConfigs: 2,
        storeConfigs: 2,
        serverDomainConfigs: 2,
        customers: 1,
        customerOrders: 1,
        purchases: 1,
        storeAnalyticsEvents: 1,
      },
    };
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        if (raw && raw.trim()) {
          const parsed = JSON.parse(raw);
          this.state = {
            ...this.getDefaultState(),
            ...parsed,
            purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
            nextId: {
              ...this.getDefaultState().nextId,
              ...(parsed.nextId || {}),
              purchases: (parsed.nextId && parsed.nextId.purchases) || 1,
            },
          };
        }
      } else {
        this.save();
      }
      this.isLoaded = true;
    } catch (err) {
      console.warn('StorageManager init error, using memory fallback:', err);
      this.state = this.getDefaultState();
    }
  }

  public save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to persist database.json to disk:', err);
    }
  }

  public getState(): DatabaseState {
    return this.state;
  }
}

export const storage = new StorageManager();
