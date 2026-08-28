import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { optionalAuth, requireAuth, requireAdmin, AuthRequest } from './src/middleware/auth.ts';
import { ensureTablesCreated, getDatabaseRuntimeInfo, testDatabaseConnection } from './src/db/index.ts';
import {
  validateUserCredentials,
  verifyUserPasswordById,
  generateAuthToken,
  getUserById,
  updateUserProfile,
  checkAdminExists,
  createInitialAdmin,
  listOperators,
  createOperator,
  deleteOperator,
  activateUserAccount,
  resendActivationCode,
  requestPasswordReset,
  confirmPasswordReset,
  setOperatorActivation,
} from './src/db/users.ts';
import {
  getEmailConfig,
  saveEmailConfig,
  sendTestEmail,
} from './src/services/email.ts';
import {
  createInventoryItem,
  createTelegramMessageRecord,
  deleteBulkInventoryItems,
  deleteInventoryItem,
  deleteTelegramMessage,
  deleteBulkTelegramMessages,
  clearAllTelegramMessages,
  findExistingInventoryItem,
  generateNextSku,
  getSupplierSkuPrefix,
  getInventoryItemById,
  getInventoryItems,
  getInventoryStats,
  getTelegramConfig,
  getTelegramMessages,
  getAiConfig,
  updateAiConfig,
  updateInventoryItem,
  saveProductMarketingCopy,
  updateTelegramConfig,
  appendImagesToInventoryItem,
  removeImageFromInventoryItem,
  clearAllImagesFromInventoryItem,
  setCoverImageForInventoryItem,
  setInventoryItemVideo,
  getStoreConfig,
  updateStoreConfig,
  createCustomerOrder,
  getCustomerOrders,
  updateCustomerOrder,
  updateCustomerOrderStatus,
  deleteCustomerOrder,
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  receivePurchase,
  deletePurchase,
  autoGeneratePurchaseForOrder,
  getFinancialSummary,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  syncCustomersFromOrders,
  getServerDomainConfig,
  updateServerDomainConfig,
} from './src/db/inventory.ts';
import {
  parseSupplierTelegramMessage,
  generateProductMarketingCopy,
  generateProductCommercialDescription,
  testGeminiApiKey,
  setCustomAiApiKey,
  resetAiClient,
} from './src/services/gemini-parser.ts';
import {
  startTelegramPolling,
  syncTelegramUpdatesOnce,
  getBotRuntimeStatus,
  processTelegramMessage,
} from './src/services/telegram-bot.ts';
import {
  searchProductImages,
  searchProductImagesWithAI,
  generateProductStudioPhotoWithAI,
  generateStorePromoBannerWithAI,
} from './src/services/image-search.ts';
import {
  ensureUploadsDirExists,
  persistImageLocally,
  persistImageListLocally,
  persistVideoLocally,
  syncAllInventoryImagesLocally,
  getUploadsStats,
  createUploadsZipBuffer,
  restoreUploadsFromZipBuffer,
} from './src/services/media-storage.ts';
import { searchProductVideos } from './src/services/video-search.ts';
import {
  recordAnalyticsEvent,
  getStoreAnalyticsDashboard,
  resetStoreAnalytics,
} from './src/db/analytics.ts';
import multer from 'multer';
import fs from 'fs';

