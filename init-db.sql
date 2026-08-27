-- =======================================================
-- ESQUEMA Y ESTRUCTURA INICIAL PARA POSTGRESQL LOCAL
-- Base de Datos: comerxia_db
-- =======================================================

-- 1. Tabla de Usuarios Administradores y Operadores
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid TEXT UNIQUE,
  username TEXT UNIQUE,
  password TEXT NOT NULL DEFAULT 'admin',
  email TEXT NOT NULL DEFAULT 'admin@comerxia.com',
  name TEXT DEFAULT 'Administrador',
  role TEXT DEFAULT 'admin',
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  activation_code TEXT,
  activation_expires_at TIMESTAMP,
  reset_code TEXT,
  reset_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Tabla de Configuración de Telegram Bot y Proveedor
CREATE TABLE IF NOT EXISTS telegram_configs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  bot_token TEXT,
  webhook_secret TEXT,
  supplier_name TEXT DEFAULT 'Proveedor Telegram Principal',
  supplier_username TEXT,
  auto_approve BOOLEAN DEFAULT TRUE,
  default_margin_percent INTEGER DEFAULT 35,
  currency TEXT DEFAULT 'USD',
  default_stock_enabled BOOLEAN DEFAULT FALSE,
  default_stock_quantity INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Tabla de Artículos de Inventario
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  sale_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_percent INTEGER DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  video_url TEXT,
  supplier_name TEXT DEFAULT 'Proveedor Telegram Principal',
  tags TEXT,
  extracted_attributes TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  raw_telegram_message TEXT,
  marketing_copy TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Tabla de Mensajes Recibidos de Telegram
CREATE TABLE IF NOT EXISTS telegram_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  telegram_message_id TEXT,
  sender_name TEXT,
  sender_username TEXT,
  caption TEXT,
  photo_url TEXT,
  processed_status TEXT NOT NULL DEFAULT 'processed',
  extracted_data TEXT,
  inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Tabla de Directorio de Clientes (CRM)
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  ci TEXT,
  email TEXT,
  address TEXT,
  province TEXT,
  canton TEXT,
  parish TEXT,
  exact_address TEXT,
  reference TEXT,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  last_order_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Tabla de Pedidos de Clientes (Tienda Online)
CREATE TABLE IF NOT EXISTS customer_orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_ci TEXT,
  customer_address TEXT,
  items TEXT NOT NULL DEFAULT '[]',
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_method TEXT DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_voucher TEXT,
  notes TEXT,
  tracking_number TEXT,
  tracking_carrier TEXT,
  tracking_notes TEXT,
  fulfillment_status TEXT DEFAULT 'in_stock',
  linked_purchase_id INTEGER,
  linked_purchase_number TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Tabla de Compras y Abastecimiento a Proveedores
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  purchase_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL DEFAULT 'Proveedor Telegram',
  supplier_contact TEXT,
  items TEXT NOT NULL DEFAULT '[]',
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT DEFAULT 'paid',
  linked_customer_order_id INTEGER REFERENCES customer_orders(id) ON DELETE SET NULL,
  linked_customer_order_number TEXT,
  receipt_voucher TEXT,
  notes TEXT,
  purchase_date TIMESTAMP DEFAULT NOW(),
  received_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 8. Tabla de Configuración de la Tienda Online
CREATE TABLE IF NOT EXISTS store_configs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  store_name TEXT DEFAULT 'Comerxia Store',
  whatsapp_number TEXT DEFAULT '',
  description TEXT DEFAULT 'Catálogo digital con envíos y pedidos directos',
  banner_text TEXT DEFAULT '🔥 ¡Catálogo actualizado con las últimas novedades en stock!',
  delivery_fee NUMERIC(12, 2) DEFAULT 0.00,
  min_order_amount NUMERIC(12, 2) DEFAULT 0.00,
  currency TEXT DEFAULT 'USD',
  show_stock BOOLEAN DEFAULT TRUE,
  show_out_of_stock BOOLEAN DEFAULT TRUE,
  instagram_url TEXT,
  website_url TEXT,
  address TEXT,
  logo_url TEXT,
  courier_logos TEXT,
  payment_logos TEXT,
  theme TEXT DEFAULT 'classic',
  promo_popup TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 9. Tabla de Configuración de Dominios y Subdominios (Enrutamiento)
CREATE TABLE IF NOT EXISTS server_domain_configs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  admin_domain TEXT DEFAULT 'admin.dominio1.com',
  store_domain TEXT DEFAULT 'www.dominio1.com, dominio1.com',
  auto_routing BOOLEAN DEFAULT TRUE,
  default_fallback_view TEXT DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 10. Tabla de Configuración de Google Gemini AI
CREATE TABLE IF NOT EXISTS ai_configs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  api_key TEXT,
  model_name TEXT DEFAULT 'gemini-3.7-flash',
  temperature NUMERIC(3, 2) DEFAULT 0.20,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 11. Tabla de Configuración de Correo Electrónico (Gmail SMTP / Google Workspace)
CREATE TABLE IF NOT EXISTS email_configs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  google_email TEXT,
  google_app_password TEXT,
  sender_name TEXT DEFAULT 'Comerxia App',
  smtp_host TEXT DEFAULT 'smtp.gmail.com',
  smtp_port INTEGER DEFAULT 465,
  smtp_secure BOOLEAN DEFAULT TRUE,
  require_activation BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 12. Tabla de Eventos de Analítica y Tráfico de la Tienda
CREATE TABLE IF NOT EXISTS store_analytics_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  product_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
  product_name TEXT,
  session_id TEXT,
  device_type TEXT DEFAULT 'desktop',
  metadata TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices recomendados para optimización de consultas
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_order_number ON customer_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_number ON purchases(purchase_number);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON store_analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON store_analytics_events(created_at);


