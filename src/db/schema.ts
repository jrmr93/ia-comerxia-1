import { relations } from 'drizzle-orm';
import { boolean, integer, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table (Admin and system users stored directly in SQL DB)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(),
  username: text('username').unique(),
  password: text('password').notNull().default('admin'),
  email: text('email').notNull().default('admin@comerxia.com'),
  name: text('name').default('Administrador'),
  role: text('role').default('admin'),
  photoUrl: text('photo_url'),
  isActive: boolean('is_active').default(true),
  activationCode: text('activation_code'),
  activationExpiresAt: timestamp('activation_expires_at'),
  resetCode: text('reset_code'),
  resetExpiresAt: timestamp('reset_expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Telegram supplier configuration per user
export const telegramConfigs = pgTable('telegram_configs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  botToken: text('bot_token'),
  webhookSecret: text('webhook_secret'),
  supplierName: text('supplier_name').default('Proveedor Telegram'),
  supplierUsername: text('supplier_username'),
  autoApprove: boolean('auto_approve').default(true),
  defaultMarginPercent: integer('default_margin_percent').default(30),
  currency: text('currency').default('USD'),
  defaultStockEnabled: boolean('default_stock_enabled').default(false),
  defaultStockQuantity: integer('default_stock_quantity').default(10),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Inventory items created automatically from Telegram supplier messages
export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  sku: text('sku').notNull(),
  description: text('description'),
  category: text('category').notNull().default('General'),
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }).notNull().default('0.00'),
  salePrice: numeric('sale_price', { precision: 12, scale: 2 }).notNull().default('0.00'),
  discountPercent: integer('discount_percent').default(0),
  stock: integer('stock').notNull().default(1),
  imageUrl: text('image_url'),
  videoUrl: text('video_url'),
  supplierName: text('supplier_name').default('Proveedor Telegram'),
  tags: text('tags'), // Comma separated or json tags
  extractedAttributes: text('extracted_attributes'), // JSON string: colors, sizes, specs
  status: text('status').notNull().default('available'), // 'available', 'low_stock', 'sold_out', 'archived'
  rawTelegramMessage: text('raw_telegram_message'),
  marketingCopy: text('marketing_copy'), // JSON string with AI generated marketing copy
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Received Telegram messages log & AI processing status
export const telegramMessages = pgTable('telegram_messages', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  telegramMessageId: text('telegram_message_id'),
  senderName: text('sender_name'),
  senderUsername: text('sender_username'),
  caption: text('caption'),
  photoUrl: text('photo_url'),
  processedStatus: text('processed_status').notNull().default('processed'), // 'processed', 'pending', 'error'
  extractedData: text('extracted_data'), // JSON summary from Gemini
  inventoryItemId: integer('inventory_item_id').references(() => inventoryItems.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Customers table (stored directly in SQL DB for complete client directory & CRM)
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  ci: text('ci'),
  email: text('email'),
  address: text('address'),
  province: text('province'),
  canton: text('canton'),
  parish: text('parish'),
  exactAddress: text('exact_address'),
  reference: text('reference'),
  totalOrders: integer('total_orders').notNull().default(0),
  totalSpent: numeric('total_spent', { precision: 12, scale: 2 }).notNull().default('0.00'),
  lastOrderDate: timestamp('last_order_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Customer Orders received from the Online Store (Storefront)
export const customerOrders = pgTable('customer_orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  orderNumber: text('order_number').notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerCi: text('customer_ci'),
  customerAddress: text('customer_address'),
  items: text('items').notNull().default('[]'), // JSON string array of CartItem details
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  paymentMethod: text('payment_method').default('whatsapp'),
  status: text('status').notNull().default('pending'), // 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'
  paymentVoucher: text('payment_voucher'),
  notes: text('notes'),
  trackingNumber: text('tracking_number'),
  trackingCarrier: text('tracking_carrier'),
  trackingNotes: text('tracking_notes'),
  fulfillmentStatus: text('fulfillment_status').default('in_stock'), // 'in_stock', 'supplier_pending', 'supplier_ordered', 'supplier_received'
  linkedPurchaseId: integer('linked_purchase_id'),
  linkedPurchaseNumber: text('linked_purchase_number'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Purchases and Supplier Orders Table (Compras a Proveedores / Abastecimiento)
export const purchases = pgTable('purchases', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  purchaseNumber: text('purchase_number').notNull(),
  supplierName: text('supplier_name').notNull().default('Proveedor Telegram'),
  supplierContact: text('supplier_contact'),
  items: text('items').notNull().default('[]'), // JSON string array of PurchaseItem details
  totalCost: numeric('total_cost', { precision: 12, scale: 2 }).notNull().default('0.00'),
  status: text('status').notNull().default('pending'), // 'pending', 'ordered', 'in_transit', 'received', 'cancelled'
  paymentStatus: text('payment_status').default('paid'), // 'unpaid', 'paid'
  linkedCustomerOrderId: integer('linked_customer_order_id').references(() => customerOrders.id, { onDelete: 'set null' }),
  linkedCustomerOrderNumber: text('linked_customer_order_number'),
  receiptVoucher: text('receipt_voucher'),
  notes: text('notes'),
  purchaseDate: timestamp('purchase_date').defaultNow(),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Storefront branding & configuration
export const storeConfigs = pgTable('store_configs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  storeName: text('store_name').default('Comerxia Store'),
  whatsappNumber: text('whatsapp_number').default(''),
  description: text('description').default('Catálogo digital con envíos y pedidos directos'),
  bannerText: text('banner_text').default('🔥 ¡Catálogo actualizado con las últimas novedades en stock!'),
  deliveryFee: numeric('delivery_fee', { precision: 12, scale: 2 }).default('0.00'),
  minOrderAmount: numeric('min_order_amount', { precision: 12, scale: 2 }).default('0.00'),
  currency: text('currency').default('USD'),
  showStock: boolean('show_stock').default(true),
  showOutOfStock: boolean('show_out_of_stock').default(true),
  instagramUrl: text('instagram_url'),
  websiteUrl: text('website_url'),
  address: text('address'),
  logoUrl: text('logo_url'),
  courierLogos: text('courier_logos'),
  paymentLogos: text('payment_logos'),
  theme: text('theme').default('classic'),
  promoPopup: text('promo_popup'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Server and Subdomain routing configuration
export const serverDomainConfigs = pgTable('server_domain_configs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  adminDomain: text('admin_domain').default('admin.dominio1.com'),
  storeDomain: text('store_domain').default('www.dominio1.com, dominio1.com'),
  autoRouting: boolean('auto_routing').default(true),
  defaultFallbackView: text('default_fallback_view').default('admin'), // 'admin' | 'store'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Google Gemini AI configuration per user
export const aiConfigs = pgTable('ai_configs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  apiKey: text('api_key'),
  modelName: text('model_name').default('gemini-3.7-flash'),
  temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.20'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Google Email (Gmail SMTP / Google Workspace) configuration for account activation and password recovery
export const emailConfigs = pgTable('email_configs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  googleEmail: text('google_email'),
  googleAppPassword: text('google_app_password'),
  senderName: text('sender_name').default('Comerxia App'),
  smtpHost: text('smtp_host').default('smtp.gmail.com'),
  smtpPort: integer('smtp_port').default(465),
  smtpSecure: boolean('smtp_secure').default(true),
  requireActivation: boolean('require_activation').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Store Analytics Events tracking (visits, product views, cart additions, whatsapp clicks)
export const storeAnalyticsEvents = pgTable('store_analytics_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(), // 'store_visit', 'product_view', 'add_to_cart', 'whatsapp_click', 'order_placed'
  productId: integer('product_id').references(() => inventoryItems.id, { onDelete: 'set null' }),
  productName: text('product_name'),
  sessionId: text('session_id'),
  deviceType: text('device_type').default('desktop'), // 'mobile', 'desktop', 'tablet'
  metadata: text('metadata'), // JSON string: { price, category, source, quantity }
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  configs: many(telegramConfigs),
  aiConfigs: many(aiConfigs),
  emailConfigs: many(emailConfigs),
  inventoryItems: many(inventoryItems),
  messages: many(telegramMessages),
  orders: many(customerOrders),
  purchases: many(purchases),
  storeConfigs: many(storeConfigs),
  analyticsEvents: many(storeAnalyticsEvents),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
  user: one(users, {
    fields: [purchases.userId],
    references: [users.id],
  }),
  customerOrder: one(customerOrders, {
    fields: [purchases.linkedCustomerOrderId],
    references: [customerOrders.id],
  }),
}));

export const aiConfigsRelations = relations(aiConfigs, ({ one }) => ({
  user: one(users, {
    fields: [aiConfigs.userId],
    references: [users.id],
  }),
}));

export const telegramConfigsRelations = relations(telegramConfigs, ({ one }) => ({
  user: one(users, {
    fields: [telegramConfigs.userId],
    references: [users.id],
  }),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  user: one(users, {
    fields: [inventoryItems.userId],
    references: [users.id],
  }),
  sourceMessages: many(telegramMessages),
}));

export const telegramMessagesRelations = relations(telegramMessages, ({ one }) => ({
  user: one(users, {
    fields: [telegramMessages.userId],
    references: [users.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [telegramMessages.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));