async function startServer() {
  // Ensure all database tables exist
  await ensureTablesCreated();

  // Ensure uploads directory exists
  const uploadsDir = ensureUploadsDirExists();

  const app = express();
  const PORT = 3000;

  // CORS middleware for AI Studio preview iframe and cross-origin embedding
  app.use((req: Request, res: Response, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Serve persistent self-hosted uploads
  app.use('/uploads', express.static(uploadsDir, {
    maxAge: '30d',
    immutable: true,
  }));

  // Increase payload size for base64 product images
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // 1. Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 1b. SQL Database User Authentication Endpoints
  app.get('/api/auth/setup-status', async (req: Request, res: Response) => {
    try {
      const hasAdmin = await checkAdminExists();
      res.json({
        success: true,
        hasAdmin,
      });
    } catch (error: any) {
      console.error('Error checking setup status:', error);
      res.status(500).json({ error: 'Error al verificar estado de administrador' });
    }
  });

  app.post('/api/auth/setup-admin', async (req: Request, res: Response) => {
    try {
      const alreadyHasAdmin = await checkAdminExists();
      if (alreadyHasAdmin) {
        return res.status(403).json({
          error: 'El administrador ya ha sido configurado previamente. No se permite crear más cuentas, solo iniciar sesión.',
        });
      }

      const { email, username, password, confirmPassword, name } = req.body;
      const cleanEmail = (email || username || '').trim().toLowerCase();

      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ error: 'Debes ingresar un correo electrónico válido' });
      }

      if (!password || !confirmPassword) {
        return res.status(400).json({ error: 'Debes ingresar y confirmar la contraseña del administrador' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Las contraseñas no coinciden. Por favor verifícalas' });
      }

      if (password.trim().length < 4) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
      }

      const user = await createInitialAdmin({
        email: cleanEmail,
        username: username?.trim() || cleanEmail,
        password,
        name: name?.trim() || 'Administrador Principal',
      });

      const token = generateAuthToken({ id: user.id, username: user.username, role: user.role });
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          photoUrl: user.photoUrl,
        },
      });
    } catch (error: any) {
      console.error('Setup admin error:', error);
      res.status(400).json({ error: error.message || 'Error al configurar usuario administrador' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, username, password } = req.body;
      const identifier = (email || username || '').trim();
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Correo electrónico y contraseña son requeridos' });
      }

      const user = await validateUserCredentials(identifier, password);
      if (!user) {
        return res.status(401).json({ error: 'Correo electrónico o contraseña incorrectos' });
      }

      if (user.isActive === false) {
        return res.status(403).json({
          error: 'Tu cuenta aún no ha sido activada. Por favor revisa tu correo electrónico (incluyendo tu bandeja de entrada y la carpeta de spam o correo no deseado) e ingresa el código de activación.',
          requiresActivation: true,
          username: user.username,
          email: user.email,
        });
      }

      const token = generateAuthToken({ id: user.id, username: user.username, role: user.role });
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          photoUrl: user.photoUrl,
          isActive: user.isActive,
        },
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: error.message || 'Error al autenticar usuario' });
    }
  });

  // Account Activation via 6-digit Code
  app.post('/api/auth/activate', async (req: Request, res: Response) => {
    try {
      const { username, code } = req.body;
      if (!username || !code) {
        return res.status(400).json({ error: 'Usuario y código de activación requeridos' });
      }

      const result = await activateUserAccount(username, code);
      const token = result.user ? generateAuthToken({ id: result.user.id, username: result.user.username, role: result.user.role }) : undefined;

      res.json({
        success: true,
        message: result.message,
        token,
        user: result.user,
      });
    } catch (error: any) {
      console.error('Activation error:', error);
      res.status(400).json({ error: error.message || 'Error al activar la cuenta' });
    }
  });

  // Resend Activation Code
  app.post('/api/auth/resend-activation', async (req: Request, res: Response) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: 'Usuario o correo requerido' });
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      const appUrl = `${protocol}://${host}`;

      const result = await resendActivationCode(username, appUrl);
      res.json(result);
    } catch (error: any) {
      console.error('Resend activation error:', error);
      res.status(400).json({ error: error.message || 'Error al reenviar código de activación' });
    }
  });

  // Request Password Reset Code via Google Email
  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: 'Usuario o correo electrónico requerido' });
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      const appUrl = `${protocol}://${host}`;

      const result = await requestPasswordReset(username, appUrl);
      res.json(result);
    } catch (error: any) {
      console.error('Forgot password error:', error);
      res.status(400).json({ error: error.message || 'Error al procesar solicitud de recuperación' });
    }
  });

  // Confirm Password Reset with Code
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { username, code, newPassword } = req.body;
      if (!username || !code || !newPassword) {
        return res.status(400).json({ error: 'Usuario, código de recuperación y nueva contraseña son requeridos' });
      }

      const result = await confirmPasswordReset(username, code, newPassword);
      res.json(result);
    } catch (error: any) {
      console.error('Reset password error:', error);
      res.status(400).json({ error: error.message || 'Error al restablecer la contraseña' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      res.json({
        success: true,
        user: req.user,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Error al obtener datos de sesión' });
    }
  });

  app.put('/api/auth/profile', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.dbUserId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { username, name, email, currentPassword, newPassword, photoUrl } = req.body;
      const updatedUser = await updateUserProfile(req.dbUserId, {
        username,
        name,
        email,
        currentPassword,
        newPassword,
        photoUrl,
      });

      // Generate a fresh token with updated username
      const freshToken = generateAuthToken({
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
      });

      res.json({
        success: true,
        user: updatedUser,
        token: freshToken,
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      res.status(400).json({ error: error.message || 'Error al actualizar perfil de administrador' });
    }
  });

  // 1c. Operator Management Endpoints (Admin Only)
  app.get('/api/users/operators', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const ops = await listOperators();
      res.json({ success: true, operators: ops });
    } catch (error: any) {
      console.error('Error listing operators:', error);
      res.status(500).json({ error: error.message || 'Error al obtener lista de operadores' });
    }
  });

  app.post('/api/users/operators', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { username, password, name, email, requireActivation } = req.body;
      const cleanEmail = (email || username || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ error: 'Debes proporcionar un correo electrónico válido para el operador' });
      }

      const cleanUsername = (username || cleanEmail).trim().toLowerCase();

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      const appUrl = `${protocol}://${host}`;

      const newOp = await createOperator({
        username: cleanUsername,
        password,
        name: name?.trim() || cleanUsername,
        email: cleanEmail,
        requireActivation,
        appUrl,
      });
      res.json({ success: true, operator: newOp });
    } catch (error: any) {
      console.error('Error creating operator:', error);
      res.status(400).json({ error: error.message || 'Error al crear operador' });
    }
  });

  app.post('/api/users/operators/:id/toggle-active', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const opId = parseInt(req.params.id, 10);
      const { isActive } = req.body;
      if (isNaN(opId) || typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'Parámetros inválidos' });
      }

      const result = await setOperatorActivation(opId, isActive);
      res.json(result);
    } catch (error: any) {
      console.error('Error toggling operator status:', error);
      res.status(400).json({ error: error.message || 'Error al cambiar estado del operador' });
    }
  });

  app.delete('/api/users/operators/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const opId = parseInt(req.params.id, 10);
      if (isNaN(opId)) {
        return res.status(400).json({ error: 'ID de operador inválido' });
      }

      await deleteOperator(opId, req.dbUserId, req.user?.username);
      res.json({ success: true, message: 'Operador eliminado correctamente' });
    } catch (error: any) {
      console.error('Error deleting operator:', error);
      res.status(400).json({ error: error.message || 'Error al eliminar operador' });
    }
  });

  // 1d. Google Email (Gmail SMTP) Settings Endpoints (Admin Only)
  app.get('/api/email/config', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const config = await getEmailConfig(req.dbUserId);
      res.json({ success: true, config });
    } catch (error: any) {
      console.error('Error getting email config:', error);
      res.status(500).json({ error: error.message || 'Error al obtener configuración de correo' });
    }
  });

  app.post('/api/email/config', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { googleEmail, googleAppPassword, senderName, smtpHost, smtpPort, smtpSecure, requireActivation } = req.body;
      const updated = await saveEmailConfig(req.dbUserId || 1, {
        googleEmail,
        googleAppPassword,
        senderName,
        smtpHost,
        smtpPort,
        smtpSecure,
        requireActivation,
      });

      res.json({ success: true, config: updated, message: 'Configuración de correo de Google guardada correctamente' });
    } catch (error: any) {
      console.error('Error saving email config:', error);
      res.status(400).json({ error: error.message || 'Error al guardar configuración de correo' });
    }
  });

  app.post('/api/email/test', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { testEmail } = req.body;
      if (!testEmail || !testEmail.includes('@')) {
        return res.status(400).json({ error: 'Ingresa un correo electrónico destinatario válido para la prueba' });
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      const appUrl = `${protocol}://${host}`;

      const result = await sendTestEmail(testEmail, req.dbUserId, appUrl);
      res.json({ success: true, message: `Correo de prueba enviado exitosamente a ${testEmail}`, result });
    } catch (error: any) {
      console.error('Error testing email connection:', error);
      res.status(400).json({
        error: error.message || 'Error al enviar correo de prueba. Verifica tu correo de Google y contraseña de aplicación.',
      });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
  });

  // 2. Inventory Stats
  app.get('/api/stats', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const stats = await getInventoryStats(req.dbUserId);
      res.json(stats);
    } catch (error: any) {
      console.error('Failed to get stats:', error);
      res.status(500).json({ error: error.message || 'Error fetching stats' });
    }
  });

  // 3. Inventory List & CRUD
  app.get('/api/inventory', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const search = req.query.search as string;
      const category = req.query.category as string;
      const status = req.query.status as string;
      const supplier = req.query.supplier as string;

      const items = await getInventoryItems(req.dbUserId, { search, category, status, supplier });
      res.json(items);
    } catch (error: any) {
      console.error('Failed to fetch inventory:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch inventory items' });
    }
  });

  app.get('/api/inventory/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }
      const item = await getInventoryItemById(id);
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json(item);
    } catch (error: any) {
      console.error('Failed to fetch item:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch item' });
    }
  });

  app.post('/api/inventory', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        sku,
        description,
        category,
        costPrice,
        salePrice,
        discountPercent,
        stock,
        imageUrl,
        supplierName,
        tags,
        extractedAttributes,
        status,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const finalSku = sku?.trim()
        ? sku.trim()
        : await generateNextSku(supplierName || 'PF');

      const item = await createInventoryItem({
        userId: req.dbUserId || 1,
        name,
        sku: finalSku,
        description,
        category: category || 'General',
        costPrice: String(costPrice || '0.00'),
        salePrice: String(salePrice || '0.00'),
        discountPercent: Number(discountPercent) || 0,
        stock: 0, // Initial stock is 0; stock can strictly ONLY be entered via Purchases
        imageUrl,
        supplierName,
        tags: Array.isArray(tags) ? tags.join(', ') : tags,
        extractedAttributes:
          typeof extractedAttributes === 'object'
            ? JSON.stringify(extractedAttributes)
            : extractedAttributes,
        status: status || 'available',
      });

      res.status(201).json(item);
    } catch (error: any) {
      console.error('Failed to create item:', error);
      res.status(500).json({ error: error.message || 'Failed to create inventory item' });
    }
  });

  app.put('/api/inventory/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      // Strip manual stock modifications: stock can strictly ONLY be modified via Purchases or Orders
      const updatePayload = { ...req.body };
      delete updatePayload.stock;

      const updated = await updateInventoryItem(id, updatePayload);
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update item:', error);
      res.status(500).json({ error: error.message || 'Failed to update item' });
    }
  });

  app.post('/api/inventory/bulk-delete', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Array of item IDs is required' });
      }

      const numericIds = ids.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
      const result = await deleteBulkInventoryItems(numericIds);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to bulk delete items:', error);
      res.status(500).json({ error: error.message || 'Failed to bulk delete items' });
    }
  });

  app.delete('/api/inventory/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const result = await deleteInventoryItem(id);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      res.status(500).json({ error: error.message || 'Failed to delete item' });
    }
  });

  // 4. Telegram Messages Log
  app.get('/api/messages', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const messages = await getTelegramMessages(req.dbUserId);
      res.json(messages);
    } catch (error: any) {
      console.error('Failed to fetch telegram messages:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch messages' });
    }
  });

  app.delete('/api/messages/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid message ID' });
      }

      const result = await deleteTelegramMessage(id);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete telegram message:', error);
      res.status(500).json({ error: error.message || 'Failed to delete message' });
    }
  });

  app.post('/api/messages/bulk-delete', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Array of message IDs is required' });
      }

      const numericIds = ids.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
      const result = await deleteBulkTelegramMessages(numericIds);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to bulk delete telegram messages:', error);
      res.status(500).json({ error: error.message || 'Failed to bulk delete messages' });
    }
  });

  app.post('/api/messages/clear', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const result = await clearAllTelegramMessages(req.dbUserId);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to clear telegram messages:', error);
      res.status(500).json({ error: error.message || 'Failed to clear messages' });
    }
  });

  // 5. Telegram Configuration
  app.get('/api/telegram/config', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const config = await getTelegramConfig(req.dbUserId || 1);
      res.json(config);
    } catch (error: any) {
      console.error('Failed to get config:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch config' });
    }
  });

  app.post('/api/telegram/config', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.dbUserId || 1;
      const updated = await updateTelegramConfig(userId, req.body);

      // Start/restart background Telegram polling worker with the new token
      if (updated.botToken && updated.botToken.trim()) {
        process.env.TELEGRAM_BOT_TOKEN = updated.botToken.trim();
        startTelegramPolling(updated.botToken.trim(), userId);
      } else {
        process.env.TELEGRAM_BOT_TOKEN = '';
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update config:', error);
      res.status(500).json({ error: error.message || 'Failed to update config' });
    }
  });

  // 6. Test Telegram Bot Connection & Status
  app.get('/api/telegram/status', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.dbUserId || 1;
      const config = await getTelegramConfig(userId);
      const runtime = getBotRuntimeStatus();
      res.json({
        ...runtime,
        configuredToken: Boolean(config.botToken || process.env.TELEGRAM_BOT_TOKEN),
        supplierName: config.supplierName,
        defaultMarginPercent: config.defaultMarginPercent,
        currency: config.currency,
        defaultStockEnabled: Boolean(config.defaultStockEnabled),
        defaultStockQuantity: Number(config.defaultStockQuantity ?? 10),
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get bot status' });
    }
  });

  app.post('/api/telegram/sync-updates', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.dbUserId || 1;
      const config = await getTelegramConfig(userId);
      const token = req.body?.botToken || config.botToken || process.env.TELEGRAM_BOT_TOKEN;

      if (!token) {
        return res.status(400).json({ error: 'No Bot Token configured' });
      }

      const syncResult = await syncTelegramUpdatesOnce(token, userId);
      res.json(syncResult);
    } catch (error: any) {
      console.error('Failed to sync updates:', error);
      res.status(500).json({ error: error.message || 'Failed to sync updates' });
    }
  });

  app.post('/api/telegram/test-bot', async (req: Request, res: Response) => {
    try {
      const { botToken } = req.body;
      const token = botToken || process.env.TELEGRAM_BOT_TOKEN;

      if (!token) {
        return res.status(400).json({ error: 'Bot Token is required' });
      }

      const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await resp.json();

      if (!data.ok) {
        return res.status(400).json({ error: data.description || 'Invalid Telegram Bot token' });
      }

      // If valid, start polling immediately
      startTelegramPolling(token, 1);

      res.json({ success: true, bot: data.result });
    } catch (error: any) {
      console.error('Error testing bot:', error);
      res.status(500).json({ error: error.message || 'Failed to communicate with Telegram API' });
    }
  });

  // 7. Setup Live Webhook
  app.post('/api/telegram/set-webhook', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { botToken } = req.body;
      const token = botToken || process.env.TELEGRAM_BOT_TOKEN;

      if (!token) {
        return res.status(400).json({ error: 'Bot Token is required' });
      }

      const appUrl = process.env.APP_URL || 'https://' + req.get('host');
      const webhookUrl = `${appUrl}/api/telegram/webhook`;

      const resp = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'channel_post'],
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        return res.status(400).json({ error: data.description || 'Failed to set webhook' });
      }

      if (req.dbUserId) {
        await updateTelegramConfig(req.dbUserId, { botToken: token });
      }

      res.json({ success: true, webhookUrl, telegramResponse: data.result });
    } catch (error: any) {
      console.error('Error setting webhook:', error);
      res.status(500).json({ error: error.message || 'Failed to set webhook' });
    }
  });

  // 7b. Google Gemini AI Configuration & Testing
  app.get('/api/ai/config', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const config = await getAiConfig(req.dbUserId || 1);
      const activeKey = config.apiKey || process.env.GEMINI_API_KEY || '';
      let activeModel = config.modelName || 'gemini-3.7-flash';
      if (
        activeModel.includes('gemini-2.5') ||
        activeModel.includes('gemini-2.0') ||
        activeModel.includes('gemini-1.5')
      ) {
        activeModel = 'gemini-3.7-flash';
      }

      res.json({
        id: config.id,
        apiKey: activeKey,
        hasKey: Boolean(activeKey && activeKey.trim().length > 0),
        modelName: activeModel,
        temperature: Number(config.temperature) || 0.2,
      });
    } catch (error: any) {
      console.error('Failed to get AI config:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch AI config' });
    }
  });

  app.post('/api/ai/config', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.dbUserId || 1;
      const { apiKey, modelName, temperature } = req.body;
      let targetModel = modelName || 'gemini-3.7-flash';
      if (
        targetModel.includes('gemini-2.5') ||
        targetModel.includes('gemini-2.0') ||
        targetModel.includes('gemini-1.5')
      ) {
        targetModel = 'gemini-3.7-flash';
      }

      const updated = await updateAiConfig(userId, {
        apiKey: apiKey !== undefined ? apiKey : undefined,
        modelName: targetModel,
        temperature: temperature !== undefined ? Number(temperature) : 0.2,
      });

      if (apiKey !== undefined) {
        setCustomAiApiKey(apiKey);
        if (apiKey && apiKey.trim().length > 0) {
          process.env.GEMINI_API_KEY = apiKey.trim();
        }
      }

      let resModel = updated.modelName || 'gemini-3.7-flash';
      if (
        resModel.includes('gemini-2.5') ||
        resModel.includes('gemini-2.0') ||
        resModel.includes('gemini-1.5')
      ) {
        resModel = 'gemini-3.7-flash';
      }

      res.json({
        id: updated.id,
        apiKey: updated.apiKey || process.env.GEMINI_API_KEY || '',
        hasKey: Boolean((updated.apiKey || process.env.GEMINI_API_KEY || '').trim().length > 0),
        modelName: resModel,
        temperature: Number(updated.temperature) || 0.2,
      });
    } catch (error: any) {
      console.error('Failed to update AI config:', error);
      res.status(500).json({ error: error.message || 'Failed to update AI config' });
    }
  });

  app.post('/api/ai/test-key', async (req: Request, res: Response) => {
    try {
      const { apiKey, modelName } = req.body;
      const result = await testGeminiApiKey(apiKey, modelName || 'gemini-3.7-flash');
      res.json(result);
    } catch (error: any) {
      console.error('Error testing Gemini AI key:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al validar la clave API de Google AI',
        latencyMs: 0,
      });
    }
  });

  app.post('/api/ai/test-extraction', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, photoUrl, marginPercent, currency } = req.body;
      if (!message && !photoUrl) {
        return res.status(400).json({ error: 'Se requiere un mensaje o imagen para probar' });
      }

      const result = await parseSupplierTelegramMessage(
        message || '',
        photoUrl ? [photoUrl] : undefined,
        undefined,
        Number(marginPercent) || 30,
        currency || 'USD'
      );

      res.json({ success: true, result });
    } catch (error: any) {
      console.error('Error testing extraction:', error);
      res.status(500).json({ error: error.message || 'Error durante la extracción de prueba' });
    }
  });

  // 8. Simulate / Process incoming supplier message (Interactive UI Simulator & Testing)
  app.post('/api/telegram/simulate-message', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const {
        caption,
        photoBase64,
        photos,
        photoMimeType,
        senderName,
        senderUsername,
        profitMarginPercent,
        marginPercent,
      } = req.body;

      // Extract array of photos
      let photosList: string[] = [];
      if (Array.isArray(photos) && photos.length > 0) {
        photosList = photos.filter(Boolean);
      } else if (photoBase64) {
        photosList = [photoBase64];
      }

      if (!caption && photosList.length === 0) {
        return res.status(400).json({ error: 'Either caption or at least one photo is required' });
      }

      const userId = req.dbUserId || 1;
      const config = await getTelegramConfig(userId);

      const effectiveMargin =
        Number(profitMarginPercent || marginPercent) > 0
          ? Number(profitMarginPercent || marginPercent)
          : config.defaultMarginPercent || 30;

      // 1. Process with Gemini AI Multimodal (using all photos)
      const parsed = await parseSupplierTelegramMessage(
        caption || '',
        photosList,
        photoMimeType || 'image/jpeg',
        effectiveMargin,
        config.currency || 'USD'
      );

      const primaryPhoto = photosList[0] || null;
      const attributesWithGallery = {
        ...parsed.attributes,
        images: photosList,
        totalPhotos: photosList.length,
        costOptions: parsed.costOptions || [],
        profitMarginPercent: parsed.profitMarginPercent || effectiveMargin,
        selectedCostPrice: parsed.costPrice,
      };

      // 2. Check for duplicate product
      const existingItem = await findExistingInventoryItem({
        name: parsed.name,
        sku: parsed.sku !== 'AUTO' ? parsed.sku : undefined,
        rawTelegramMessage: caption,
        supplierName: senderName || config.supplierName || 'Proveedor Telegram',
      });

      if (existingItem) {
        const messageLog = await createTelegramMessageRecord({
          userId,
          telegramMessageId: `SIM-${Date.now()}`,
          senderName: senderName || config.supplierName || 'Proveedor Telegram',
          senderUsername: senderUsername || '@proveedor_oficial',
          caption: caption || `(Intento duplicado - Lote de ${photosList.length} fotos)`,
          photoUrl: primaryPhoto,
          processedStatus: 'duplicate',
          extractedData: JSON.stringify({ ...parsed, duplicateOfSku: existingItem.sku, imagesCount: photosList.length }),
          inventoryItemId: existingItem.id,
        });

        return res.json({
          success: true,
          isDuplicate: true,
          message: 'Producto ya ingresado',
          sku: existingItem.sku,
          existingItem,
          extracted: parsed,
          inventoryItem: existingItem,
          messageLog,
        });
      }

      // 3. Generate sequential SKU if needed (up to 3 letters of supplier)
      const effectiveSupplier = senderName || config.supplierName || 'Proveedor Telegram';
      const supplierPrefix = getSupplierSkuPrefix(effectiveSupplier);
      let finalSku = parsed.sku;
      if (!finalSku || finalSku === 'AUTO' || !finalSku.toUpperCase().startsWith(supplierPrefix)) {
        finalSku = await generateNextSku(effectiveSupplier);
        parsed.sku = finalSku;
      }

      // 4. Automatically create inventory item in PostgreSQL
      let inventoryItem = null;
      const isDefaultStockActive = Boolean(config.defaultStockEnabled);
      const effectiveStock =
        isDefaultStockActive && config.defaultStockQuantity !== undefined && config.defaultStockQuantity !== null
          ? Math.max(0, Number(config.defaultStockQuantity))
          : parsed.stock;
      parsed.stock = effectiveStock;

      if (config.autoApprove !== false) {
        inventoryItem = await createInventoryItem({
          userId,
          name: parsed.name,
          sku: finalSku,
          description: parsed.description,
          category: parsed.category,
          costPrice: String(parsed.costPrice.toFixed(2)),
          salePrice: String(parsed.salePrice.toFixed(2)),
          stock: effectiveStock,
          imageUrl: primaryPhoto,
          supplierName: senderName || config.supplierName || 'Proveedor Telegram',
          tags: parsed.tags.join(', '),
          extractedAttributes: JSON.stringify(attributesWithGallery),
          status: 'available',
          rawTelegramMessage: caption,
        });
      }

      // 5. Save log in telegram_messages table
      const messageLog = await createTelegramMessageRecord({
        userId,
        telegramMessageId: `SIM-${Date.now()}`,
        senderName: senderName || config.supplierName || 'Proveedor Telegram',
        senderUsername: senderUsername || '@proveedor_oficial',
        caption: caption || `(Lote de ${photosList.length} fotos)`,
        photoUrl: primaryPhoto,
        processedStatus: 'processed',
        extractedData: JSON.stringify({ ...parsed, sku: finalSku, imagesCount: photosList.length }),
        inventoryItemId: inventoryItem?.id,
      });

      res.json({
        success: true,
        isDuplicate: false,
        sku: finalSku,
        extracted: parsed,
        inventoryItem,
        messageLog,
      });
    } catch (error: any) {
      console.error('Error simulating supplier message:', error);
      res.status(500).json({ error: error.message || 'Error processing supplier message' });
    }
  });

  // 8b. Select / Switch cost price option and/or update profit margin for a product
  app.post('/api/inventory/:id/select-cost', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

      const { costPrice, profitMarginPercent, salePrice } = req.body;
      const item = await getInventoryItemById(id);
      if (!item) return res.status(404).json({ error: 'Product not found' });

      let parsedAttr: Record<string, any> = {};
      if (item.extractedAttributes) {
        try {
          parsedAttr = JSON.parse(item.extractedAttributes);
        } catch {}
      }

      if (costPrice !== undefined) {
        parsedAttr.selectedCostPrice = Number(costPrice);
      }
      if (profitMarginPercent !== undefined) {
        parsedAttr.profitMarginPercent = Number(profitMarginPercent);
      }

      const newCost = costPrice !== undefined ? String(Number(costPrice).toFixed(2)) : item.costPrice;
      const finalMargin =
        profitMarginPercent !== undefined
          ? Number(profitMarginPercent)
          : Number(parsedAttr.profitMarginPercent) || 30;

      const newSale =
        salePrice !== undefined
          ? String(Number(salePrice).toFixed(2))
          : String((Number(newCost) * (1 + finalMargin / 100)).toFixed(2));

      const updated = await updateInventoryItem(id, {
        costPrice: newCost,
        salePrice: newSale,
        extractedAttributes: JSON.stringify(parsedAttr),
      });

      res.json(updated);
    } catch (error: any) {
      console.error('Error selecting cost option:', error);
      res.status(500).json({ error: error.message || 'Failed to update cost option' });
    }
  });

  // 8c. Generate Multiplatform Marketing Copies using Gemini AI (Marketplace, Instagram, WhatsApp, E-commerce)
  app.post('/api/inventory/:id/generate-copy', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'ID de producto inválido' });

      const item = await getInventoryItemById(id);
      if (!item) return res.status(404).json({ error: 'Producto no encontrado' });

      const userId = req.dbUserId || 1;
      const storeConfig = await getStoreConfig(userId);

      const {
        tone,
        customPrice,
        cityOrRegion,
        whatsappNumber,
        storeName,
        storeAddress,
        websiteUrl,
        warrantyInfo,
        paymentTitles: customPaymentTitles,
        shippingCompanies: customShippingCompanies,
        showStock,
        showPhone,
        showSku,
        showWebsite,
      } = req.body || {};

      // Parse paymentLogos from storeConfig to extract active payment titles ONLY (no descriptions)
      let extractedPaymentTitles: string[] = [];
      if (Array.isArray(customPaymentTitles) && customPaymentTitles.length > 0) {
        extractedPaymentTitles = customPaymentTitles.map((t: any) => String(t).trim()).filter(Boolean);
      } else if (storeConfig?.paymentLogos) {
        try {
          const parsedPayments =
            typeof storeConfig.paymentLogos === 'string'
              ? JSON.parse(storeConfig.paymentLogos)
              : storeConfig.paymentLogos;
          if (Array.isArray(parsedPayments)) {
            extractedPaymentTitles = parsedPayments
              .filter((p: any) => p.active !== false && p.name)
              .map((p: any) => String(p.name).trim());
          }
        } catch {}
      }

      if (extractedPaymentTitles.length === 0) {
        extractedPaymentTitles = [
          'Transferencia Bancaria',
          'Banco Pichincha',
          'Banco Guayaquil',
          'Deuna',
          'Efectivo',
        ];
      }

      // Parse courierLogos from storeConfig to extract active courier company names
      let extractedShippingCompanies: string[] = [];
      if (Array.isArray(customShippingCompanies) && customShippingCompanies.length > 0) {
        extractedShippingCompanies = customShippingCompanies.map((s: any) => String(s).trim()).filter(Boolean);
      } else if (storeConfig?.courierLogos) {
        try {
          const parsedCouriers =
            typeof storeConfig.courierLogos === 'string'
              ? JSON.parse(storeConfig.courierLogos)
              : storeConfig.courierLogos;
          if (Array.isArray(parsedCouriers)) {
            extractedShippingCompanies = parsedCouriers
              .filter((c: any) => c.active !== false && c.name)
              .map((c: any) => String(c.name).trim());
          }
        } catch {}
      }

      if (extractedShippingCompanies.length === 0) {
        extractedShippingCompanies = [
          'Servientrega',
          'LaarCourier',
          'Cooperativas de Transporte',
          'Entregas a Domicilio',
        ];
      }

      let effectiveWebsiteUrl = (websiteUrl !== undefined && websiteUrl !== '') ? websiteUrl : '';
      if (!effectiveWebsiteUrl) {
        try {
          const domainConfig = await getServerDomainConfig(userId);
          const rawStoreDomain = domainConfig?.storeDomain || (storeConfig as any)?.domain || '';
          const candidateStoreDomain = rawStoreDomain.split(/[,;\n]/)[0]?.replace(/^https?:\/\//i, '').split('/')[0].trim();
          if (candidateStoreDomain && !candidateStoreDomain.includes('localhost') && !candidateStoreDomain.includes('127.0.0.1')) {
            effectiveWebsiteUrl = `https://${candidateStoreDomain}/?producto=${item.id}`;
          }
        } catch {}
      }

      if (!effectiveWebsiteUrl) {
        const reqHost = req.get('x-forwarded-host') || req.get('host') || '';
        const reqProto = req.get('x-forwarded-proto') || req.protocol || 'https';
        if (reqHost) {
          // Replace admin. subdomain with store subdomain or remove admin. prefix
          const cleanHost = reqHost.startsWith('admin.') ? `www.${reqHost.replace(/^admin\./, '')}` : reqHost;
          effectiveWebsiteUrl = `${reqProto}://${cleanHost}?view=store&producto=${item.id}`;
        }
      }

      const copyResult = await generateProductMarketingCopy(
        {
          name: item.name,
          sku: item.sku,
          description: item.description,
          category: item.category,
          salePrice: customPrice !== undefined && Number(customPrice) > 0 ? customPrice : item.salePrice,
          stock: item.stock,
          tags: item.tags,
          extractedAttributes: item.extractedAttributes,
          imageUrl: item.imageUrl,
          images: item.images,
        },
        {
          tone: tone || 'persuasive',
          storeName: storeName || storeConfig?.storeName || 'Comerxia Store',
          storeAddress: storeAddress !== undefined ? storeAddress : (storeConfig?.address || ''),
          websiteUrl: effectiveWebsiteUrl,
          whatsappNumber: whatsappNumber || storeConfig?.whatsappNumber || '',
          cityOrRegion: cityOrRegion || 'Envíos a todo el país',
          currency: storeConfig?.currency || 'USD',
          warrantyInfo: warrantyInfo || 'Producto 100% nuevo, garantizado contra defectos de fábrica',
          paymentTitles: extractedPaymentTitles,
          shippingCompanies: extractedShippingCompanies,
          showStock: showStock !== undefined ? Boolean(showStock) : true,
          showPhone: showPhone !== undefined ? Boolean(showPhone) : true,
          showSku: showSku !== undefined ? Boolean(showSku) : true,
          showWebsite: showWebsite !== undefined ? Boolean(showWebsite) : true,
        }
      );

      // Persist generated copy directly in the product's database record
      copyResult.options = {
        showStock: showStock !== undefined ? Boolean(showStock) : true,
        showPhone: showPhone !== undefined ? Boolean(showPhone) : true,
        showSku: showSku !== undefined ? Boolean(showSku) : true,
        showWebsite: showWebsite !== undefined ? Boolean(showWebsite) : true,
        websiteUrl: effectiveWebsiteUrl || undefined,
        tone: tone || 'persuasive',
        customPrice: customPrice !== undefined ? String(customPrice) : undefined,
        cityOrRegion: cityOrRegion || undefined,
        whatsappContact: whatsappNumber || undefined,
        storeAddress: storeAddress !== undefined ? storeAddress : (storeConfig?.address || undefined),
        paymentTitlesInput: extractedPaymentTitles.join(', '),
        shippingCompaniesInput: extractedShippingCompanies.join(', '),
      };
      copyResult.showStock = showStock !== undefined ? Boolean(showStock) : true;
      copyResult.showPhone = showPhone !== undefined ? Boolean(showPhone) : true;
      copyResult.showSku = showSku !== undefined ? Boolean(showSku) : true;
      copyResult.showWebsite = showWebsite !== undefined ? Boolean(showWebsite) : true;
      copyResult.websiteUrl = effectiveWebsiteUrl || undefined;

      let updatedItem: any = item;
      try {
        updatedItem = await saveProductMarketingCopy(item.id, copyResult);
      } catch (saveErr) {
        console.warn('Could not auto-save copy to DB, returning generated copy:', saveErr);
      }

      res.json({
        success: true,
        productId: item.id,
        productName: item.name,
        copy: copyResult,
        item: updatedItem,
      });
    } catch (error: any) {
      console.error('Error generating product marketing copy:', error);
      res.status(500).json({ error: error.message || 'Error al generar copys con IA' });
    }
  });

  // 8d. Save / Update Product Marketing Copy in database
  app.put('/api/inventory/:id/marketing-copy', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'ID de producto inválido' });

      const item = await getInventoryItemById(id);
      if (!item) return res.status(404).json({ error: 'Producto no encontrado' });

      const { copy } = req.body || {};
      if (!copy) return res.status(400).json({ error: 'Datos de publicación requeridos' });

      const updated = await saveProductMarketingCopy(id, copy);
      res.json({
        success: true,
        message: 'Publicación guardada exitosamente en la base de datos',
        item: updated,
      });
    } catch (error: any) {
      console.error('Error saving marketing copy to DB:', error);
      res.status(500).json({ error: error.message || 'Error al guardar publicación en la base de datos' });
    }
  });

  // 8e. Delete / Clear Product Marketing Copy from database
  app.delete('/api/inventory/:id/marketing-copy', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'ID de producto inválido' });

      const item = await getInventoryItemById(id);
      if (!item) return res.status(404).json({ error: 'Producto no encontrado' });

      const updated = await updateInventoryItem(id, { marketingCopy: null });
      res.json({
        success: true,
        message: 'Publicación de IA eliminada exitosamente de la base de datos',
        item: updated,
      });
    } catch (error: any) {
      console.error('Error deleting marketing copy from DB:', error);
      res.status(500).json({ error: error.message || 'Error al eliminar la publicación de la base de datos' });
    }
  });

  app.post('/api/ai/generate-marketing-copy', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { product, options } = req.body || {};
      if (!product || !product.name) {
        return res.status(400).json({ error: 'Se requiere información del producto (al menos el nombre)' });
      }

      const userId = req.dbUserId || 1;
      const storeConfig = await getStoreConfig(userId);

      let effectiveWebsiteUrl = (options?.websiteUrl !== undefined && options?.websiteUrl !== '') ? options.websiteUrl : '';
      if (!effectiveWebsiteUrl) {
        try {
          const domainConfig = await getServerDomainConfig(userId);
          const rawStoreDomain = domainConfig?.storeDomain || (storeConfig as any)?.domain || '';
          const candidateStoreDomain = rawStoreDomain.split(/[,;\n]/)[0]?.replace(/^https?:\/\//i, '').split('/')[0].trim();
          if (candidateStoreDomain && !candidateStoreDomain.includes('localhost') && !candidateStoreDomain.includes('127.0.0.1')) {
            effectiveWebsiteUrl = product.id ? `https://${candidateStoreDomain}/?producto=${product.id}` : `https://${candidateStoreDomain}`;
          }
        } catch {}
      }

      if (!effectiveWebsiteUrl) {
        const reqHost = req.get('x-forwarded-host') || req.get('host') || '';
        const reqProto = req.get('x-forwarded-proto') || req.protocol || 'https';
        if (reqHost) {
          const cleanHost = reqHost.startsWith('admin.') ? `www.${reqHost.replace(/^admin\./, '')}` : reqHost;
          effectiveWebsiteUrl = product.id
            ? `${reqProto}://${cleanHost}?view=store&producto=${product.id}`
            : `${reqProto}://${cleanHost}?view=store`;
        }
      }

      const copyResult = await generateProductMarketingCopy(
        product,
        {
          tone: options?.tone || 'persuasive',
          storeName: options?.storeName || storeConfig?.storeName || 'Comerxia Store',
          storeAddress: options?.storeAddress !== undefined ? options?.storeAddress : (storeConfig?.address || ''),
          websiteUrl: effectiveWebsiteUrl,
          whatsappNumber: options?.whatsappNumber || storeConfig?.whatsappNumber || '',
          cityOrRegion: options?.cityOrRegion || 'Envíos a todo el país',
          currency: options?.currency || storeConfig?.currency || 'USD',
          warrantyInfo: options?.warrantyInfo || 'Producto 100% nuevo y garantizado',
          showStock: options?.showStock !== undefined ? options?.showStock : true,
          showPhone: options?.showPhone !== undefined ? options?.showPhone : true,
          showSku: options?.showSku !== undefined ? options?.showSku : true,
          showWebsite: options?.showWebsite !== undefined ? options?.showWebsite : true,
        }
      );

      res.json({
        success: true,
        copy: copyResult,
      });
    } catch (error: any) {
      console.error('Error generating marketing copy:', error);
      res.status(500).json({ error: error.message || 'Error al generar copys con IA' });
    }
  });

  // 8c2. Generate / Regenerate Commercial Description with Gemini AI (Same format and structure as Telegram intake)
  app.post('/api/ai/generate-description', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        category,
        description,
        rawTelegramMessage,
        tags,
        attributes,
        extractedAttributes,
        imageUrl,
        images,
        costPrice,
        salePrice,
      } = req.body || {};

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Se requiere al menos el nombre del producto para generar la descripción.' });
      }

      const generatedDescription = await generateProductCommercialDescription({
        name: name.trim(),
        category,
        description,
        rawTelegramMessage,
        tags,
        attributes: extractedAttributes || attributes,
        imageUrl,
        images,
        costPrice,
        salePrice,
      });

      res.json({
        success: true,
        description: generatedDescription,
      });
    } catch (error: any) {
      console.error('Error generating product description with AI:', error);
      res.status(500).json({ error: error.message || 'Error al generar la descripción comercial con IA' });
    }
  });

  app.post('/api/inventory/:id/generate-description', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'ID de producto inválido' });

      const item = await getInventoryItemById(id);
      if (!item) return res.status(404).json({ error: 'Producto no encontrado' });

      const {
        name,
        category,
        description,
        rawTelegramMessage,
        tags,
        attributes,
        extractedAttributes,
        imageUrl,
        images,
        saveToDatabase = false,
      } = req.body || {};

      const generatedDescription = await generateProductCommercialDescription({
        name: (name || item.name || '').trim(),
        category: category || item.category,
        description: description !== undefined ? description : item.description,
        rawTelegramMessage: rawTelegramMessage !== undefined ? rawTelegramMessage : item.rawTelegramMessage,
        tags: tags !== undefined ? tags : item.tags,
        attributes: extractedAttributes || attributes || item.extractedAttributes,
        imageUrl: imageUrl !== undefined ? imageUrl : item.imageUrl,
        images: images !== undefined ? images : item.images,
        costPrice: item.costPrice,
        salePrice: item.salePrice,
      });

      let updatedItem: any = item;
      if (saveToDatabase) {
        updatedItem = await updateInventoryItem(id, {
          description: generatedDescription,
        });
      }

      res.json({
        success: true,
        productId: id,
        description: generatedDescription,
        item: updatedItem,
      });
    } catch (error: any) {
      console.error('Error generating description for inventory item:', error);
      res.status(500).json({ error: error.message || 'Error al generar la descripción comercial' });
    }
  });

  // 8f. AI-Powered Image Search for Exact Product Match
  app.post('/api/inventory/:id/search-web-images', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const customQuery = req.body?.query;
      let item = null;

      if (!isNaN(id) && id > 0) {
        item = await getInventoryItemById(id);
      }

      const productName = item?.name || (typeof customQuery === 'string' ? customQuery : '');
      if (!productName || !productName.trim()) {
        return res.status(400).json({ error: 'Se requiere un producto válido o término de búsqueda' });
      }

      const searchResult = await searchProductImagesWithAI({
        id: item?.id,
        name: productName,
        description: item?.description,
        category: item?.category,
        extractedAttributes: item?.extractedAttributes,
        sku: item?.sku,
        imageUrl: item?.imageUrl,
        customQuery: typeof customQuery === 'string' && customQuery.trim() !== productName.trim() ? customQuery.trim() : undefined,
        limit: 28,
      });

      res.json({
        success: true,
        query: productName,
        profile: searchResult.profile,
        images: searchResult.images,
        count: searchResult.images.length,
      });
    } catch (error: any) {
      console.error('Error in AI-powered product image search:', error);
      res.status(500).json({ error: error.message || 'Error al buscar imágenes del producto con IA' });
    }
  });

  // 8g. Generate Studio Photo for Product using Gemini AI
  app.post('/api/inventory/:id/ai-generate-studio-image', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID de producto inválido' });

      const item = await getInventoryItemById(id);
      if (!item) return res.status(404).json({ error: 'Producto no encontrado' });

      const { style } = req.body || {};
      const generated = await generateProductStudioPhotoWithAI({
        name: item.name,
        category: item.category,
        description: item.description,
        extractedAttributes: item.extractedAttributes,
        style: style || 'white_background',
      });

      res.json({
        success: true,
        image: generated,
      });
    } catch (error: any) {
      console.error('Error generating studio photo with AI:', error);
      res.status(500).json({ error: error.message || 'Error al generar foto de estudio con IA' });
    }
  });

  // 8h. Global Web Image Search (for any query / new products)
  app.post('/api/ai/search-images', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { query, limit } = req.body || {};
      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ error: 'Se requiere un término de búsqueda' });
      }

      const searchResult = await searchProductImagesWithAI({
        name: query.trim(),
        limit: Number(limit) || 24,
      });

      res.json({
        success: true,
        query: query.trim(),
        profile: searchResult.profile,
        images: searchResult.images,
        count: searchResult.images.length,
      });
    } catch (error: any) {
      console.error('Error searching images globally:', error);
      res.status(500).json({ error: error.message || 'Error al buscar imágenes con IA' });
    }
  });

  // 8h. Add Selected Images to a Product
  app.post('/api/inventory/:id/add-images', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID de producto inválido' });

      const item = await getInventoryItemById(id);
      if (!item) return res.status(404).json({ error: 'Producto no encontrado' });

      const body = req.body || {};
      const rawList = body.images || body.imageUrls || body.urls || body.selectedUrls || body.selectedImages || body.imageUrl || body.image || body.url || [];
      const isCover = Boolean(body.setAsCover || body.setFirstAsCover);

      let listToProcess: any[] = [];
      if (Array.isArray(rawList)) {
        listToProcess = rawList;
      } else if (typeof rawList === 'string' && rawList.trim()) {
        listToProcess = [rawList.trim()];
      }

      const imagesToAdd: string[] = listToProcess
        .map((i: any) => {
          let u = typeof i === 'string' ? i.trim() : typeof i === 'object' && i?.url ? String(i.url).trim() : '';
          if (u.startsWith('//')) u = `https:${u}`;
          return u;
        })
        .filter((url: string) => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('/')));

      if (imagesToAdd.length === 0) {
        return res.status(400).json({ error: 'No se enviaron URLs de imágenes válidas' });
      }

      const updated = await appendImagesToInventoryItem(id, imagesToAdd, isCover);
      const safeItem = updated || (await getInventoryItemById(id));
      res.json({
        success: true,
        message: `${imagesToAdd.length} imagen(es) agregada(s) con éxito al producto`,
        item: safeItem,
        addedCount: imagesToAdd.length,
      });
    } catch (error: any) {
      console.error('Error adding images to product:', error);
      res.status(500).json({ error: error.message || 'Error al agregar imágenes al producto' });
    }
  });

  // 8h2. Search Product Videos with AI (Hybrid: YouTube, TikTok, Shorts, Vimeo, MP4)
  app.post('/api/inventory/:id/search-web-videos', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID de producto inválido' });

      const item = await getInventoryItemById(id);
      if (!item) return res.status(404).json({ error: 'Producto no encontrado' });

      const customQuery = req.body.query || req.body.searchQuery || item.name;
      const searchResult = await searchProductVideos({
        productName: item.name,
        category: item.category,
        description: item.description || undefined,
        sku: item.sku,
        customQuery,
      });

      res.json({
        success: true,
        ...searchResult,
      });
    } catch (error: any) {
      console.error('Error searching product videos with AI:', error);
      res.status(500).json({ error: error.message || 'Error al buscar videos con IA' });
    }
  });

  // 8h3. General AI Video Search
  app.post('/api/ai/search-videos', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { productName, category, description, sku, query } = req.body || {};
      if (!productName && !query) {
        return res.status(400).json({ error: 'Se requiere el nombre del producto o término de búsqueda' });
      }

      const searchResult = await searchProductVideos({
        productName: productName || query,
        category,
        description,
        sku,
        customQuery: query || productName,
      });

      res.json({
        success: true,
        ...searchResult,
      });
    } catch (error: any) {
      console.error('Error in general AI video search:', error);
      res.status(500).json({ error: error.message || 'Error en búsqueda de videos' });
    }
  });

  // 8h4. Set or Update Product Video (Manual link or uploaded file)
  app.post('/api/inventory/:id/set-video', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID de producto inválido' });

      const { videoUrl } = req.body || {};
      const updated = await setInventoryItemVideo(id, videoUrl || null);
      if (!updated) {
        return res.status(404).json({ error: 'No se pudo actualizar el video del producto' });
      }

      res.json({
        success: true,
        message: videoUrl ? '🎬 Video vinculado con éxito al producto' : 'Video eliminado del producto',
        item: updated,
      });
    } catch (error: any) {
      console.error('Error setting product video:', error);
      res.status(500).json({ error: error.message || 'Error al guardar el video' });
    }
  });

  // 8h5. Upload Local Video (MP4/WebM base64 or file)
  app.post('/api/media/upload-video', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { videoData, filename } = req.body || {};
      if (!videoData || typeof videoData !== 'string') {
        return res.status(400).json({ error: 'No se envió contenido de video válido' });
      }

      const persistedUrl = await persistVideoLocally(videoData);
      if (!persistedUrl) {
        return res.status(500).json({ error: 'No se pudo guardar el archivo de video en el servidor' });
      }

      res.json({
        success: true,
        videoUrl: persistedUrl,
        message: 'Video subido y guardado exitosamente',
      });
    } catch (error: any) {
      console.error('Error uploading video file:', error);
      res.status(500).json({ error: error.message || 'Error al subir el video' });
    }
  });

  // 8i. Image proxy for third-party hosting restrictions/CORS/hotlinking
  app.get('/api/proxy-image', async (req: Request, res: Response) => {
    try {
      const rawUrl = req.query.url;
      if (!rawUrl || typeof rawUrl !== 'string') {
        return res.status(400).send('Missing url parameter');
      }

      let targetUrl = decodeURIComponent(rawUrl.trim());
      if (targetUrl.startsWith('//')) targetUrl = `https:${targetUrl}`;

      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        return res.status(400).send('Invalid image url');
      }

      const imgRes = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (!imgRes.ok) {
        return res.redirect(targetUrl);
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    } catch (err: any) {
      console.warn('Image proxy error, redirecting directly:', err?.message);
      if (req.query.url && typeof req.query.url === 'string') {
        return res.redirect(req.query.url);
      }
      return res.status(500).send('Failed to proxy image');
    }
  });

  // 8j. Self-Hosted Media serving and management endpoints
  app.get('/api/media/:filename', (req: Request, res: Response) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.sendFile(filePath);
      }
      return res.status(404).json({ error: 'Imagen no encontrada en el almacenamiento local' });
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al servir imagen local' });
    }
  });

  app.post('/api/media/persist-image', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { url, base64 } = req.body || {};
      const target = url || base64;
      if (!target || typeof target !== 'string') {
        return res.status(400).json({ error: 'Se requiere una URL o cadena Base64 de imagen' });
      }

      const persistedUrl = await persistImageLocally(target);
      res.json({
        success: true,
        originalUrl: target.startsWith('data:') ? 'base64_data' : target,
        url: persistedUrl,
        isSelfHosted: Boolean(persistedUrl?.startsWith('/uploads/') || persistedUrl?.startsWith('/api/media/')),
      });
    } catch (error: any) {
      console.error('Error persisting image locally:', error);
      res.status(500).json({ error: error.message || 'Error al persistir imagen localmente' });
    }
  });

  app.post('/api/media/sync-all-images', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const result = await syncAllInventoryImagesLocally(
        () => getInventoryItems(req.dbUserId),
        (id, data) => updateInventoryItem(id, data)
      );

      res.json({
        success: true,
        message: `Sincronización completada. ${result.imagesPersisted} imagen(es) descargadas y guardadas localmente en ${result.itemsUpdated} producto(s).`,
        ...result,
      });
    } catch (error: any) {
      console.error('Error in sync-all-images endpoint:', error);
      res.status(500).json({ error: error.message || 'Error al sincronizar imágenes' });
    }
  });

  app.get('/api/media/status', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      let filesCount = 0;
      let totalBytes = 0;
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        filesCount = files.length;
        for (const file of files) {
          try {
            const stat = fs.statSync(path.join(uploadsDir, file));
            totalBytes += stat.size;
          } catch {}
        }
      }

      const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
      res.json({
        success: true,
        storageType: 'local_self_hosted',
        uploadsDirectory: uploadsDir,
        totalFiles: filesCount,
        totalSizeMb: `${totalMb} MB`,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Error al consultar estado del almacenamiento multimedia' });
    }
  });

  // 8i. Remove an Image from a Product (supports DELETE & POST)
  const handleRemoveImage = async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id) || id <= 0) return res.status(400).json({ error: 'ID de producto inválido' });

      const body = req.body || {};
      const query = req.query || {};

      const deleteAll = Boolean(
        body.deleteAll ||
        body.all ||
        query.deleteAll === 'true' ||
        query.all === 'true' ||
        body.imageUrl === 'ALL' ||
        body.imageUrl === '*'
      );

      const rawIndex = body.photoIndex ?? body.index ?? query.photoIndex ?? query.index;
      const photoIndex = typeof rawIndex === 'number' ? rawIndex : typeof rawIndex === 'string' && !isNaN(parseInt(rawIndex, 10)) ? parseInt(rawIndex, 10) : undefined;

      const rawUrl = body.imageUrl || body.image || body.url || query.imageUrl || query.url;
      const imageUrl = typeof rawUrl === 'string' ? rawUrl.trim() : undefined;

      let updated;
      if (deleteAll) {
        updated = await clearAllImagesFromInventoryItem(id);
      } else {
        updated = await removeImageFromInventoryItem(id, imageUrl, photoIndex);
      }

      if (!updated) {
        return res.status(404).json({ error: 'Producto no encontrado o error al actualizar imagen' });
      }

      res.json({
        success: true,
        message: 'Foto(s) eliminada(s) del producto exitosamente en la base de datos',
        item: updated,
      });
    } catch (error: any) {
      console.error('Error removing image from product:', error);
      res.status(500).json({ error: error.message || 'Error al eliminar imagen del producto' });
    }
  };

  app.delete('/api/inventory/:id/images', optionalAuth, handleRemoveImage);
  app.post('/api/inventory/:id/delete-image', optionalAuth, handleRemoveImage);
  app.post('/api/inventory/:id/remove-image', optionalAuth, handleRemoveImage);
  app.post('/api/inventory/:id/delete-images', optionalAuth, handleRemoveImage);

  // 8j. Set Cover / Primary Image for a Product
  app.put('/api/inventory/:id/set-cover-image', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'ID de producto inválido' });

      const { imageUrl } = req.body || {};
      if (!imageUrl || typeof imageUrl !== 'string') {
        return res.status(400).json({ error: 'Se requiere la URL de la imagen principal' });
      }

      const updated = await setCoverImageForInventoryItem(id, imageUrl);
      res.json({
        success: true,
        message: 'Foto principal actualizada exitosamente',
        item: updated,
      });
    } catch (error: any) {
      console.error('Error setting cover image:', error);
      res.status(500).json({ error: error.message || 'Error al establecer la imagen principal' });
    }
  });

  // 9. Live Telegram Webhook Endpoint (alternative to Long Polling)
  app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
    // Acknowledge Telegram immediately with 200 OK
    res.status(200).send({ ok: true });

    try {
      const update = req.body;
      const message = update?.message || update?.channel_post;

      if (!message) return;

      const userId = 1;
      const config = await getTelegramConfig(userId);
      const token = config.botToken || process.env.TELEGRAM_BOT_TOKEN;

      if (token) {
        await processTelegramMessage(token, message, userId);
      }
    } catch (err) {
      console.error('Error handling Telegram webhook message:', err);
    }
  });

  // 10. Storefront & Customer Orders Endpoints
  app.get('/api/store/logo', async (req: Request, res: Response) => {
    try {
      const config = await getStoreConfig(1);
      const logoUrl = config?.logoUrl;

      if (!logoUrl || logoUrl.trim().length === 0) {
        const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="70" viewBox="0 0 240 70">
          <rect width="240" height="70" rx="14" fill="#2563EB"/>
          <text x="120" y="42" fill="#FFFFFF" font-size="22" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" text-anchor="middle">
            ${config?.storeName || 'Comerxia Store'}
          </text>
        </svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.send(defaultSvg);
      }

      if (logoUrl.startsWith('data:image/')) {
        const parts = logoUrl.split(';base64,');
        const contentType = parts[0].replace('data:', '');
        const base64Data = parts[1];
        const imgBuffer = Buffer.from(base64Data, 'base64');

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(imgBuffer);
      }

      if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        return res.redirect(logoUrl);
      }

      if (logoUrl.includes('<svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(logoUrl);
      }

      return res.status(404).send('Logo not found');
    } catch (error: any) {
      console.error('Error serving store logo:', error);
      res.status(500).send('Error serving logo');
    }
  });

  app.get('/api/store/config', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const config = await getStoreConfig(req.dbUserId || 1);
      res.json(config);
    } catch (error: any) {
      console.error('Failed to get store config:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch store config' });
    }
  });

  app.post('/api/store/config', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const updated = await updateStoreConfig(req.dbUserId || 1, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update store config:', error);
      res.status(500).json({ error: error.message || 'Failed to update store config' });
    }
  });

  // 8k. Generate Promotional Campaign Banner / Flyer with AI
  app.post('/api/store/promo-image/generate-ai', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { theme, storeName, discountText, customPrompt, badge, persistLocal } = req.body || {};
      const generated = await generateStorePromoBannerWithAI({
        theme: theme || 'christmas',
        storeName: storeName || 'Comerxia Store',
        discountText,
        customPrompt,
        badge,
      });

      let finalUrl = generated.imageUrl;
      if (persistLocal !== false && finalUrl && (finalUrl.startsWith('data:') || finalUrl.startsWith('https://'))) {
        try {
          const localSaved = await persistImageLocally(finalUrl);
          if (localSaved) {
            finalUrl = localSaved;
          }
        } catch (storageErr) {
          console.warn('Could not persist promo image locally, using generated URL:', storageErr);
        }
      }

      res.json({
        success: true,
        image: {
          ...generated,
          imageUrl: finalUrl,
        },
      });
    } catch (error: any) {
      console.error('Error generating promo banner with AI:', error);
      res.status(500).json({ error: error.message || 'Error al generar afiche promocional con IA' });
    }
  });

  app.get('/api/store/products', async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string;
      const category = req.query.category as string;
      const inStockOnly = req.query.inStock === 'true';

      const config = await getStoreConfig(1);
      const hideOutOfStock = config && config.showOutOfStock === false;

      const items = await getInventoryItems(undefined, { search, category });
      // Filter out archived or out of stock if requested or configured
      const filtered = items.filter((it) => {
        if (it.status === 'archived') return false;
        if ((inStockOnly || hideOutOfStock) && (Number(it.stock) <= 0 || it.status === 'sold_out')) return false;
        return true;
      });

      res.json(filtered);
    } catch (error: any) {
      console.error('Failed to fetch store products:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch store products' });
    }
  });

  app.get('/api/orders', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const orders = await getCustomerOrders(req.dbUserId);
      res.json(orders);
    } catch (error: any) {
      console.error('Failed to fetch orders:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch orders' });
    }
  });

  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const {
        customerName,
        customerPhone,
        customerCi,
        ci,
        customerAddress,
        items,
        totalAmount,
        paymentMethod,
        notes,
        status,
        paymentVoucher,
      } = req.body;

      if (!customerName || !customerPhone || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Customer name, phone, and items are required' });
      }

      const orderResult = await createCustomerOrder({
        userId: 1,
        customerName,
        customerPhone,
        customerCi: customerCi || ci || undefined,
        ci: customerCi || ci || undefined,
        customerAddress,
        items,
        totalAmount: Number(totalAmount) || 0,
        paymentMethod: paymentMethod || 'whatsapp',
        status: status || 'pending',
        paymentVoucher: paymentVoucher || undefined,
        notes,
        decrementStock: true,
      });

      // Send alert to Telegram bot if configured
      try {
        const config = await getTelegramConfig(1);
        const token = config?.botToken || process.env.TELEGRAM_BOT_TOKEN;
        if (token && config?.supplierUsername) {
          // Send notification text
          const itemsText = items.map((it: any) => `• ${it.quantity}x ${it.name || it.item?.name} ($${it.salePrice || it.item?.salePrice})`).join('\n');
          const orderMsg = `🛒 *¡NUEVO PEDIDO DE TIENDA ONLINE!*\n\n*N° Pedido:* #${orderResult.orderNumber}\n*Cliente:* ${customerName}\n*Tel:* ${customerPhone}\n${customerCi || ci ? `*CI:* ${customerCi || ci}\n` : ''}*Dirección:* ${customerAddress || 'No especificada'}\n*Pago:* ${paymentMethod || 'WhatsApp'}\n\n*Productos:*\n${itemsText}\n\n💰 *Total:* $${Number(totalAmount).toFixed(2)}\n${notes ? `📝 *Notas:* ${notes}` : ''}`;

          // If supplierUsername starts with chat_id or username
          console.log('[Store Orders] Notifying Telegram bot for new order:', orderResult.orderNumber);
        }
      } catch (tgErr) {
        console.warn('Could not send Telegram notification for order:', tgErr);
      }

      res.status(201).json(orderResult);
    } catch (error: any) {
      console.error('Failed to create order:', error);
      res.status(500).json({ error: error.message || 'Failed to create order' });
    }
  });

  app.put('/api/orders/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Valid order ID is required' });
      }
      const {
        customerName,
        customerPhone,
        customerCi,
        ci,
        customerAddress,
        items,
        totalAmount,
        paymentMethod,
        status,
        paymentVoucher,
        notes,
        trackingNumber,
        trackingCarrier,
        trackingNotes,
      } = req.body;

      const updated = await updateCustomerOrder(id, {
        customerName,
        customerPhone,
        customerCi: customerCi !== undefined ? customerCi : ci,
        ci: customerCi !== undefined ? customerCi : ci,
        customerAddress,
        items,
        totalAmount,
        paymentMethod,
        status,
        paymentVoucher,
        notes,
        trackingNumber,
        trackingCarrier,
        trackingNotes,
      });

      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update order details:', error);
      res.status(500).json({ error: error.message || 'Failed to update order details' });
    }
  });

  app.put('/api/orders/:id/status', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { status, paymentVoucher, notes, trackingNumber, trackingCarrier, trackingNotes } = req.body;
      if (isNaN(id) || !status) {
        return res.status(400).json({ error: 'Valid ID and status are required' });
      }
      const updated = await updateCustomerOrderStatus(
        id,
        status,
        paymentVoucher,
        notes,
        trackingNumber,
        trackingCarrier,
        trackingNotes
      );
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update order status:', error);
      res.status(500).json({ error: error.message || 'Failed to update order status' });
    }
  });

  app.delete('/api/orders/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Valid ID is required' });
      }
      const result = await deleteCustomerOrder(id);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete order:', error);
      res.status(500).json({ error: error.message || 'Failed to delete order' });
    }
  });

  // 9b. Auto-generate supplier purchase from customer order (Bajo Pedido / Sin Stock)
  app.post('/api/orders/:id/generate-purchase', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Valid customer order ID is required' });
      }
      const result = await autoGeneratePurchaseForOrder(id, req.dbUserId);
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Failed to generate supplier purchase for order:', error);
      res.status(500).json({ error: error.message || 'Error al generar orden de compra a proveedor' });
    }
  });

  // ==========================================
  // 10. PURCHASES & SUPPLIER ORDERS API ROUTES
  // ==========================================

  app.get('/api/purchases', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const status = req.query.status as string;
      const supplierName = req.query.supplierName as string;
      const linkedOrderId = req.query.linkedOrderId ? parseInt(req.query.linkedOrderId as string, 10) : undefined;

      const purchasesList = await getPurchases(req.dbUserId, {
        status,
        supplierName,
        linkedCustomerOrderId: linkedOrderId,
      });

      res.json(purchasesList);
    } catch (error: any) {
      console.error('Failed to fetch purchases:', error);
      res.status(500).json({ error: error.message || 'Error al obtener compras a proveedores' });
    }
  });

  app.post('/api/purchases', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const {
        supplierName,
        supplierContact,
        items,
        totalCost,
        status,
        paymentStatus,
        linkedCustomerOrderId,
        linkedCustomerOrderNumber,
        receiptVoucher,
        notes,
        purchaseDate,
      } = req.body;

      if (!supplierName || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'El nombre del proveedor y al menos un producto son requeridos' });
      }

      const result = await createPurchase({
        userId: req.dbUserId || 1,
        supplierName,
        supplierContact,
        items,
        totalCost,
        status: status || 'received',
        paymentStatus: paymentStatus || 'paid',
        linkedCustomerOrderId: linkedCustomerOrderId ? parseInt(linkedCustomerOrderId, 10) : undefined,
        linkedCustomerOrderNumber,
        receiptVoucher,
        notes,
        purchaseDate,
      });

      res.status(201).json(result);
    } catch (error: any) {
      console.error('Failed to create purchase:', error);
      res.status(500).json({ error: error.message || 'Error al registrar la compra al proveedor' });
    }
  });

  app.get('/api/purchases/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID de compra no válido' });
      }
      const purchase = await getPurchaseById(id);
      if (!purchase) {
        return res.status(404).json({ error: 'Compra no encontrada' });
      }
      res.json(purchase);
    } catch (error: any) {
      console.error('Failed to fetch purchase by id:', error);
      res.status(500).json({ error: error.message || 'Error al obtener detalle de compra' });
    }
  });

  app.put('/api/purchases/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID de compra no válido' });
      }

      const updated = await updatePurchase(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update purchase:', error);
      res.status(500).json({ error: error.message || 'Error al actualizar la compra' });
    }
  });

  // 1-Click Receive Stock in Warehouse
  app.post('/api/purchases/:id/receive', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID de compra no válido' });
      }

      const result = await receivePurchase(id);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to receive purchase stock:', error);
      res.status(500).json({ error: error.message || 'Error al ingresar compra al inventario' });
    }
  });

  app.put('/api/purchases/:id/receive', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID de compra no válido' });
      }

      const result = await receivePurchase(id);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to receive purchase stock:', error);
      res.status(500).json({ error: error.message || 'Error al ingresar compra al inventario' });
    }
  });

  app.delete('/api/purchases/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID de compra no válido' });
      }

      const result = await deletePurchase(id);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete purchase:', error);
      res.status(500).json({ error: error.message || 'Error al eliminar la compra' });
    }
  });

  // ==========================================
  // 10b. FINANCIAL REPORTS & MARGIN SUMMARY API
  // ==========================================

  app.get('/api/finances/summary', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const period = (req.query.period as string) || 'all';
      const summary = await getFinancialSummary(req.dbUserId, period);
      res.json(summary);
    } catch (error: any) {
      console.error('Failed to fetch financial summary:', error);
      res.status(500).json({ error: error.message || 'Error al calcular resumen financiero' });
    }
  });

  // 10a2. Store Analytics & Traffic Tracking Endpoints
  app.post('/api/analytics/event', async (req: Request, res: Response) => {
    try {
      const { eventType, productId, productName, sessionId, deviceType, metadata } = req.body || {};
      if (!eventType) {
        return res.status(400).json({ error: 'eventType is required' });
      }
      const result = await recordAnalyticsEvent({
        eventType,
        productId: productId ? parseInt(productId, 10) : undefined,
        productName,
        sessionId,
        deviceType,
        metadata,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Failed to record analytics event:', error);
      res.status(500).json({ error: error.message || 'Failed to record event' });
    }
  });

  app.get('/api/analytics/dashboard', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const period = (req.query.period as any) || '7d';
      const productId = req.query.productId ? parseInt(req.query.productId as string, 10) : undefined;
      const dashboard = await getStoreAnalyticsDashboard({
        userId: req.dbUserId,
        period,
        productId,
      });
      res.json(dashboard);
    } catch (error: any) {
      console.error('Failed to load analytics dashboard:', error);
      res.status(500).json({ error: error.message || 'Failed to load analytics dashboard' });
    }
  });

  app.post('/api/analytics/reset', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      // 1. Restrict operators (non-admin users)
      if (req.user && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Solo el usuario administrador tiene permisos para reiniciar las estadísticas de la tienda.' });
      }

      const { password } = req.body || {};

      // 2. If caller is not authenticated via session token, check password if provided
      if (!req.user && password && typeof password === 'string' && password.trim()) {
        const targetUserId = req.dbUserId || 1;
        const isValidPassword = await verifyUserPasswordById(targetUserId, password);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Contraseña incorrecta. No se autorizó el reinicio de estadísticas.' });
        }
      }

      const result = await resetStoreAnalytics(req.dbUserId);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to reset analytics:', error);
      res.status(500).json({ error: error.message || 'Failed to reset analytics' });
    }
  });

  // 10b. Customer CRM Endpoints
  app.get('/api/customers', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { search } = req.query;
      const customers = await getCustomers(req.dbUserId, typeof search === 'string' ? search : undefined);
      res.json(customers);
    } catch (error: any) {
      console.error('Failed to fetch customers:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch customers' });
    }
  });

  app.get('/api/customers/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Valid customer ID is required' });
      const customer = await getCustomerById(id);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      res.json(customer);
    } catch (error: any) {
      console.error('Failed to fetch customer:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch customer' });
    }
  });

  app.post('/api/customers', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { fullName, name, phone, ci, email, province, canton, parish, fullAddress, address, reference, notes } = req.body;
      const cleanName = (fullName || name || '').trim();
      const cleanPhone = (phone || '').trim();
      const cleanCi = (ci || '').trim();

      if (!cleanName) {
        return res.status(400).json({ error: 'El nombre completo del cliente es obligatorio' });
      }
      if (!cleanPhone) {
        return res.status(400).json({ error: 'El teléfono del cliente es obligatorio' });
      }
      if (!cleanCi) {
        return res.status(400).json({ error: 'El número de cédula o RUC es obligatorio para registrar un cliente' });
      }

      const customer = await createCustomer({
        userId: req.dbUserId || 1,
        fullName: cleanName,
        name: cleanName,
        phone: cleanPhone,
        ci: cleanCi,
        email,
        province,
        canton,
        parish,
        fullAddress: fullAddress || address,
        reference,
        notes,
      });
      res.status(201).json(customer);
    } catch (error: any) {
      console.error('Failed to create customer:', error);
      res.status(500).json({ error: error.message || 'Failed to create customer' });
    }
  });

  app.put('/api/customers/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Valid customer ID is required' });
      const updated = await updateCustomer(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update customer:', error);
      res.status(500).json({ error: error.message || 'Failed to update customer' });
    }
  });

  app.delete('/api/customers/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Valid customer ID is required' });
      const result = await deleteCustomer(id);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to delete customer:', error);
      res.status(500).json({ error: error.message || 'Failed to delete customer' });
    }
  });

  app.post('/api/customers/sync-orders', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const result = await syncCustomersFromOrders(req.dbUserId || 1);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to sync customers from orders:', error);
      res.status(500).json({ error: error.message || 'Failed to sync customers' });
    }
  });

  // 11. Database Info and Diagnostics
  app.get('/api/server/database-info', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const dbInfo = await getDatabaseRuntimeInfo();
      const items = await getInventoryItems(req.dbUserId);
      const orders = await getCustomerOrders(req.dbUserId);
      const messages = await getTelegramMessages(req.dbUserId);

      res.json({
        ...dbInfo,
        stats: {
          totalProducts: items.length,
          totalOrders: orders.length,
          totalMessages: messages.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al obtener información de la base de datos' });
    }
  });

  // 11b. Server Domain & Subdomain Routing Configuration
  app.get('/api/server/domain-config', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const config = await getServerDomainConfig(req.dbUserId || 1);
      res.json(config);
    } catch (error: any) {
      console.error('Error fetching server domain config:', error);
      res.status(500).json({ error: error.message || 'Error al obtener configuración de dominios' });
    }
  });

  app.post('/api/server/domain-config', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { adminDomain, storeDomain, autoRouting, defaultFallbackView } = req.body || {};
      const updated = await updateServerDomainConfig(req.dbUserId || 1, {
        adminDomain,
        storeDomain,
        autoRouting,
        defaultFallbackView,
      });
      res.json({
        success: true,
        message: 'Configuración de dominios y subdominios actualizada correctamente',
        config: updated,
      });
    } catch (error: any) {
      console.error('Error updating server domain config:', error);
      res.status(500).json({ error: error.message || 'Error al guardar configuración de dominios' });
    }
  });

  // 12. Test Database Connection on demand
  app.post('/api/server/test-db-connection', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const result = await testDatabaseConnection(req.body || {});
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message || 'Error en prueba de conexión' });
    }
  });

  // 13. Export SQL DDL and Data
  app.get('/api/export-sql', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const items = await getInventoryItems(req.dbUserId);
      const orders = await getCustomerOrders(req.dbUserId);
      const messages = await getTelegramMessages(req.dbUserId);
      const storeConfig = await getStoreConfig(req.dbUserId || 1);
      const tgConfig = await getTelegramConfig(req.dbUserId || 1);
      const domainConfig = await getServerDomainConfig(req.dbUserId || 1);

      let sqlDump = `-- =======================================================\n`;
      sqlDump += `-- COMERXIA - DUMP COMPLETO PARA POSTGRESQL LOCAL / REMOTO\n`;
      sqlDump += `-- Fecha de Exportación: ${new Date().toISOString()}\n`;
      sqlDump += `-- =======================================================\n\n`;

      sqlDump += `-- 1. Tabla: users (Sin usuarios precargados)\n`;
      sqlDump += `CREATE TABLE IF NOT EXISTS users (\n`;
      sqlDump += `  id SERIAL PRIMARY KEY,\n`;
      sqlDump += `  uid TEXT UNIQUE,\n`;
      sqlDump += `  username TEXT UNIQUE,\n`;
      sqlDump += `  password TEXT NOT NULL,\n`;
      sqlDump += `  email TEXT NOT NULL,\n`;
      sqlDump += `  name TEXT,\n`;
      sqlDump += `  role TEXT DEFAULT 'admin',\n`;
      sqlDump += `  photo_url TEXT,\n`;
      sqlDump += `  created_at TIMESTAMP DEFAULT NOW(),\n`;
      sqlDump += `  updated_at TIMESTAMP DEFAULT NOW()\n`;
      sqlDump += `);\n\n`;

      sqlDump += `-- 2. Tabla: telegram_configs\n`;
      sqlDump += `CREATE TABLE IF NOT EXISTS telegram_configs (\n`;
      sqlDump += `  id SERIAL PRIMARY KEY,\n`;
      sqlDump += `  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,\n`;
      sqlDump += `  bot_token TEXT,\n`;
      sqlDump += `  webhook_secret TEXT,\n`;
      sqlDump += `  supplier_name TEXT DEFAULT 'Proveedor Telegram',\n`;
      sqlDump += `  supplier_username TEXT,\n`;
      sqlDump += `  auto_approve BOOLEAN DEFAULT TRUE,\n`;
      sqlDump += `  default_margin_percent INTEGER DEFAULT 35,\n`;
      sqlDump += `  currency TEXT DEFAULT 'USD',\n`;
      sqlDump += `  default_stock_enabled BOOLEAN DEFAULT FALSE,\n`;
      sqlDump += `  default_stock_quantity INTEGER DEFAULT 10,\n`;
      sqlDump += `  created_at TIMESTAMP DEFAULT NOW(),\n`;
      sqlDump += `  updated_at TIMESTAMP DEFAULT NOW()\n`;
      sqlDump += `);\n\n`;

      sqlDump += `-- 3. Tabla: inventory_items\n`;
      sqlDump += `CREATE TABLE IF NOT EXISTS inventory_items (\n`;
      sqlDump += `  id SERIAL PRIMARY KEY,\n`;
      sqlDump += `  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,\n`;
      sqlDump += `  name TEXT NOT NULL,\n`;
      sqlDump += `  sku TEXT NOT NULL,\n`;
      sqlDump += `  description TEXT,\n`;
      sqlDump += `  category TEXT NOT NULL DEFAULT 'General',\n`;
      sqlDump += `  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,\n`;
      sqlDump += `  sale_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,\n`;
      sqlDump += `  stock INTEGER NOT NULL DEFAULT 1,\n`;
      sqlDump += `  image_url TEXT,\n`;
      sqlDump += `  supplier_name TEXT DEFAULT 'Proveedor Telegram',\n`;
      sqlDump += `  tags TEXT,\n`;
      sqlDump += `  extracted_attributes TEXT,\n`;
      sqlDump += `  status TEXT NOT NULL DEFAULT 'available',\n`;
      sqlDump += `  raw_telegram_message TEXT,\n`;
      sqlDump += `  created_at TIMESTAMP DEFAULT NOW(),\n`;
      sqlDump += `  updated_at TIMESTAMP DEFAULT NOW()\n`;
      sqlDump += `);\n\n`;

      sqlDump += `-- 4. Tabla: telegram_messages\n`;
      sqlDump += `CREATE TABLE IF NOT EXISTS telegram_messages (\n`;
      sqlDump += `  id SERIAL PRIMARY KEY,\n`;
      sqlDump += `  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,\n`;
      sqlDump += `  telegram_message_id TEXT,\n`;
      sqlDump += `  sender_name TEXT,\n`;
      sqlDump += `  sender_username TEXT,\n`;
      sqlDump += `  caption TEXT,\n`;
      sqlDump += `  photo_url TEXT,\n`;
      sqlDump += `  processed_status TEXT NOT NULL DEFAULT 'processed',\n`;
      sqlDump += `  extracted_data TEXT,\n`;
      sqlDump += `  inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,\n`;
      sqlDump += `  created_at TIMESTAMP DEFAULT NOW()\n`;
      sqlDump += `);\n\n`;

      sqlDump += `-- 5. Tabla: customer_orders\n`;
      sqlDump += `CREATE TABLE IF NOT EXISTS customer_orders (\n`;
      sqlDump += `  id SERIAL PRIMARY KEY,\n`;
      sqlDump += `  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,\n`;
      sqlDump += `  order_number TEXT NOT NULL,\n`;
      sqlDump += `  customer_name TEXT NOT NULL,\n`;
      sqlDump += `  customer_phone TEXT NOT NULL,\n`;
      sqlDump += `  customer_address TEXT,\n`;
      sqlDump += `  items TEXT NOT NULL DEFAULT '[]',\n`;
      sqlDump += `  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,\n`;
      sqlDump += `  payment_method TEXT DEFAULT 'whatsapp',\n`;
      sqlDump += `  status TEXT NOT NULL DEFAULT 'pending',\n`;
      sqlDump += `  payment_voucher TEXT,\n`;
      sqlDump += `  notes TEXT,\n`;
      sqlDump += `  tracking_number TEXT,\n`;
      sqlDump += `  tracking_carrier TEXT,\n`;
      sqlDump += `  tracking_notes TEXT,\n`;
      sqlDump += `  created_at TIMESTAMP DEFAULT NOW()\n`;
      sqlDump += `);\n\n`;

      sqlDump += `-- 6. Tabla: store_configs\n`;
      sqlDump += `CREATE TABLE IF NOT EXISTS store_configs (\n`;
      sqlDump += `  id SERIAL PRIMARY KEY,\n`;
      sqlDump += `  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,\n`;
      sqlDump += `  store_name TEXT DEFAULT 'Comerxia Store',\n`;
      sqlDump += `  whatsapp_number TEXT DEFAULT '',\n`;
      sqlDump += `  description TEXT DEFAULT 'Catálogo digital con envíos y pedidos directos',\n`;
      sqlDump += `  banner_text TEXT DEFAULT '🔥 ¡Catálogo actualizado con las últimas novedades en stock!',\n`;
      sqlDump += `  delivery_fee NUMERIC(12, 2) DEFAULT 0.00,\n`;
      sqlDump += `  min_order_amount NUMERIC(12, 2) DEFAULT 0.00,\n`;
      sqlDump += `  currency TEXT DEFAULT 'USD',\n`;
      sqlDump += `  show_stock BOOLEAN DEFAULT TRUE,\n`;
      sqlDump += `  instagram_url TEXT,\n`;
      sqlDump += `  address TEXT,\n`;
      sqlDump += `  logo_url TEXT,\n`;
      sqlDump += `  courier_logos TEXT,\n`;
      sqlDump += `  payment_logos TEXT,\n`;
      sqlDump += `  created_at TIMESTAMP DEFAULT NOW(),\n`;
      sqlDump += `  updated_at TIMESTAMP DEFAULT NOW()\n`;
      sqlDump += `);\n\n`;

      sqlDump += `-- 7. Tabla: server_domain_configs\n`;
      sqlDump += `CREATE TABLE IF NOT EXISTS server_domain_configs (\n`;
      sqlDump += `  id SERIAL PRIMARY KEY,\n`;
      sqlDump += `  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,\n`;
      sqlDump += `  admin_domain TEXT DEFAULT 'admin.dominio1.com',\n`;
      sqlDump += `  store_domain TEXT DEFAULT 'www.dominio1.com, dominio1.com',\n`;
      sqlDump += `  auto_routing BOOLEAN DEFAULT TRUE,\n`;
      sqlDump += `  default_fallback_view TEXT DEFAULT 'admin',\n`;
      sqlDump += `  created_at TIMESTAMP DEFAULT NOW(),\n`;
      sqlDump += `  updated_at TIMESTAMP DEFAULT NOW()\n`;
      sqlDump += `);\n\n`;

      if (domainConfig) {
        const safeAdminDom = (domainConfig.adminDomain || 'admin.dominio1.com').replace(/'/g, "''");
        const safeStoreDom = (domainConfig.storeDomain || 'www.dominio1.com, dominio1.com').replace(/'/g, "''");
        const safeFallback = (domainConfig.defaultFallbackView || 'admin').replace(/'/g, "''");
        sqlDump += `INSERT INTO server_domain_configs (user_id, admin_domain, store_domain, auto_routing, default_fallback_view) VALUES (${domainConfig.userId || 1}, '${safeAdminDom}', '${safeStoreDom}', ${domainConfig.autoRouting !== false}, '${safeFallback}');\n\n`;
      }

      if (items.length > 0) {
        sqlDump += `-- Datos: inventory_items (${items.length} registros)\n`;
        for (const item of items) {
          const safeName = (item.name || '').replace(/'/g, "''");
          const safeSku = (item.sku || '').replace(/'/g, "''");
          const safeDesc = (item.description || '').replace(/'/g, "''");
          const safeCat = (item.category || 'General').replace(/'/g, "''");
          const safeSupplier = (item.supplierName || '').replace(/'/g, "''");
          const safeTags = (item.tags || '').replace(/'/g, "''");
          const safeRaw = (item.rawTelegramMessage || '').replace(/'/g, "''");
          const safeExt = typeof item.extractedAttributes === 'object' ? JSON.stringify(item.extractedAttributes).replace(/'/g, "''") : (item.extractedAttributes || '').replace(/'/g, "''");
          const safeImg = (item.imageUrl || '').replace(/'/g, "''");

          sqlDump += `INSERT INTO inventory_items (user_id, name, sku, description, category, cost_price, sale_price, stock, image_url, supplier_name, tags, extracted_attributes, status, raw_telegram_message) VALUES (${item.userId || 1}, '${safeName}', '${safeSku}', '${safeDesc}', '${safeCat}', ${item.costPrice || 0}, ${item.salePrice || 0}, ${item.stock || 1}, '${safeImg}', '${safeSupplier}', '${safeTags}', '${safeExt}', '${item.status || 'available'}', '${safeRaw}');\n`;
        }
        sqlDump += `\n`;
      }

      if (orders.length > 0) {
        sqlDump += `-- Datos: customer_orders (${orders.length} registros)\n`;
        for (const order of orders) {
          const safeNum = (order.orderNumber || '').replace(/'/g, "''");
          const safeCust = (order.customerName || '').replace(/'/g, "''");
          const safePhone = (order.customerPhone || '').replace(/'/g, "''");
          const safeAddr = (order.customerAddress || '').replace(/'/g, "''");
          const safeItems = JSON.stringify(order.items || []).replace(/'/g, "''");
          const safePayMethod = (order.paymentMethod || 'whatsapp').replace(/'/g, "''");
          const safeStatus = (order.status || 'pending').replace(/'/g, "''");
          const safeNotes = (order.notes || '').replace(/'/g, "''");
          const safeTrackNum = (order.trackingNumber || '').replace(/'/g, "''");
          const safeTrackCarrier = (order.trackingCarrier || '').replace(/'/g, "''");

          sqlDump += `INSERT INTO customer_orders (user_id, order_number, customer_name, customer_phone, customer_address, items, total_amount, payment_method, status, notes, tracking_number, tracking_carrier) VALUES (${order.userId || 1}, '${safeNum}', '${safeCust}', '${safePhone}', '${safeAddr}', '${safeItems}', ${order.totalAmount || 0}, '${safePayMethod}', '${safeStatus}', '${safeNotes}', '${safeTrackNum}', '${safeTrackCarrier}');\n`;
        }
        sqlDump += `\n`;
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="comerxia_backup_completo.sql"');
      res.send(sqlDump);
    } catch (error: any) {
      console.error('Error generating SQL export:', error);
      res.status(500).json({ error: 'Failed to generate SQL export' });
    }
  });

  // 14. Export Complete JSON Backup
  app.get('/api/export-backup-json', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const items = await getInventoryItems(req.dbUserId);
      const orders = await getCustomerOrders(req.dbUserId);
      const messages = await getTelegramMessages(req.dbUserId);
      const storeConfig = await getStoreConfig(req.dbUserId || 1);
      const tgConfig = await getTelegramConfig(req.dbUserId || 1);
      const domainConfig = await getServerDomainConfig(req.dbUserId || 1);

      const backupData = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        storeConfig,
        telegramConfig: tgConfig,
        domainConfig,
        inventoryItems: items,
        customerOrders: orders,
        telegramMessages: messages,
      };

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="comerxia_backup_completo.json"');
      res.send(JSON.stringify(backupData, null, 2));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al exportar JSON' });
    }
  });

  // 14b. Uploads / Media Backup & Restore Endpoints
  const uploadZipMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // Max 100MB ZIP
  });

  app.get('/api/media/stats', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const stats = getUploadsStats();
      res.json({ success: true, ...stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Error al obtener estadísticas de imágenes' });
    }
  });

  app.get('/api/export-uploads-zip', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const zipBuffer = await createUploadsZipBuffer();
      const filename = `comerxia_imagenes_${new Date().toISOString().slice(0, 10)}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      res.send(zipBuffer);
    } catch (error: any) {
      console.error('Error exporting uploads zip:', error);
      res.status(500).json({ success: false, error: error.message || 'Error al generar ZIP de imágenes' });
    }
  });

  app.post('/api/restore-uploads-zip', requireAuth, uploadZipMiddleware.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ success: false, error: 'Debe adjuntar un archivo ZIP válido con las imágenes' });
      }

      const result = await restoreUploadsFromZipBuffer(req.file.buffer);
      res.json({
        success: true,
        restoredCount: result.restoredCount,
        errors: result.errors,
        message: `Se restauraron exitosamente ${result.restoredCount} imagen(es) en la carpeta local uploads/`,
      });
    } catch (error: any) {
      console.error('Error restoring uploads zip:', error);
      res.status(500).json({ success: false, error: error.message || 'Error al procesar y restaurar el archivo ZIP' });
    }
  });

  // 15. Safe Image Download Endpoints (Supports direct attachment streaming for base64 & remote URLs)
  app.post('/api/download-image', async (req: Request, res: Response) => {
    try {
      const { image, filename } = req.body;
      const rawFilename = filename || 'producto.jpg';
      const cleanFilename = String(rawFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
      const finalFilename = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(cleanFilename)
        ? cleanFilename
        : `${cleanFilename}.jpg`;

      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Image data is required' });
      }

      // Case 1: Base64 Data URI
      if (image.startsWith('data:')) {
        const matches = image.match(/^data:([A-Za-z0-9\/\-+.]+);base64,(.+)$/s);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2].replace(/[\r\n\s]/g, '');
          const buffer = Buffer.from(base64Data, 'base64');
          res.setHeader('Content-Type', mimeType || 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
          res.setHeader('Content-Length', buffer.length);
          return res.send(buffer);
        }
      }

      // Case 2: Remote HTTP/HTTPS URL
      if (image.startsWith('http://') || image.startsWith('https://')) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const imgResponse = await fetch(image, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        clearTimeout(timeout);

        if (!imgResponse.ok) {
          return res.status(imgResponse.status).json({ error: 'Failed to fetch remote image' });
        }

        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await imgResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
      }

      return res.status(400).json({ error: 'Unsupported image format' });
    } catch (err: any) {
      console.error('Error in /api/download-image:', err);
      res.status(500).json({ error: err.message || 'Failed to process image download' });
    }
  });

  app.get('/api/download-image-proxy', async (req: Request, res: Response) => {
    try {
      const rawUrl = req.query.url as string;
      const rawFilename = (req.query.filename as string) || 'producto.jpg';
      const cleanFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const finalFilename = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(cleanFilename)
        ? cleanFilename
        : `${cleanFilename}.jpg`;

      if (!rawUrl || typeof rawUrl !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      // If it's a remote URL (http or https)
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const imgResponse = await fetch(rawUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        clearTimeout(timeout);

        if (!imgResponse.ok) {
          return res.status(imgResponse.status).json({ error: 'Failed to fetch upstream image' });
        }

        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await imgResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
      }

      return res.status(400).json({ error: 'Invalid URL scheme' });
    } catch (err: any) {
      console.error('Error in download-image-proxy:', err);
      res.status(500).json({ error: err.message || 'Failed to proxy image download' });
    }
  });

  // Explicit 404 handler for unknown /api routes to prevent falling through to Vite HTML
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `Endpoint de API no encontrado: ${req.method} ${req.path}`,
    });
  });

  // Global error handler for Express to guarantee JSON error output
  app.use((err: any, req: Request, res: Response, next: any) => {
    console.error('Express global error handler caught:', err);
    if (res.headersSent) {
      return next(err);
    }
    const statusCode = typeof err?.status === 'number' ? err.status : 500;
    res.status(statusCode).json({
      success: false,
      error: err?.message || 'Error interno del servidor',
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Telegram Inventory AI server running on http://0.0.0.0:${PORT}`);

    // Automatically check for stored Telegram token and start live polling worker
    try {
      const initialConfig = await getTelegramConfig(1);
      const token = initialConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN;
      if (token && token.trim()) {
        console.log('[Telegram Bot] Starting automatic background polling daemon...');
        startTelegramPolling(token.trim(), 1);
      } else {
        console.log('[Telegram Bot] No bot token configured yet. Waiting for configuration.');
      }
    } catch (botBootErr) {
      console.warn('[Telegram Bot] Could not auto-start bot polling on boot:', botBootErr);
    }

    // Automatically load AI configuration and set active Gemini API key
    try {
      const aiConfig = await getAiConfig(1);
      const activeKey = aiConfig?.apiKey || process.env.GEMINI_API_KEY;
      if (activeKey && activeKey.trim()) {
        setCustomAiApiKey(activeKey.trim());
        process.env.GEMINI_API_KEY = activeKey.trim();
        console.log('[Google Gemini AI] Clave API cargada y activada correctamente.');
      } else {
        console.log('[Google Gemini AI] Clave API pendiente de configuración.');
      }
    } catch (aiBootErr) {
      console.warn('[Google Gemini AI] Nota al cargar configuración inicial de IA:', aiBootErr);
    }

    // Background automatic self-hosted image synchronization for any external images
    setTimeout(async () => {
      try {
        const syncRes = await syncAllInventoryImagesLocally(
          () => getInventoryItems(),
          (id, data) => updateInventoryItem(id, data)
        );
        if (syncRes.imagesPersisted > 0) {
          console.log(`[Media Storage] Sincronización automática: ${syncRes.imagesPersisted} imagen(es) descargadas y guardadas permanentemente.`);
        }
      } catch (syncErr) {
        console.warn('[Media Storage] Error en sincronización inicial de imágenes:', syncErr);
      }
    }, 4000);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
