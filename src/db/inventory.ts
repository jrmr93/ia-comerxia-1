import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db, isPostgresConfigured } from './index.ts';
import { aiConfigs, customerOrders, customers, inventoryItems, purchases, serverDomainConfigs, storeConfigs, telegramConfigs, telegramMessages, users } from './schema.ts';
import { normalizeEcuadorPhone } from '../utils/phone.ts';
import { storage } from './storage.ts';
import { persistImageLocally, persistImageListLocally, persistVideoLocally } from '../services/media-storage.ts';

/**
 * Sanitizes numeric strings to guarantee valid SQL NUMERIC/DECIMAL values (e.g., '12.50')
 */
export function cleanNumericString(val: any, fallback: string = '0.00'): string {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) return fallback;
  return num.toFixed(2);
}

/**
 * Sanitizes integer inputs to guarantee valid SQL INTEGER values
 */
export function cleanInteger(val: any, fallback: number = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  const num = parseInt(String(val), 10);
  if (isNaN(num) || !isFinite(num)) return fallback;
  return num;
}

/**
 * Resolves a valid user ID from the PostgreSQL users table to satisfy Foreign Key constraints.
 * If the requested userId does not exist, it falls back to the first registered user or creates the system admin.
 */
export async function resolveValidUserId(preferredUserId?: number): Promise<number> {
  if (!isPostgresConfigured()) {
    return preferredUserId || 1;
  }
  try {
    if (preferredUserId && preferredUserId > 0) {
      const user = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, preferredUserId))
        .limit(1);
      if (user.length > 0) {
        return user[0].id;
      }
    }
    // Fallback to the first registered user (usually the administrator)
    const anyUser = await db
      .select({ id: users.id })
      .from(users)
      .orderBy(users.id)
      .limit(1);
    if (anyUser.length > 0) {
      return anyUser[0].id;
    }
    // If no user exists yet in the database, return preferred ID without modifying table
    return preferredUserId || 1;
  } catch (err) {
    console.warn('Error resolving valid user ID in PostgreSQL:', err);
    return preferredUserId || 1;
  }
}

export async function getInventoryItems(
  userId?: number,
  filters?: { search?: string; category?: string; status?: string; supplier?: string }
) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    let list = [...state.inventoryItems];

    if (filters?.category && filters.category !== 'all') {
      list = list.filter((item) => item.category === filters.category);
    }
    if (filters?.status && filters.status !== 'all') {
      list = list.filter((item) => item.status === filters.status);
    }
    if (filters?.supplier && filters.supplier !== 'all') {
      list = list.filter((item) => item.supplierName === filters.supplier);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.name?.toLowerCase().includes(q) ||
          item.sku?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.tags?.toLowerCase().includes(q) ||
          item.supplierName?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return list.map((item) => {
      let images: string[] = [];
      if (item.extractedAttributes) {
        try {
          const parsed = JSON.parse(item.extractedAttributes);
          if (Array.isArray(parsed.images)) {
            images = parsed.images.filter(Boolean);
          }
        } catch {}
      }
      if (images.length === 0 && item.imageUrl) {
        images = [item.imageUrl];
      }
      return {
        ...item,
        images,
      };
    });
  }

  try {
    const conditions = [];

    if (filters?.category && filters.category !== 'all') {
      conditions.push(eq(inventoryItems.category, filters.category));
    }

    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(inventoryItems.status, filters.status));
    }

    if (filters?.supplier && filters.supplier !== 'all') {
      conditions.push(eq(inventoryItems.supplierName, filters.supplier));
    }

    if (filters?.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(inventoryItems.name, q),
          ilike(inventoryItems.sku, q),
          ilike(inventoryItems.description, q),
          ilike(inventoryItems.tags, q),
          ilike(inventoryItems.supplierName, q)
        )
      );
    }

    const query = db
      .select()
      .from(inventoryItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(inventoryItems.createdAt));

    const rows = await query;
    return rows.map((item) => {
      let images: string[] = [];
      let videoUrl = item.videoUrl || null;
      if (item.extractedAttributes) {
        try {
          const parsed = JSON.parse(item.extractedAttributes);
          if (Array.isArray(parsed.images)) {
            images = parsed.images.filter(Boolean);
          }
          if (!videoUrl && (parsed.videoUrl || parsed.video)) {
            videoUrl = parsed.videoUrl || parsed.video;
          }
        } catch {}
      }
      if (images.length === 0 && item.imageUrl) {
        images = [item.imageUrl];
      }
      return {
        ...item,
        images,
        videoUrl,
      };
    });
  } catch (error) {
    console.warn('Error fetching inventory items from SQL, using local store:', error);
    const state = storage.getState();
    return state.inventoryItems.map((item) => {
      let videoUrl = item.videoUrl || null;
      if (!videoUrl && item.extractedAttributes) {
        try {
          const parsed = JSON.parse(item.extractedAttributes);
          videoUrl = parsed.videoUrl || parsed.video || null;
        } catch {}
      }
      return {
        ...item,
        images: item.imageUrl ? [item.imageUrl] : [],
        videoUrl,
      };
    });
  }
}

export async function getInventoryItemById(id: number) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const item = state.inventoryItems.find((it) => it.id === id);
    if (!item) return null;

    let images: string[] = [];
    let videoUrl = item.videoUrl || null;
    if (item.extractedAttributes) {
      try {
        const parsed = JSON.parse(item.extractedAttributes);
        if (Array.isArray(parsed.images)) {
          images = parsed.images.filter(Boolean);
        }
        if (!videoUrl && (parsed.videoUrl || parsed.video)) {
          videoUrl = parsed.videoUrl || parsed.video;
        }
      } catch {}
    }
    if (images.length === 0 && item.imageUrl) {
      images = [item.imageUrl];
    }
    return {
      ...item,
      images,
      videoUrl,
    };
  }

  try {
    const items = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .limit(1);

    if (!items[0]) return null;
    const item = items[0];

    let images: string[] = [];
    let videoUrl = item.videoUrl || null;
    if (item.extractedAttributes) {
      try {
        const parsed = JSON.parse(item.extractedAttributes);
        if (Array.isArray(parsed.images)) {
          images = parsed.images.filter(Boolean);
        }
        if (!videoUrl && (parsed.videoUrl || parsed.video)) {
          videoUrl = parsed.videoUrl || parsed.video;
        }
      } catch {}
    }
    if (images.length === 0 && item.imageUrl) {
      images = [item.imageUrl];
    }

    return {
      ...item,
      images,
      videoUrl,
    };
  } catch (error) {
    console.warn('Error fetching inventory item by id from SQL, fallback:', error);
    const state = storage.getState();
    const item = state.inventoryItems.find((it) => it.id === id);
    if (!item) return null;
    let videoUrl = item.videoUrl || null;
    if (!videoUrl && item.extractedAttributes) {
      try {
        const parsed = JSON.parse(item.extractedAttributes);
        videoUrl = parsed.videoUrl || parsed.video || null;
      } catch {}
    }
    return {
      ...item,
      images: item.imageUrl ? [item.imageUrl] : [],
      videoUrl,
    };
  }
}

export async function appendImagesToInventoryItem(id: number, newImageUrls: string[], setAsCover = false) {
  try {
    const item = await getInventoryItemById(id);
    if (!item) return null;

    // Automatically persist all incoming external/base64 images locally in /uploads/
    const persistedNewUrls = await persistImageListLocally(newImageUrls);

    let parsedAttr: Record<string, any> = {};
    if (item.extractedAttributes) {
      try {
        parsedAttr = JSON.parse(item.extractedAttributes);
      } catch {}
    }

    const currentImages: string[] = Array.isArray(parsedAttr.images)
      ? [...parsedAttr.images]
      : item.imageUrl
      ? [item.imageUrl]
      : [];

    for (const url of persistedNewUrls) {
      const cleanUrl = url?.trim();
      if (cleanUrl && !currentImages.includes(cleanUrl)) {
        if (setAsCover) {
          currentImages.unshift(cleanUrl);
        } else {
          currentImages.push(cleanUrl);
        }
      }
    }

    parsedAttr.images = currentImages;
    parsedAttr.totalPhotos = currentImages.length;

    const primaryImage = setAsCover && persistedNewUrls[0] ? persistedNewUrls[0] : item.imageUrl || currentImages[0] || null;

    let updatedRow: any = null;

    if (isPostgresConfigured()) {
      try {
        const result = await db
          .update(inventoryItems)
          .set({
            imageUrl: primaryImage,
            extractedAttributes: JSON.stringify(parsedAttr),
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, id))
          .returning();

        if (result && result.length > 0) {
          updatedRow = result[0];
        }
      } catch (sqlErr) {
        console.warn('Postgres error in appendImagesToInventoryItem, updating local fallback:', sqlErr);
      }
    }

    // Always keep in-memory/JSON store in sync
    const state = storage.getState();
    const idx = state.inventoryItems.findIndex((it) => it.id === id);
    if (idx !== -1) {
      state.inventoryItems[idx].imageUrl = primaryImage;
      state.inventoryItems[idx].extractedAttributes = JSON.stringify(parsedAttr);
      state.inventoryItems[idx].updatedAt = new Date().toISOString();
      storage.save();
      if (!updatedRow) {
        updatedRow = state.inventoryItems[idx];
      }
    }

    return {
      ...(updatedRow || item),
      imageUrl: primaryImage,
      extractedAttributes: JSON.stringify(parsedAttr),
      images: currentImages,
    };
  } catch (error) {
    console.error('Error appending images to inventory item:', error);
    return null;
  }
}

export async function appendImageToInventoryItem(id: number, newImageUrl: string) {
  return appendImagesToInventoryItem(id, [newImageUrl], false);
}

export async function clearAllImagesFromInventoryItem(id: number) {
  try {
    const item = await getInventoryItemById(id);
    if (!item) return null;

    let parsedAttr: Record<string, any> = {};
    if (item.extractedAttributes) {
      try {
        parsedAttr = JSON.parse(item.extractedAttributes);
      } catch {}
    }

    parsedAttr.images = [];
    parsedAttr.totalPhotos = 0;

    let updatedRow: any = null;

    if (isPostgresConfigured()) {
      try {
        const result = await db
          .update(inventoryItems)
          .set({
            imageUrl: null,
            extractedAttributes: JSON.stringify(parsedAttr),
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, id))
          .returning();

        if (result && result.length > 0) {
          updatedRow = result[0];
        }
      } catch (sqlErr) {
        console.warn('Postgres error in clearAllImagesFromInventoryItem:', sqlErr);
      }
    }

    const state = storage.getState();
    const idx = state.inventoryItems.findIndex((it) => it.id === id);
    if (idx !== -1) {
      state.inventoryItems[idx].imageUrl = null;
      state.inventoryItems[idx].extractedAttributes = JSON.stringify(parsedAttr);
      state.inventoryItems[idx].updatedAt = new Date().toISOString();
      storage.save();
      if (!updatedRow) {
        updatedRow = state.inventoryItems[idx];
      }
    }

    return {
      ...(updatedRow || item),
      imageUrl: null,
      extractedAttributes: JSON.stringify(parsedAttr),
      images: [],
    };
  } catch (error) {
    console.error('Error clearing all images from inventory item:', error);
    return null;
  }
}

export async function removeImageFromInventoryItem(id: number, imageUrlToRemove?: string, photoIndex?: number) {
  try {
    const item = await getInventoryItemById(id);
    if (!item) return null;

    let parsedAttr: Record<string, any> = {};
    if (item.extractedAttributes) {
      try {
        parsedAttr = JSON.parse(item.extractedAttributes);
      } catch {}
    }

    let currentImages: string[] = Array.isArray(parsedAttr.images) && parsedAttr.images.length > 0
      ? [...parsedAttr.images]
      : item.imageUrl
      ? [item.imageUrl]
      : [];

    const norm = (u: string) => {
      try {
        return decodeURIComponent(String(u).trim());
      } catch {
        return String(u).trim();
      }
    };

    let removed = false;
    if (typeof photoIndex === 'number' && photoIndex >= 0 && photoIndex < currentImages.length) {
      currentImages.splice(photoIndex, 1);
      removed = true;
    } else if (imageUrlToRemove) {
      const targetNorm = norm(imageUrlToRemove);
      const filtered = currentImages.filter((img) => {
        const imgNorm = norm(img);
        return imgNorm !== targetNorm && img !== imageUrlToRemove && img.trim() !== imageUrlToRemove.trim();
      });
      if (filtered.length < currentImages.length) {
        currentImages = filtered;
        removed = true;
      } else {
        if (currentImages.length === 1 || (item.imageUrl && norm(item.imageUrl) === targetNorm)) {
          currentImages = [];
          removed = true;
        }
      }
    } else if (currentImages.length > 0) {
      currentImages.pop();
      removed = true;
    }

    parsedAttr.images = currentImages;
    parsedAttr.totalPhotos = currentImages.length;

    let newPrimaryImage: string | null = currentImages[0] || null;
    if (item.imageUrl && currentImages.some((img) => norm(img) === norm(item.imageUrl!))) {
      newPrimaryImage = item.imageUrl;
    }

    let updatedRow: any = null;

    if (isPostgresConfigured()) {
      try {
        const result = await db
          .update(inventoryItems)
          .set({
            imageUrl: newPrimaryImage,
            extractedAttributes: JSON.stringify(parsedAttr),
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, id))
          .returning();

        if (result && result.length > 0) {
          updatedRow = result[0];
        }
      } catch (sqlErr) {
        console.warn('Postgres error in removeImageFromInventoryItem:', sqlErr);
      }
    }

    const state = storage.getState();
    const idx = state.inventoryItems.findIndex((it) => it.id === id);
    if (idx !== -1) {
      state.inventoryItems[idx].imageUrl = newPrimaryImage;
      state.inventoryItems[idx].extractedAttributes = JSON.stringify(parsedAttr);
      state.inventoryItems[idx].updatedAt = new Date().toISOString();
      storage.save();
      if (!updatedRow) {
        updatedRow = state.inventoryItems[idx];
      }
    }

    return {
      ...(updatedRow || item),
      imageUrl: newPrimaryImage,
      extractedAttributes: JSON.stringify(parsedAttr),
      images: currentImages,
    };
  } catch (error) {
    console.error('Error removing image from inventory item:', error);
    return null;
  }
}

export async function setCoverImageForInventoryItem(id: number, coverImageUrl: string) {
  try {
    const item = await getInventoryItemById(id);
    if (!item) return null;

    let parsedAttr: Record<string, any> = {};
    if (item.extractedAttributes) {
      try {
        parsedAttr = JSON.parse(item.extractedAttributes);
      } catch {}
    }

    let currentImages: string[] = Array.isArray(parsedAttr.images)
      ? [...parsedAttr.images]
      : item.imageUrl
      ? [item.imageUrl]
      : [];

    if (!currentImages.includes(coverImageUrl)) {
      currentImages.unshift(coverImageUrl);
    } else {
      currentImages = [coverImageUrl, ...currentImages.filter((i) => i !== coverImageUrl)];
    }

    parsedAttr.images = currentImages;
    parsedAttr.totalPhotos = currentImages.length;

    let updatedRow: any = null;

    if (isPostgresConfigured()) {
      try {
        const result = await db
          .update(inventoryItems)
          .set({
            imageUrl: coverImageUrl,
            extractedAttributes: JSON.stringify(parsedAttr),
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, id))
          .returning();

        if (result && result.length > 0) {
          updatedRow = result[0];
        }
      } catch (sqlErr) {
        console.warn('Postgres error in setCoverImageForInventoryItem:', sqlErr);
      }
    }

    const state = storage.getState();
    const idx = state.inventoryItems.findIndex((it) => it.id === id);
    if (idx !== -1) {
      state.inventoryItems[idx].imageUrl = coverImageUrl;
      state.inventoryItems[idx].extractedAttributes = JSON.stringify(parsedAttr);
      state.inventoryItems[idx].updatedAt = new Date().toISOString();
      storage.save();
      if (!updatedRow) {
        updatedRow = state.inventoryItems[idx];
      }
    }

    return {
      ...(updatedRow || item),
      imageUrl: coverImageUrl,
      extractedAttributes: JSON.stringify(parsedAttr),
      images: currentImages,
    };
  } catch (error) {
    console.error('Error setting cover image:', error);
    return null;
  }
}

/**
 * Sets or removes the product video URL, persisting if local video data is provided.
 */
export async function setInventoryItemVideo(id: number, rawVideoUrl: string | null | undefined) {
  try {
    const item = await getInventoryItemById(id);
    if (!item) return null;

    let finalVideoUrl: string | null = null;
    if (rawVideoUrl && typeof rawVideoUrl === 'string' && rawVideoUrl.trim()) {
      const trimmed = rawVideoUrl.trim();
      finalVideoUrl = await persistVideoLocally(trimmed) || trimmed;
    }

    let parsedAttr: Record<string, any> = {};
    if (item.extractedAttributes) {
      try {
        parsedAttr = JSON.parse(item.extractedAttributes);
      } catch {}
    }

    if (finalVideoUrl) {
      parsedAttr.videoUrl = finalVideoUrl;
      parsedAttr.video = finalVideoUrl;
    } else {
      delete parsedAttr.videoUrl;
      delete parsedAttr.video;
    }

    let updatedRow: any = null;

    if (isPostgresConfigured()) {
      try {
        const result = await db
          .update(inventoryItems)
          .set({
            videoUrl: finalVideoUrl,
            extractedAttributes: JSON.stringify(parsedAttr),
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, id))
          .returning();

        if (result && result.length > 0) {
          updatedRow = result[0];
        }
      } catch (sqlErr) {
        console.warn('Postgres error in setInventoryItemVideo:', sqlErr);
      }
    }

    const state = storage.getState();
    const idx = state.inventoryItems.findIndex((it) => it.id === id);
    if (idx !== -1) {
      state.inventoryItems[idx].videoUrl = finalVideoUrl;
      state.inventoryItems[idx].extractedAttributes = JSON.stringify(parsedAttr);
      state.inventoryItems[idx].updatedAt = new Date().toISOString();
      storage.save();
      if (!updatedRow) {
        updatedRow = state.inventoryItems[idx];
      }
    }

    return {
      ...(updatedRow || item),
      videoUrl: finalVideoUrl,
      extractedAttributes: JSON.stringify(parsedAttr),
    };
  } catch (error) {
    console.error('Error setting product video:', error);
    return null;
  }
}

export function getSupplierSkuPrefix(supplierName?: string): string {
  if (!supplierName) return 'PF';
  const clean = supplierName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .trim();

  if (clean.length === 0) return 'PF';
  return clean.slice(0, 3).toUpperCase();
}

export async function generateNextSku(supplierNameOrPrefix: string = 'PF'): Promise<string> {
  const prefix =
    supplierNameOrPrefix && supplierNameOrPrefix.length <= 4 && /^[a-zA-Z0-9]+$/.test(supplierNameOrPrefix)
      ? supplierNameOrPrefix.trim().toUpperCase()
      : getSupplierSkuPrefix(supplierNameOrPrefix);

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    let maxNum = 0;
    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');

    for (const item of state.inventoryItems) {
      if (!item.sku) continue;
      const match = item.sku.trim().match(regex);
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    }
    const nextNumber = maxNum + 1;
    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }

  try {
    const rows = await db
      .select({ sku: inventoryItems.sku })
      .from(inventoryItems)
      .where(ilike(inventoryItems.sku, `${prefix}%`));

    let maxNum = 0;
    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');

    for (const row of rows) {
      if (!row.sku) continue;
      const match = row.sku.trim().match(regex);
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    }

    const nextNumber = maxNum + 1;
    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  } catch (err) {
    const state = storage.getState();
    let maxNum = 0;
    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');
    for (const item of state.inventoryItems) {
      if (!item.sku) continue;
      const match = item.sku.trim().match(regex);
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
    return `${prefix}${String(maxNum + 1).padStart(5, '0')}`;
  }
}

export async function findExistingInventoryItem(data: {
  name?: string;
  sku?: string;
  rawTelegramMessage?: string;
  supplierName?: string;
}) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (data.sku && data.sku.trim()) {
      const match = state.inventoryItems.find((it) => it.sku?.toLowerCase() === data.sku!.trim().toLowerCase());
      if (match) return match;
    }
    if (data.name && data.name.trim()) {
      const match = state.inventoryItems.find((it) => it.name?.toLowerCase() === data.name!.trim().toLowerCase());
      if (match) return match;
    }
    if (data.rawTelegramMessage && data.rawTelegramMessage.trim().length >= 20) {
      const match = state.inventoryItems.find(
        (it) => it.rawTelegramMessage?.trim() === data.rawTelegramMessage!.trim()
      );
      if (match) return match;
    }
    return null;
  }

  try {
    if (data.sku && data.sku.trim()) {
      const bySku = await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.sku, data.sku.trim()))
        .limit(1);
      if (bySku[0]) return bySku[0];
    }

    if (data.name && data.name.trim()) {
      const cleanName = data.name.trim();
      const byName = await db
        .select()
        .from(inventoryItems)
        .where(ilike(inventoryItems.name, cleanName))
        .limit(1);
      if (byName[0]) return byName[0];
    }

    if (data.rawTelegramMessage && data.rawTelegramMessage.trim().length >= 20) {
      const cleanMsg = data.rawTelegramMessage.trim();
      const byMsg = await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.rawTelegramMessage, cleanMsg))
        .limit(1);
      if (byMsg[0]) return byMsg[0];
    }

    return null;
  } catch (err) {
    console.warn('Error checking for existing inventory item in SQL:', err);
    return null;
  }
}

export async function createInventoryItem(data: {
  userId?: number;
  name: string;
  sku?: string;
  description?: string;
  category: string;
  costPrice: string;
  salePrice: string;
  discountPercent?: number;
  stock: number;
  imageUrl?: string;
  videoUrl?: string;
  supplierName?: string;
  tags?: string;
  extractedAttributes?: string;
  status?: string;
  rawTelegramMessage?: string;
  marketingCopy?: string;
}) {
  let finalSku = data.sku?.trim();
  if (!finalSku || finalSku === 'AUTO' || finalSku.startsWith('PROD-') || finalSku.startsWith('CAL-') || finalSku.startsWith('GEN-')) {
    finalSku = await generateNextSku(data.supplierName || 'PF');
  }

  const safeDiscount = Math.max(0, Math.min(100, Number(data.discountPercent) || 0));

  const cleanCost = cleanNumericString(data.costPrice, '0.00');
  const cleanSale = cleanNumericString(data.salePrice, '0.00');
  const cleanStock = cleanInteger(data.stock, 0);

  // Automatically persist image locally in /uploads/
  let effectiveImageUrl = data.imageUrl || null;
  if (effectiveImageUrl) {
    const persisted = await persistImageLocally(effectiveImageUrl);
    if (persisted) effectiveImageUrl = persisted;
  }

  // Automatically persist video locally if base64
  let effectiveVideoUrl = data.videoUrl || null;
  if (effectiveVideoUrl) {
    const persistedVideo = await persistVideoLocally(effectiveVideoUrl);
    if (persistedVideo) effectiveVideoUrl = persistedVideo;
  }

  let effectiveExtractedAttributes = data.extractedAttributes || null;
  if (effectiveExtractedAttributes) {
    try {
      const parsed = JSON.parse(effectiveExtractedAttributes);
      if (Array.isArray(parsed.images) && parsed.images.length > 0) {
        parsed.images = await persistImageListLocally(parsed.images);
      }
      if (effectiveVideoUrl) {
        parsed.videoUrl = effectiveVideoUrl;
      } else if (parsed.videoUrl || parsed.video) {
        effectiveVideoUrl = parsed.videoUrl || parsed.video;
      }
      effectiveExtractedAttributes = JSON.stringify(parsed);
    } catch {}
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const nextId = state.nextId.inventoryItems++;
    const now = new Date().toISOString();

    const newItem = {
      id: nextId,
      userId: data.userId || 1,
      name: data.name,
      sku: finalSku,
      description: data.description || '',
      category: data.category || 'General',
      costPrice: cleanCost,
      salePrice: cleanSale,
      discountPercent: safeDiscount,
      stock: Math.max(0, cleanStock),
      imageUrl: effectiveImageUrl,
      videoUrl: effectiveVideoUrl,
      supplierName: data.supplierName || 'Proveedor Telegram',
      tags: data.tags || null,
      extractedAttributes: effectiveExtractedAttributes,
      status: data.status || 'available',
      rawTelegramMessage: data.rawTelegramMessage || null,
      marketingCopy: data.marketingCopy || null,
      createdAt: now,
      updatedAt: now,
    };

    state.inventoryItems.unshift(newItem);
    storage.save();
    return newItem;
  }

  try {
    const targetUserId = await resolveValidUserId(data.userId);
    const result = await db
      .insert(inventoryItems)
      .values({
        userId: targetUserId,
        name: data.name,
        sku: finalSku,
        description: data.description || '',
        category: data.category || 'General',
        costPrice: cleanCost,
        salePrice: cleanSale,
        discountPercent: safeDiscount,
        stock: Math.max(0, cleanStock),
        imageUrl: effectiveImageUrl,
        videoUrl: effectiveVideoUrl,
        supplierName: data.supplierName || 'Proveedor Telegram',
        tags: data.tags || null,
        extractedAttributes: effectiveExtractedAttributes,
        status: data.status || 'available',
        rawTelegramMessage: data.rawTelegramMessage || null,
        marketingCopy: data.marketingCopy || null,
      })
      .returning();

    const created = result[0];
    // Sync with local memory/disk cache as well
    const state = storage.getState();
    const existingIdx = state.inventoryItems.findIndex((it) => it.id === created.id);
    if (existingIdx !== -1) {
      state.inventoryItems[existingIdx] = created as any;
    } else {
      state.inventoryItems.unshift(created as any);
    }
    storage.save();

    return created;
  } catch (error) {
    console.error('Error creating inventory item in SQL, fallback to local storage:', error);
    const state = storage.getState();
    const nextId = state.nextId.inventoryItems++;
    const now = new Date().toISOString();
    const newItem = {
      id: nextId,
      userId: data.userId || 1,
      name: data.name,
      sku: finalSku,
      description: data.description || '',
      category: data.category || 'General',
      costPrice: cleanCost,
      salePrice: cleanSale,
      discountPercent: safeDiscount,
      stock: Math.max(0, cleanStock),
      imageUrl: data.imageUrl || null,
      videoUrl: data.videoUrl || null,
      supplierName: data.supplierName || 'Proveedor Telegram',
      tags: data.tags || null,
      extractedAttributes: data.extractedAttributes || null,
      status: data.status || 'available',
      rawTelegramMessage: data.rawTelegramMessage || null,
      marketingCopy: data.marketingCopy || null,
      createdAt: now,
      updatedAt: now,
    };
    state.inventoryItems.unshift(newItem);
    storage.save();
    return newItem;
  }
}

export async function saveProductMarketingCopy(id: number, copyData: any) {
  const jsonString = typeof copyData === 'string' ? copyData : JSON.stringify(copyData);
  return updateInventoryItem(id, { marketingCopy: jsonString });
}

export async function updateInventoryItem(
  id: number,
  data: Partial<typeof inventoryItems.$inferInsert>
) {
  const sanitizedPayload: Record<string, any> = { ...data };
  if (data.costPrice !== undefined) sanitizedPayload.costPrice = cleanNumericString(data.costPrice, '0.00');
  if (data.salePrice !== undefined) sanitizedPayload.salePrice = cleanNumericString(data.salePrice, '0.00');
  if (data.discountPercent !== undefined) sanitizedPayload.discountPercent = cleanInteger(data.discountPercent, 0);
  if (data.stock !== undefined) sanitizedPayload.stock = cleanInteger(data.stock, 0);

  // Automatically persist image locally in /uploads/
  if (data.imageUrl !== undefined && data.imageUrl !== null && data.imageUrl !== '') {
    const persisted = await persistImageLocally(data.imageUrl);
    if (persisted) sanitizedPayload.imageUrl = persisted;
  }

  // Automatically persist video locally if provided
  if (data.videoUrl !== undefined && data.videoUrl !== null && data.videoUrl !== '') {
    const persistedVideo = await persistVideoLocally(data.videoUrl);
    if (persistedVideo) sanitizedPayload.videoUrl = persistedVideo;
  }

  if (data.extractedAttributes !== undefined && data.extractedAttributes !== null && data.extractedAttributes !== '') {
    try {
      const parsed = JSON.parse(data.extractedAttributes);
      if (Array.isArray(parsed.images) && parsed.images.length > 0) {
        parsed.images = await persistImageListLocally(parsed.images);
      }
      if (sanitizedPayload.videoUrl) {
        parsed.videoUrl = sanitizedPayload.videoUrl;
      }
      sanitizedPayload.extractedAttributes = JSON.stringify(parsed);
    } catch {}
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const idx = state.inventoryItems.findIndex((it) => it.id === id);
    if (idx === -1) {
      throw new Error('Item no encontrado en el inventario');
    }

    const updated = {
      ...state.inventoryItems[idx],
      ...sanitizedPayload,
      updatedAt: new Date().toISOString(),
    };
    state.inventoryItems[idx] = updated as any;
    storage.save();
    return updated;
  }

  try {
    const result = await db
      .update(inventoryItems)
      .set({
        ...sanitizedPayload,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, id))
      .returning();

    return result[0];
  } catch (error) {
    console.warn('Error updating inventory item in SQL, fallback to local storage:', error);
    const state = storage.getState();
    const idx = state.inventoryItems.findIndex((it) => it.id === id);
    if (idx !== -1) {
      state.inventoryItems[idx] = {
        ...state.inventoryItems[idx],
        ...data,
        updatedAt: new Date().toISOString(),
      } as any;
      storage.save();
      return state.inventoryItems[idx];
    }
    throw error;
  }
}

export async function deleteInventoryItem(id: number) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    // Unlink telegram messages
    state.telegramMessages.forEach((m) => {
      if (m.inventoryItemId === id) m.inventoryItemId = null;
    });

    const idx = state.inventoryItems.findIndex((it) => it.id === id);
    let deleted = null;
    if (idx !== -1) {
      deleted = state.inventoryItems.splice(idx, 1)[0];
      storage.save();
    }
    return { success: true, deleted };
  }

  try {
    await db
      .update(telegramMessages)
      .set({ inventoryItemId: null })
      .where(eq(telegramMessages.inventoryItemId, id));

    const result = await db.delete(inventoryItems).where(eq(inventoryItems.id, id)).returning();
    return { success: true, deleted: result[0] || null };
  } catch (error) {
    console.warn('Error deleting inventory item from SQL, fallback:', error);
    const state = storage.getState();
    const idx = state.inventoryItems.findIndex((it) => it.id === id);
    let deleted = null;
    if (idx !== -1) {
      deleted = state.inventoryItems.splice(idx, 1)[0];
      storage.save();
    }
    return { success: true, deleted };
  }
}

export async function deleteBulkInventoryItems(ids: number[]) {
  if (!ids || ids.length === 0) {
    return { success: true, count: 0 };
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    state.telegramMessages.forEach((m) => {
      if (m.inventoryItemId && ids.includes(m.inventoryItemId)) {
        m.inventoryItemId = null;
      }
    });

    const initialLen = state.inventoryItems.length;
    const deleted = state.inventoryItems.filter((it) => ids.includes(it.id));
    state.inventoryItems = state.inventoryItems.filter((it) => !ids.includes(it.id));
    storage.save();
    return { success: true, count: initialLen - state.inventoryItems.length, deleted };
  }

  try {
    await db
      .update(telegramMessages)
      .set({ inventoryItemId: null })
      .where(inArray(telegramMessages.inventoryItemId, ids));

    const result = await db
      .delete(inventoryItems)
      .where(inArray(inventoryItems.id, ids))
      .returning();

    return { success: true, count: result.length, deleted: result };
  } catch (error) {
    console.warn('Error bulk deleting in SQL, fallback:', error);
    const state = storage.getState();
    const deleted = state.inventoryItems.filter((it) => ids.includes(it.id));
    state.inventoryItems = state.inventoryItems.filter((it) => !ids.includes(it.id));
    storage.save();
    return { success: true, count: deleted.length, deleted };
  }
}

export async function getTelegramMessages(userId?: number) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const list = state.telegramMessages.map((m) => {
      const inv = m.inventoryItemId ? state.inventoryItems.find((it) => it.id === m.inventoryItemId) : null;
      return {
        ...m,
        inventoryItemName: inv?.name || null,
        inventoryItemSku: inv?.sku || null,
        inventoryItemPrice: inv?.salePrice || null,
      };
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list.slice(0, 100);
  }

  try {
    const query = db
      .select({
        id: telegramMessages.id,
        telegramMessageId: telegramMessages.telegramMessageId,
        senderName: telegramMessages.senderName,
        senderUsername: telegramMessages.senderUsername,
        caption: telegramMessages.caption,
        photoUrl: telegramMessages.photoUrl,
        processedStatus: telegramMessages.processedStatus,
        extractedData: telegramMessages.extractedData,
        inventoryItemId: telegramMessages.inventoryItemId,
        createdAt: telegramMessages.createdAt,
        inventoryItemName: inventoryItems.name,
        inventoryItemSku: inventoryItems.sku,
        inventoryItemPrice: inventoryItems.salePrice,
      })
      .from(telegramMessages)
      .leftJoin(inventoryItems, eq(telegramMessages.inventoryItemId, inventoryItems.id))
      .orderBy(desc(telegramMessages.createdAt))
      .limit(100);

    return await query;
  } catch (error) {
    console.warn('Error fetching telegram messages in SQL, fallback:', error);
    const state = storage.getState();
    return state.telegramMessages.slice(0, 100);
  }
}

export async function createTelegramMessageRecord(data: {
  userId: number;
  telegramMessageId?: string;
  senderName?: string;
  senderUsername?: string;
  caption?: string;
  photoUrl?: string;
  processedStatus?: string;
  extractedData?: string;
  inventoryItemId?: number;
}) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const nextId = state.nextId.telegramMessages++;
    const now = new Date().toISOString();

    const newRecord = {
      id: nextId,
      userId: data.userId || 1,
      telegramMessageId: data.telegramMessageId || null,
      senderName: data.senderName || 'Proveedor',
      senderUsername: data.senderUsername || null,
      caption: data.caption || '',
      photoUrl: data.photoUrl || null,
      processedStatus: data.processedStatus || 'processed',
      extractedData: data.extractedData || null,
      inventoryItemId: data.inventoryItemId || null,
      createdAt: now,
    };

    state.telegramMessages.unshift(newRecord);
    storage.save();
    return newRecord;
  }

  try {
    const targetUserId = await resolveValidUserId(data.userId);
    const result = await db
      .insert(telegramMessages)
      .values({
        userId: targetUserId,
        telegramMessageId: data.telegramMessageId || null,
        senderName: data.senderName || 'Proveedor',
        senderUsername: data.senderUsername || null,
        caption: data.caption || '',
        photoUrl: data.photoUrl || null,
        processedStatus: data.processedStatus || 'processed',
        extractedData: data.extractedData || null,
        inventoryItemId: data.inventoryItemId || null,
      })
      .returning();

    const created = result[0];
    const state = storage.getState();
    state.telegramMessages.unshift(created as any);
    storage.save();

    return created;
  } catch (error) {
    console.warn('Error recording telegram message in SQL, fallback:', error);
    const state = storage.getState();
    const nextId = state.nextId.telegramMessages++;
    const newRecord = {
      id: nextId,
      userId: data.userId || 1,
      telegramMessageId: data.telegramMessageId || null,
      senderName: data.senderName || 'Proveedor',
      senderUsername: data.senderUsername || null,
      caption: data.caption || '',
      photoUrl: data.photoUrl || null,
      processedStatus: data.processedStatus || 'processed',
      extractedData: data.extractedData || null,
      inventoryItemId: data.inventoryItemId || null,
      createdAt: new Date().toISOString(),
    };
    state.telegramMessages.unshift(newRecord);
    storage.save();
    return newRecord;
  }
}

export async function deleteTelegramMessage(id: number) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const idx = state.telegramMessages.findIndex((m) => m.id === id);
    let deleted = null;
    if (idx !== -1) {
      deleted = state.telegramMessages.splice(idx, 1)[0];
      storage.save();
    }
    return { success: true, deleted };
  }

  try {
    const result = await db
      .delete(telegramMessages)
      .where(eq(telegramMessages.id, id))
      .returning();
    return { success: true, deleted: result[0] || null };
  } catch (error) {
    console.warn('Error deleting telegram message in SQL, fallback:', error);
    const state = storage.getState();
    const idx = state.telegramMessages.findIndex((m) => m.id === id);
    let deleted = null;
    if (idx !== -1) {
      deleted = state.telegramMessages.splice(idx, 1)[0];
      storage.save();
    }
    return { success: true, deleted };
  }
}

export async function deleteBulkTelegramMessages(ids: number[]) {
  if (!ids || ids.length === 0) {
    return { success: true, count: 0 };
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const deleted = state.telegramMessages.filter((m) => ids.includes(m.id));
    state.telegramMessages = state.telegramMessages.filter((m) => !ids.includes(m.id));
    storage.save();
    return { success: true, count: deleted.length, deleted };
  }

  try {
    const result = await db
      .delete(telegramMessages)
      .where(inArray(telegramMessages.id, ids))
      .returning();
    return { success: true, count: result.length, deleted: result };
  } catch (error) {
    console.warn('Error deleting bulk telegram messages in SQL, fallback:', error);
    const state = storage.getState();
    const deleted = state.telegramMessages.filter((m) => ids.includes(m.id));
    state.telegramMessages = state.telegramMessages.filter((m) => !ids.includes(m.id));
    storage.save();
    return { success: true, count: deleted.length, deleted };
  }
}

export async function clearAllTelegramMessages(userId?: number) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const count = state.telegramMessages.length;
    state.telegramMessages = [];
    storage.save();
    return { success: true, count };
  }

  try {
    const result = await db
      .delete(telegramMessages)
      .where(userId ? eq(telegramMessages.userId, userId) : undefined)
      .returning();
    return { success: true, count: result.length };
  } catch (error) {
    console.warn('Error clearing telegram messages in SQL, fallback:', error);
    const state = storage.getState();
    const count = state.telegramMessages.length;
    state.telegramMessages = [];
    storage.save();
    return { success: true, count };
  }
}

export async function getTelegramConfig(userId: number = 1) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    let config = state.telegramConfigs.find((c) => c.botToken && c.botToken.trim().length > 0);
    if (config) return config;

    config = state.telegramConfigs.find((c) => c.userId === userId);
    if (config) return config;

    const newConfig = {
      id: state.nextId.telegramConfigs++,
      userId,
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
    };
    state.telegramConfigs.push(newConfig);
    storage.save();
    return newConfig;
  }

  try {
    const configsWithToken = await db
      .select()
      .from(telegramConfigs)
      .where(sql`${telegramConfigs.botToken} IS NOT NULL AND ${telegramConfigs.botToken} != ''`)
      .limit(1);

    if (configsWithToken.length > 0) {
      return configsWithToken[0];
    }

    const configs = await db
      .select()
      .from(telegramConfigs)
      .where(eq(telegramConfigs.userId, userId))
      .limit(1);

    if (configs.length > 0) {
      return configs[0];
    }

    // Check if any telegram_configs row exists at all
    const anyConfig = await db.select().from(telegramConfigs).limit(1);
    if (anyConfig.length > 0) {
      return anyConfig[0];
    }

    // Resolve a valid user ID from users table to prevent FK constraint errors
    let targetUserId = userId || 1;
    const userCheck = await db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).limit(1);
    if (userCheck.length === 0) {
      const anyUser = await db.select({ id: users.id }).from(users).limit(1);
      if (anyUser.length > 0) {
        targetUserId = anyUser[0].id;
      }
    }

    const created = await db
      .insert(telegramConfigs)
      .values({
        userId: targetUserId,
        supplierName: 'Proveedor Telegram Principal',
        defaultMarginPercent: 35,
        currency: 'USD',
        autoApprove: true,
        defaultStockEnabled: false,
        defaultStockQuantity: 10,
      })
      .returning();

    return created[0];
  } catch (error) {
    console.warn('Error fetching telegram config from SQL, fallback to local store:', error);
    const state = storage.getState();
    return state.telegramConfigs[0] || {
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
    };
  }
}

export async function updateTelegramConfig(
  userId: number = 1,
  data: Partial<typeof telegramConfigs.$inferInsert> & {
    default_stock_enabled?: boolean;
    default_stock_quantity?: number;
  }
) {
  // Normalize fields if passed with snake_case
  const normalizedData: any = { ...data };
  if (data.default_stock_enabled !== undefined && data.defaultStockEnabled === undefined) {
    normalizedData.defaultStockEnabled = data.default_stock_enabled;
  }
  if (data.default_stock_quantity !== undefined && data.defaultStockQuantity === undefined) {
    normalizedData.defaultStockQuantity = data.default_stock_quantity;
  }

  // Always update local fallback memory state too
  const state = storage.getState();
  let localConfig = state.telegramConfigs.find((c) => c.userId === userId) || state.telegramConfigs[0];
  if (!localConfig) {
    localConfig = {
      id: state.nextId.telegramConfigs++,
      userId,
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
    };
    state.telegramConfigs.push(localConfig);
  }
  Object.assign(localConfig, normalizedData, { updatedAt: new Date().toISOString() });
  storage.save();

  if (!isPostgresConfigured()) {
    return localConfig;
  }

  try {
    const existing = await getTelegramConfig(userId);

    if (existing && existing.id) {
      const updated = await db
        .update(telegramConfigs)
        .set({
          ...normalizedData,
          updatedAt: new Date(),
        })
        .where(eq(telegramConfigs.id, existing.id))
        .returning();

      if (updated.length > 0) {
        return updated[0];
      }
    }

    // If existing not found or not updated, insert directly
    let targetUserId = userId || 1;
    const userCheck = await db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).limit(1);
    if (userCheck.length === 0) {
      const anyUser = await db.select({ id: users.id }).from(users).limit(1);
      if (anyUser.length > 0) {
        targetUserId = anyUser[0].id;
      }
    }

    const inserted = await db
      .insert(telegramConfigs)
      .values({
        userId: targetUserId,
        supplierName: normalizedData.supplierName || 'Proveedor Telegram Principal',
        botToken: normalizedData.botToken || null,
        defaultMarginPercent: normalizedData.defaultMarginPercent ?? 35,
        currency: normalizedData.currency || 'USD',
        autoApprove: normalizedData.autoApprove ?? true,
        defaultStockEnabled: normalizedData.defaultStockEnabled ?? false,
        defaultStockQuantity: normalizedData.defaultStockQuantity ?? 10,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.warn('Error updating telegram config in SQL, fallback to local store:', error);
    return localConfig;
  }
}

// -------------------------------------------------------------
// GOOGLE GEMINI AI CONFIGURATION HELPERS
// -------------------------------------------------------------

export async function getAiConfig(userId: number = 1) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (!state.aiConfigs) {
      state.aiConfigs = [];
    }
    let config = state.aiConfigs.find((c) => c.apiKey && c.apiKey.trim().length > 0);
    if (config) {
      if (
        config.modelName &&
        (config.modelName.includes('gemini-2.5') ||
          config.modelName.includes('gemini-2.0') ||
          config.modelName.includes('gemini-1.5'))
      ) {
        config.modelName = 'gemini-3.7-flash';
        storage.save();
      }
      return config;
    }

    config = state.aiConfigs.find((c) => c.userId === userId);
    if (config) {
      if (
        config.modelName &&
        (config.modelName.includes('gemini-2.5') ||
          config.modelName.includes('gemini-2.0') ||
          config.modelName.includes('gemini-1.5'))
      ) {
        config.modelName = 'gemini-3.7-flash';
        storage.save();
      }
      return config;
    }

    const newConfig = {
      id: state.nextId?.aiConfigs || 1,
      userId,
      apiKey: null,
      modelName: 'gemini-3.7-flash',
      temperature: 0.2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.aiConfigs.push(newConfig);
    storage.save();
    return newConfig;
  }

  try {
    const configsWithKey = await db
      .select()
      .from(aiConfigs)
      .where(sql`${aiConfigs.apiKey} IS NOT NULL AND ${aiConfigs.apiKey} != ''`)
      .limit(1);

    if (configsWithKey.length > 0) {
      return configsWithKey[0];
    }

    const configs = await db
      .select()
      .from(aiConfigs)
      .where(eq(aiConfigs.userId, userId))
      .limit(1);

    if (configs.length > 0) {
      return configs[0];
    }

    // Check if any ai_configs row exists
    const anyConfig = await db.select().from(aiConfigs).limit(1);
    if (anyConfig.length > 0) {
      return anyConfig[0];
    }

    // Resolve a valid user ID
    let targetUserId = userId || 1;
    const userCheck = await db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).limit(1);
    if (userCheck.length === 0) {
      const anyUser = await db.select({ id: users.id }).from(users).limit(1);
      if (anyUser.length > 0) {
        targetUserId = anyUser[0].id;
      }
    }

    const created = await db
      .insert(aiConfigs)
      .values({
        userId: targetUserId,
        apiKey: null,
        modelName: 'gemini-3.7-flash',
        temperature: '0.20',
      })
      .returning();

    return created[0];
  } catch (error) {
    console.warn('Error fetching ai config from SQL, fallback to local store:', error);
    const state = storage.getState();
    return (state.aiConfigs && state.aiConfigs[0]) || {
      id: 1,
      userId: 1,
      apiKey: null,
      modelName: 'gemini-3.7-flash',
      temperature: 0.2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function updateAiConfig(
  userId: number = 1,
  data: {
    apiKey?: string | null;
    modelName?: string;
    temperature?: number;
  }
) {
  const state = storage.getState();
  if (!state.aiConfigs) state.aiConfigs = [];

  let modelToUse = data.modelName || 'gemini-3.7-flash';
  if (
    modelToUse.includes('gemini-2.5') ||
    modelToUse.includes('gemini-2.0') ||
    modelToUse.includes('gemini-1.5')
  ) {
    modelToUse = 'gemini-3.7-flash';
  }

  let localConfig = state.aiConfigs.find((c) => c.userId === userId);
  if (!localConfig) {
    localConfig = {
      id: (state.nextId?.aiConfigs ? state.nextId.aiConfigs++ : 1),
      userId,
      apiKey: data.apiKey ?? null,
      modelName: modelToUse,
      temperature: data.temperature ?? 0.2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.aiConfigs.push(localConfig);
  } else {
    Object.assign(localConfig, data, {
      modelName: modelToUse,
      updatedAt: new Date().toISOString(),
    });
  }
  storage.save();

  if (!isPostgresConfigured()) {
    return localConfig;
  }

  try {
    const existing = await getAiConfig(userId);

    if (existing && existing.id) {
      const updated = await db
        .update(aiConfigs)
        .set({
          apiKey: data.apiKey !== undefined ? data.apiKey : existing.apiKey,
          modelName: modelToUse,
          temperature:
            data.temperature !== undefined
              ? data.temperature.toString()
              : (existing.temperature?.toString() || '0.20'),
          updatedAt: new Date(),
        })
        .where(eq(aiConfigs.id, existing.id))
        .returning();

      if (updated.length > 0) {
        return updated[0];
      }
    }

    let targetUserId = userId || 1;
    const userCheck = await db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).limit(1);
    if (userCheck.length === 0) {
      const anyUser = await db.select({ id: users.id }).from(users).limit(1);
      if (anyUser.length > 0) {
        targetUserId = anyUser[0].id;
      }
    }

    const inserted = await db
      .insert(aiConfigs)
      .values({
        userId: targetUserId,
        apiKey: data.apiKey ?? null,
        modelName: modelToUse,
        temperature: (data.temperature ?? 0.2).toString(),
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.warn('Error updating ai config in SQL, fallback to local store:', error);
    return localConfig;
  }
}

export async function getInventoryStats(userId?: number) {
  try {
    const items = await getInventoryItems(userId);

    const totalProducts = items.length;
    const totalUnits = items.reduce((acc, it) => acc + (Number(it.stock) || 0), 0);
    const totalCostValue = items.reduce(
      (acc, it) => acc + (Number(it.costPrice) || 0) * (Number(it.stock) || 0),
      0
    );
    const totalSaleValue = items.reduce(
      (acc, it) => acc + (Number(it.salePrice) || 0) * (Number(it.stock) || 0),
      0
    );
    const estimatedProfit = totalSaleValue - totalCostValue;

    let totalDiscountValue = 0;
    let totalDiscountedSaleValue = 0;
    let discountedProductsCount = 0;

    items.forEach((it) => {
      const regular = Number(it.salePrice) || 0;
      const stock = Number(it.stock) || 0;
      const disc = Math.max(0, Math.min(100, Number(it.discountPercent) || 0));
      if (disc > 0) {
        discountedProductsCount += 1;
        const discountAmountPerUnit = regular * (disc / 100);
        totalDiscountValue += discountAmountPerUnit * stock;
        const effectiveSalePerUnit = regular * (1 - disc / 100);
        totalDiscountedSaleValue += effectiveSalePerUnit * stock;
      } else {
        totalDiscountedSaleValue += regular * stock;
      }
    });

    const profitWithDiscounts = totalDiscountedSaleValue - totalCostValue;

    const categoryMap: Record<string, { count: number; stock: number }> = {};
    for (const item of items) {
      const cat = item.category || 'General';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { count: 0, stock: 0 };
      }
      categoryMap[cat].count += 1;
      categoryMap[cat].stock += Number(item.stock) || 0;
    }

    return {
      totalProducts,
      totalUnits,
      totalCostValue: Math.round(totalCostValue * 100) / 100,
      totalSaleValue: Math.round(totalSaleValue * 100) / 100,
      estimatedProfit: Math.round(estimatedProfit * 100) / 100,
      totalDiscountValue: Math.round(totalDiscountValue * 100) / 100,
      totalDiscountedSaleValue: Math.round(totalDiscountedSaleValue * 100) / 100,
      profitWithDiscounts: Math.round(profitWithDiscounts * 100) / 100,
      discountedProductsCount,
      categories: Object.entries(categoryMap).map(([name, data]) => ({
        name,
        count: data.count,
        stock: data.stock,
      })),
    };
  } catch (error) {
    console.error('Error computing inventory stats:', error);
    return {
      totalProducts: 0,
      totalUnits: 0,
      totalCostValue: 0,
      totalSaleValue: 0,
      estimatedProfit: 0,
      totalDiscountValue: 0,
      totalDiscountedSaleValue: 0,
      profitWithDiscounts: 0,
      discountedProductsCount: 0,
      categories: [],
    };
  }
}

// -------------------------------------------------------------
// STOREFRONT & CUSTOMER ORDERS HELPERS
// -------------------------------------------------------------

function parseThemeAndColors(rawTheme: string | null | undefined): { theme: string; themeColors?: Record<string, string[]> } {
  if (!rawTheme) return { theme: 'classic' };
  if (rawTheme.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawTheme);
      return {
        theme: parsed.theme || parsed.active || 'classic',
        themeColors: parsed.colors || parsed.themeColors || undefined,
      };
    } catch {}
  }
  if (rawTheme.includes(':::')) {
    try {
      const [themeName, colorsJson] = rawTheme.split(':::');
      return {
        theme: themeName || 'classic',
        themeColors: JSON.parse(colorsJson),
      };
    } catch {}
  }
  return { theme: rawTheme };
}

export async function getStoreConfig(userId: number = 1) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (state.storeConfigs.length > 0) {
      const cfg = state.storeConfigs[0];
      const { theme, themeColors } = parseThemeAndColors(cfg.theme);
      const showOutOfStock = cfg.showOutOfStock !== undefined ? cfg.showOutOfStock : true;
      return { ...cfg, theme, themeColors, showOutOfStock: Boolean(showOutOfStock) };
    }
    const defaultConfig = {
      id: 1,
      userId: userId || 1,
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
      websiteUrl: null,
      address: null,
      logoUrl: null,
      courierLogos: null,
      paymentLogos: null,
      theme: 'classic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.storeConfigs.push(defaultConfig);
    storage.save();
    return defaultConfig;
  }

  try {
    const configs = await db
      .select()
      .from(storeConfigs)
      .orderBy(desc(storeConfigs.updatedAt), desc(storeConfigs.id))
      .limit(1);

    if (configs.length > 0) {
      const cfg = configs[0];
      const { theme, themeColors } = parseThemeAndColors(cfg.theme);
      const showOutOfStock = cfg.showOutOfStock !== undefined ? cfg.showOutOfStock : true;
      return { ...cfg, theme, themeColors, showOutOfStock: Boolean(showOutOfStock) };
    }

    const created = await db
      .insert(storeConfigs)
      .values({
        userId: userId || 1,
        storeName: 'Comerxia Store',
        whatsappNumber: '',
        description: 'Catálogo digital con envíos y pedidos directos por WhatsApp',
        bannerText: '🔥 ¡Catálogo actualizado con las últimas novedades en stock!',
        deliveryFee: '0.00',
        minOrderAmount: '0.00',
        currency: 'USD',
        showStock: true,
        showOutOfStock: true,
        websiteUrl: null,
        logoUrl: null,
        courierLogos: null,
        paymentLogos: null,
        theme: 'classic',
      })
      .returning();

    const cfg = created[0];
    const { theme, themeColors } = parseThemeAndColors(cfg.theme);
    const showOutOfStock = cfg.showOutOfStock !== undefined ? cfg.showOutOfStock : true;
    return { ...cfg, theme, themeColors, showOutOfStock: Boolean(showOutOfStock) };
  } catch (error) {
    console.warn('Error fetching store config from SQL, fallback to local store:', error);
    const state = storage.getState();
    const cfg = state.storeConfigs[0];
    if (cfg) {
      const { theme, themeColors } = parseThemeAndColors(cfg.theme);
      const showOutOfStock = cfg.showOutOfStock !== undefined ? cfg.showOutOfStock : true;
      return { ...cfg, theme, themeColors, showOutOfStock: Boolean(showOutOfStock) };
    }
    return cfg;
  }
}

export async function updateStoreConfig(
  userId: number = 1,
  data: Partial<typeof storeConfigs.$inferInsert> & Record<string, any>
) {
  const updatePayload: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (data.storeName !== undefined) updatePayload.storeName = String(data.storeName).trim();
  if (data.whatsappNumber !== undefined || data.whatsapp_number !== undefined) {
    const rawNum = data.whatsappNumber !== undefined ? data.whatsappNumber : data.whatsapp_number;
    const normalized = normalizeEcuadorPhone(String(rawNum || ''));
    updatePayload.whatsappNumber = normalized.international || String(rawNum || '').trim();
  }
  if (data.description !== undefined) updatePayload.description = String(data.description).trim();
  if (data.bannerText !== undefined) updatePayload.bannerText = String(data.bannerText).trim();
  if (data.banner_text !== undefined) updatePayload.bannerText = String(data.banner_text).trim();
  if (data.deliveryFee !== undefined) updatePayload.deliveryFee = String(Number(data.deliveryFee) || 0);
  if (data.delivery_fee !== undefined) updatePayload.deliveryFee = String(Number(data.delivery_fee) || 0);
  if (data.minOrderAmount !== undefined) updatePayload.minOrderAmount = String(Number(data.minOrderAmount) || 0);
  if (data.min_order_amount !== undefined) updatePayload.minOrderAmount = String(Number(data.min_order_amount) || 0);
  if (data.currency !== undefined) updatePayload.currency = String(data.currency).trim();
  if (data.showStock !== undefined || data.show_stock !== undefined) {
    const rawVal = data.showStock !== undefined ? data.showStock : data.show_stock;
    updatePayload.showStock = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === '1';
  }
  if (data.showOutOfStock !== undefined || data.show_out_of_stock !== undefined) {
    const rawVal = data.showOutOfStock !== undefined ? data.showOutOfStock : data.show_out_of_stock;
    updatePayload.showOutOfStock = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === '1';
  }
  if (data.instagramUrl !== undefined) updatePayload.instagramUrl = data.instagramUrl ? String(data.instagramUrl).trim() : null;
  if (data.instagram_url !== undefined) updatePayload.instagramUrl = data.instagram_url ? String(data.instagram_url).trim() : null;
  if (data.websiteUrl !== undefined) updatePayload.websiteUrl = data.websiteUrl ? String(data.websiteUrl).trim() : null;
  if (data.website_url !== undefined) updatePayload.websiteUrl = data.website_url ? String(data.website_url).trim() : null;
  if (data.address !== undefined) updatePayload.address = data.address ? String(data.address).trim() : null;
  if (data.logoUrl !== undefined) updatePayload.logoUrl = data.logoUrl ? String(data.logoUrl).trim() : null;
  if (data.logo_url !== undefined) updatePayload.logoUrl = data.logo_url ? String(data.logo_url).trim() : null;
  if (data.courierLogos !== undefined) {
    updatePayload.courierLogos = typeof data.courierLogos === 'string' ? data.courierLogos : JSON.stringify(data.courierLogos);
  }
  if (data.courier_logos !== undefined) {
    updatePayload.courierLogos = typeof data.courier_logos === 'string' ? data.courier_logos : JSON.stringify(data.courier_logos);
  }
  if (data.paymentLogos !== undefined) {
    updatePayload.paymentLogos = typeof data.paymentLogos === 'string' ? data.paymentLogos : JSON.stringify(data.paymentLogos);
  }
  if (data.payment_logos !== undefined) {
    updatePayload.paymentLogos = typeof data.payment_logos === 'string' ? data.payment_logos : JSON.stringify(data.payment_logos);
  }
  if (data.promoPopup !== undefined) {
    updatePayload.promoPopup = typeof data.promoPopup === 'string' ? data.promoPopup : JSON.stringify(data.promoPopup);
  }
  if (data.promo_popup !== undefined) {
    updatePayload.promoPopup = typeof data.promo_popup === 'string' ? data.promo_popup : JSON.stringify(data.promo_popup);
  }
  
  const rawTheme = data.theme !== undefined ? String(data.theme).trim() : undefined;
  const rawThemeColors = data.themeColors !== undefined ? data.themeColors : data.theme_colors;

  if (rawTheme !== undefined || rawThemeColors !== undefined) {
    const existing = (await getStoreConfig(userId)) as any;
    const effectiveTheme = rawTheme || existing?.theme || 'classic';
    const effectiveColors = rawThemeColors !== undefined ? rawThemeColors : existing?.themeColors;

    if (effectiveColors) {
      const colorsObj = typeof effectiveColors === 'string' ? JSON.parse(effectiveColors) : effectiveColors;
      updatePayload.theme = JSON.stringify({ theme: effectiveTheme, colors: colorsObj });
    } else {
      updatePayload.theme = effectiveTheme;
    }
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    let current = state.storeConfigs[0];
    if (!current) {
      current = {
        id: 1,
        userId: userId || 1,
        storeName: 'Comerxia Store',
        whatsappNumber: '+593983302390',
        description: 'Catálogo digital con envíos y pedidos directos por WhatsApp',
        bannerText: '🔥 ¡Catálogo actualizado con las últimas novedades en stock!',
        deliveryFee: '0.00',
        minOrderAmount: '0.00',
        currency: 'USD',
        showStock: true,
        instagramUrl: null,
        address: null,
        logoUrl: null,
        courierLogos: null,
        paymentLogos: null,
        theme: 'classic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.storeConfigs.push(current);
    }
    Object.assign(current, updatePayload, { updatedAt: new Date().toISOString() });
    storage.save();
    const { theme, themeColors } = parseThemeAndColors(current.theme);
    return { ...current, theme, themeColors };
  }

  try {
    const existing = await getStoreConfig(userId);

    if (existing && existing.id) {
      const updated = await db
        .update(storeConfigs)
        .set(updatePayload)
        .where(eq(storeConfigs.id, existing.id))
        .returning();

      const cfg = updated[0];
      const { theme, themeColors } = parseThemeAndColors(cfg.theme);
      return { ...cfg, theme, themeColors };
    } else {
      const targetUserId = await resolveValidUserId(userId);
      const created = await db
        .insert(storeConfigs)
        .values({
          userId: targetUserId,
          storeName: updatePayload.storeName || 'Comerxia Store',
          whatsappNumber: updatePayload.whatsappNumber || '',
          description: updatePayload.description || 'Catálogo digital con envíos y pedidos directos',
          bannerText: updatePayload.bannerText || '🔥 ¡Catálogo actualizado con las últimas novedades en stock!',
          deliveryFee: updatePayload.deliveryFee || '0.00',
          minOrderAmount: updatePayload.minOrderAmount || '0.00',
          currency: updatePayload.currency || 'USD',
          ...updatePayload,
        })
        .returning();

      const cfg = created[0];
      const { theme, themeColors } = parseThemeAndColors(cfg.theme);
      return { ...cfg, theme, themeColors };
    }
  } catch (error) {
    console.warn('Error updating store config in SQL, fallback to local store:', error);
    const state = storage.getState();
    const current = state.storeConfigs[0];
    if (current) {
      Object.assign(current, updatePayload, { updatedAt: new Date().toISOString() });
      storage.save();
      const { theme, themeColors } = parseThemeAndColors(current.theme);
      return { ...current, theme, themeColors };
    }
    const { theme, themeColors } = parseThemeAndColors(updatePayload.theme);
    return { ...updatePayload, id: 1, userId, theme, themeColors };
  }
}

// -------------------------------------------------------------
// SERVER DOMAIN & SUBDOMAIN ROUTING HELPERS
// -------------------------------------------------------------

export async function getServerDomainConfig(userId: number = 1) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (state.serverDomainConfigs && state.serverDomainConfigs.length > 0) {
      return state.serverDomainConfigs[0];
    }
    const defaultDomainConfig = {
      id: 1,
      userId: userId || 1,
      adminDomain: 'admin.dominio1.com',
      storeDomain: 'www.dominio1.com, dominio1.com',
      autoRouting: true,
      defaultFallbackView: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!state.serverDomainConfigs) state.serverDomainConfigs = [];
    state.serverDomainConfigs.push(defaultDomainConfig);
    storage.save();
    return defaultDomainConfig;
  }

  try {
    const configs = await db
      .select()
      .from(serverDomainConfigs)
      .orderBy(desc(serverDomainConfigs.updatedAt), desc(serverDomainConfigs.id))
      .limit(1);

    if (configs.length > 0) {
      return configs[0];
    }

    const targetUserId = await resolveValidUserId(userId);
    const created = await db
      .insert(serverDomainConfigs)
      .values({
        userId: targetUserId,
        adminDomain: 'admin.dominio1.com',
        storeDomain: 'www.dominio1.com, dominio1.com',
        autoRouting: true,
        defaultFallbackView: 'admin',
      })
      .returning();

    return created[0];
  } catch (error) {
    console.warn('Error fetching server domain config from SQL, fallback to local store:', error);
    const state = storage.getState();
    return (
      (state.serverDomainConfigs && state.serverDomainConfigs[0]) || {
        id: 1,
        userId: userId || 1,
        adminDomain: 'admin.dominio1.com',
        storeDomain: 'www.dominio1.com, dominio1.com',
        autoRouting: true,
        defaultFallbackView: 'admin',
      }
    );
  }
}

export async function updateServerDomainConfig(
  userId: number = 1,
  data: {
    adminDomain?: string;
    storeDomain?: string;
    autoRouting?: boolean;
    defaultFallbackView?: 'store' | 'admin' | string;
  }
) {
  const updatePayload: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (data.adminDomain !== undefined) updatePayload.adminDomain = String(data.adminDomain).trim();
  if (data.storeDomain !== undefined) updatePayload.storeDomain = String(data.storeDomain).trim();
  if (data.autoRouting !== undefined) updatePayload.autoRouting = Boolean(data.autoRouting);
  if (data.defaultFallbackView !== undefined) {
    updatePayload.defaultFallbackView = data.defaultFallbackView === 'admin' ? 'admin' : 'store';
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (!state.serverDomainConfigs) state.serverDomainConfigs = [];
    let current = state.serverDomainConfigs[0];
    if (!current) {
      current = {
        id: 1,
        userId: userId || 1,
        adminDomain: 'admin.dominio1.com',
        storeDomain: 'www.dominio1.com, dominio1.com',
        autoRouting: true,
        defaultFallbackView: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.serverDomainConfigs.push(current);
    }
    Object.assign(current, updatePayload, { updatedAt: new Date().toISOString() });
    storage.save();
    return current;
  }

  try {
    const existing = await getServerDomainConfig(userId);

    if (existing && existing.id) {
      const updated = await db
        .update(serverDomainConfigs)
        .set(updatePayload)
        .where(eq(serverDomainConfigs.id, existing.id))
        .returning();

      return updated[0];
    } else {
      const targetUserId = await resolveValidUserId(userId);
      const created = await db
        .insert(serverDomainConfigs)
        .values({
          userId: targetUserId,
          adminDomain: updatePayload.adminDomain || 'admin.dominio1.com',
          storeDomain: updatePayload.storeDomain || 'www.dominio1.com, dominio1.com',
          autoRouting: updatePayload.autoRouting !== undefined ? updatePayload.autoRouting : true,
          defaultFallbackView: updatePayload.defaultFallbackView || 'admin',
          ...updatePayload,
        })
        .returning();

      return created[0];
    }
  } catch (error) {
    console.warn('Error updating server domain config in SQL, fallback to local store:', error);
    const state = storage.getState();
    if (state.serverDomainConfigs && state.serverDomainConfigs[0]) {
      Object.assign(state.serverDomainConfigs[0], updatePayload, { updatedAt: new Date().toISOString() });
      storage.save();
      return state.serverDomainConfigs[0];
    }
    throw error;
  }
}

// -------------------------------------------------------------
// STOCK MANAGEMENT ON FINALIZED SALES (OPTION A & B)
// -------------------------------------------------------------

/**
 * Helper to check if an order status represents a finalized/concrete sale where stock must be deducted.
 */
export function isFinalizedSaleStatus(status?: string | null): boolean {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'confirmed' || s === 'shipped' || s === 'delivered';
}

/**
 * Adjusts inventory stock for an array of cart/order/purchase items.
 * @param items Array of items { id, inventoryItemId, sku, name, quantity, costPrice, salePrice, ... }
 * @param multiplier -1 to deduct stock (sale finalized), +1 to restore or add stock (purchase received / order cancelled)
 */
export async function adjustInventoryStockForItems(items: any[] | string, multiplier: number, defaultUserId: number = 1) {
  if (!multiplier || multiplier === 0) return;
  let parsedItems: any[] = [];
  if (typeof items === 'string') {
    try {
      parsedItems = JSON.parse(items);
    } catch {
      parsedItems = [];
    }
  } else if (Array.isArray(items)) {
    parsedItems = items;
  }

  if (!Array.isArray(parsedItems) || parsedItems.length === 0) return;

  const now = new Date();

  for (const cartItem of parsedItems) {
    if (!cartItem) continue;
    const rawId = cartItem.id || cartItem.inventoryItemId || cartItem.inventoryId || cartItem.item?.id || cartItem.productId;
    const itemId = rawId ? Number(rawId) : NaN;
    const rawSku = cartItem.sku ? String(cartItem.sku).trim() : (cartItem.item?.sku ? String(cartItem.item.sku).trim() : '');
    const rawName = cartItem.name ? String(cartItem.name).trim() : (cartItem.item?.name ? String(cartItem.item.name).trim() : '');
    const qty = Number(cartItem.quantity) || 1;
    if (qty <= 0) continue;

    const delta = multiplier * qty; // e.g. +1 * 5 = +5 (received purchase stock addition)

    let foundDbItem: any = null;

    if (isPostgresConfigured()) {
      try {
        if (!isNaN(itemId) && itemId > 0) {
          const [found] = await db
            .select()
            .from(inventoryItems)
            .where(eq(inventoryItems.id, itemId))
            .limit(1);
          foundDbItem = found;
        }

        if (!foundDbItem && rawSku) {
          const [foundBySku] = await db
            .select()
            .from(inventoryItems)
            .where(ilike(inventoryItems.sku, rawSku))
            .limit(1);
          foundDbItem = foundBySku;
        }

        if (!foundDbItem && rawName) {
          const [foundByName] = await db
            .select()
            .from(inventoryItems)
            .where(ilike(inventoryItems.name, rawName))
            .limit(1);
          foundDbItem = foundByName;
        }

        if (foundDbItem) {
          const currentStock = Number(foundDbItem.stock) || 0;
          const newStock = Math.max(0, currentStock + delta);
          let newStatus = foundDbItem.status;
          if (newStock === 0) {
            newStatus = 'sold_out';
          } else if (newStock <= 2) {
            newStatus = 'low_stock';
          } else if (foundDbItem.status === 'sold_out' || foundDbItem.status === 'low_stock') {
            newStatus = 'available';
          }

          await db
            .update(inventoryItems)
            .set({ stock: newStock, status: newStatus, updatedAt: now })
            .where(eq(inventoryItems.id, foundDbItem.id));
        } else if (multiplier > 0 && (rawName || rawSku)) {
          // If item is completely new and being received in a purchase, auto-create it in inventory
          const targetUserId = await resolveValidUserId(defaultUserId);
          const costVal = cleanNumericString(cartItem.costPrice || cartItem.salePrice || '0.00');
          const saleVal = cleanNumericString(cartItem.salePrice || (Number(costVal) * 1.3).toFixed(2));
          const [created] = await db
            .insert(inventoryItems)
            .values({
              userId: targetUserId,
              name: rawName || `Producto ${rawSku || Date.now().toString().slice(-4)}`,
              sku: rawSku || `SKU-${Date.now().toString().slice(-6)}`,
              description: 'Ingresado automáticamente desde orden de compra a proveedor',
              category: 'General',
              costPrice: costVal,
              salePrice: saleVal,
              stock: Math.max(0, qty),
              imageUrl: cartItem.imageUrl || null,
              supplierName: cartItem.supplierName || 'Proveedor',
              status: 'available',
            })
            .returning();
          foundDbItem = created;
        }
      } catch (sqlErr) {
        console.warn('Postgres stock adjustment error for item', rawId, rawSku, rawName, sqlErr);
      }
    }

    // Always keep in-memory / fallback storage in sync
    const state = storage.getState();
    if (!state.inventoryItems) state.inventoryItems = [];
    
    let localInv = state.inventoryItems.find((it) => 
      (foundDbItem && it.id === foundDbItem.id) ||
      (!isNaN(itemId) && itemId > 0 && it.id === itemId) ||
      (rawSku && it.sku && it.sku.trim().toLowerCase() === rawSku.toLowerCase()) ||
      (rawName && it.name && it.name.trim().toLowerCase() === rawName.toLowerCase())
    );

    if (localInv) {
      const currentStock = Number(localInv.stock) || 0;
      const newStock = Math.max(0, currentStock + delta);
      let newStatus = localInv.status;
      if (newStock === 0) {
        newStatus = 'sold_out';
      } else if (newStock <= 2) {
        newStatus = 'low_stock';
      } else if (localInv.status === 'sold_out' || localInv.status === 'low_stock') {
        newStatus = 'available';
      }
      localInv.stock = newStock;
      localInv.status = newStatus as any;
      localInv.updatedAt = now.toISOString();
    } else if (multiplier > 0 && (rawName || rawSku)) {
      const nextId = (state.nextId?.inventoryItems || (state.inventoryItems.length + 1));
      if (state.nextId) state.nextId.inventoryItems = nextId + 1;
      const costVal = cleanNumericString(cartItem.costPrice || cartItem.salePrice || '0.00');
      const saleVal = cleanNumericString(cartItem.salePrice || (Number(costVal) * 1.3).toFixed(2));
      const newItem = {
        id: foundDbItem ? foundDbItem.id : nextId,
        userId: defaultUserId,
        name: rawName || `Producto ${rawSku || Date.now().toString().slice(-4)}`,
        sku: rawSku || `SKU-${Date.now().toString().slice(-6)}`,
        description: 'Ingresado automáticamente desde orden de compra a proveedor',
        category: 'General',
        costPrice: costVal,
        salePrice: saleVal,
        stock: Math.max(0, qty),
        imageUrl: cartItem.imageUrl || null,
        supplierName: cartItem.supplierName || 'Proveedor',
        status: 'available' as any,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      state.inventoryItems.unshift(newItem as any);
    }
  }

  storage.save();
}

export async function createCustomerOrder(data: {
  userId?: number;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerCi?: string;
  ci?: string;
  items: any[];
  totalAmount: number | string;
  paymentMethod?: string;
  status?: string;
  paymentVoucher?: string;
  notes?: string;
  decrementStock?: boolean;
}) {
  const userId = data.userId || 1;
  const orderNumber = `PED-${Date.now().toString().slice(-6)}`;
  const normalizedPhone = normalizeEcuadorPhone(data.customerPhone);
  const cleanCustomerPhone = normalizedPhone.local || data.customerPhone;
  const cleanTotal = cleanNumericString(data.totalAmount, '0.00');
  const cleanCi = (data.customerCi || data.ci || '').trim() || null;
  const initialStatus = data.status || 'pending';
  const shouldDecrementNow = isFinalizedSaleStatus(initialStatus);

  // Check inventory to determine if any item in the order is out of stock / on-demand
  let hasOutOfStockItems = false;
  try {
    const currentInventory = await getInventoryItems();
    if (Array.isArray(data.items)) {
      for (const it of data.items) {
        const invItem = currentInventory.find(
          (inv) =>
            inv.id === it.id ||
            inv.id === it.inventoryItemId ||
            (inv.sku && it.sku && inv.sku.toLowerCase() === it.sku.toLowerCase()) ||
            (inv.name && it.name && inv.name.trim().toLowerCase() === it.name.trim().toLowerCase())
        );
        const currentStock = invItem ? Number(invItem.stock || 0) : 0;
        const requestedQty = Number(it.quantity || 1);
        if (currentStock < requestedQty || currentStock <= 0) {
          hasOutOfStockItems = true;
          break;
        }
      }
    }
  } catch (invErr) {
    console.warn('Could not check inventory stock for new order:', invErr);
  }

  const initialFulfillmentStatus = hasOutOfStockItems ? 'supplier_pending' : 'in_stock';
  let initialNotes = data.notes || '';
  if (hasOutOfStockItems && !initialNotes.includes('[Bajo Pedido]')) {
    initialNotes = (initialNotes ? initialNotes + '\n' : '') + '🔍 [Bajo Pedido] Consultando al proveedor la disponibilidad';
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const nextId = state.nextId.customerOrders++;
    const now = new Date().toISOString();

    const newOrder: any = {
      id: nextId,
      userId,
      orderNumber,
      customerName: data.customerName,
      customerPhone: cleanCustomerPhone,
      customerCi: cleanCi,
      ci: cleanCi,
      customerAddress: data.customerAddress || '',
      items: typeof data.items === 'string' ? data.items : JSON.stringify(data.items),
      totalAmount: cleanTotal,
      paymentMethod: data.paymentMethod || 'whatsapp',
      status: initialStatus,
      paymentVoucher: data.paymentVoucher || null,
      notes: initialNotes,
      trackingNumber: null,
      trackingCarrier: null,
      trackingNotes: null,
      fulfillmentStatus: initialFulfillmentStatus,
      linkedPurchaseId: null,
      linkedPurchaseNumber: null,
      createdAt: now,
    };

    state.customerOrders.unshift(newOrder);

    // Stock only decrements if sale is already finalized (e.g. confirmed/shipped/delivered) and in stock
    if (shouldDecrementNow && !hasOutOfStockItems && Array.isArray(data.items)) {
      await adjustInventoryStockForItems(data.items, -1);
    }

    storage.save();
    try {
      await upsertCustomerFromOrder(newOrder, userId);
    } catch {}

    // Auto-generate supplier purchase order if any item is out of stock / under demand
    if (hasOutOfStockItems) {
      try {
        const purchaseRes = await autoGeneratePurchaseForOrder(newOrder.id, userId);
        if (purchaseRes && purchaseRes.purchase) {
          newOrder.linkedPurchaseId = purchaseRes.purchase.id;
          newOrder.linkedPurchaseNumber = purchaseRes.purchaseNumber;
          storage.save();
        }
      } catch (pErr) {
        console.warn('Could not auto-generate purchase order in fallback storage:', pErr);
      }
    }

    return {
      success: true,
      order: newOrder,
      orderNumber,
    };
  }

  try {
    const targetUserId = await resolveValidUserId(data.userId);
    const result = await db
      .insert(customerOrders)
      .values({
        userId: targetUserId,
        orderNumber,
        customerName: data.customerName,
        customerPhone: cleanCustomerPhone,
        customerCi: cleanCi,
        customerAddress: data.customerAddress || '',
        items: typeof data.items === 'string' ? data.items : JSON.stringify(data.items),
        totalAmount: cleanTotal,
        paymentMethod: data.paymentMethod || 'whatsapp',
        status: initialStatus,
        paymentVoucher: data.paymentVoucher || null,
        notes: initialNotes,
        fulfillmentStatus: initialFulfillmentStatus,
      })
      .returning();

    if (shouldDecrementNow && !hasOutOfStockItems && Array.isArray(data.items)) {
      await adjustInventoryStockForItems(data.items, -1);
    }

    const createdOrder = result[0];
    const state = storage.getState();
    state.customerOrders.unshift(createdOrder as any);
    storage.save();

    try {
      await upsertCustomerFromOrder(createdOrder, targetUserId);
    } catch {}

    // Auto-generate supplier purchase order if any item is out of stock / under demand
    if (hasOutOfStockItems) {
      try {
        const purchaseRes = await autoGeneratePurchaseForOrder(createdOrder.id, targetUserId);
        if (purchaseRes && purchaseRes.purchase) {
          (createdOrder as any).linkedPurchaseId = purchaseRes.purchase.id;
          (createdOrder as any).linkedPurchaseNumber = purchaseRes.purchaseNumber;
        }
      } catch (pErr) {
        console.warn('Could not auto-generate purchase order in SQL:', pErr);
      }
    }

    return {
      success: true,
      order: createdOrder,
      orderNumber,
    };
  } catch (error) {
    console.error('Error creating customer order in SQL, fallback to local store:', error);
    const state = storage.getState();
    const nextId = state.nextId.customerOrders++;
    const now = new Date().toISOString();
    const newOrder: any = {
      id: nextId,
      userId,
      orderNumber,
      customerName: data.customerName,
      customerPhone: cleanCustomerPhone,
      customerCi: cleanCi,
      ci: cleanCi,
      customerAddress: data.customerAddress || '',
      items: typeof data.items === 'string' ? data.items : JSON.stringify(data.items),
      totalAmount: cleanTotal,
      paymentMethod: data.paymentMethod || 'whatsapp',
      status: initialStatus,
      paymentVoucher: data.paymentVoucher || null,
      notes: initialNotes,
      trackingNumber: null,
      trackingCarrier: null,
      trackingNotes: null,
      fulfillmentStatus: initialFulfillmentStatus,
      linkedPurchaseId: null,
      linkedPurchaseNumber: null,
      createdAt: now,
    };
    state.customerOrders.unshift(newOrder);

    if (shouldDecrementNow && !hasOutOfStockItems && Array.isArray(data.items)) {
      await adjustInventoryStockForItems(data.items, -1);
    }

    storage.save();

    try {
      await upsertCustomerFromOrder(newOrder, userId);
    } catch {}

    if (hasOutOfStockItems) {
      try {
        const purchaseRes = await autoGeneratePurchaseForOrder(newOrder.id, userId);
        if (purchaseRes && purchaseRes.purchase) {
          newOrder.linkedPurchaseId = purchaseRes.purchase.id;
          newOrder.linkedPurchaseNumber = purchaseRes.purchaseNumber;
          storage.save();
        }
      } catch (pErr) {
        console.warn('Could not auto-generate purchase order fallback:', pErr);
      }
    }

    return {
      success: true,
      order: newOrder,
      orderNumber,
    };
  }
}

export async function getCustomerOrders(userId?: number) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const list = [...state.customerOrders];
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list.map((ord) => {
      let parsedItems = [];
      try {
        parsedItems = JSON.parse(ord.items);
      } catch {}
      return {
        ...ord,
        items: parsedItems,
      };
    });
  }

  try {
    const orders = await db
      .select()
      .from(customerOrders)
      .orderBy(desc(customerOrders.createdAt));

    return orders.map((ord) => {
      let parsedItems = [];
      try {
        parsedItems = JSON.parse(ord.items);
      } catch {}
      return {
        ...ord,
        items: parsedItems,
      };
    });
  } catch (error) {
    console.warn('Error fetching customer orders from SQL, fallback to local store:', error);
    const state = storage.getState();
    return state.customerOrders.map((ord) => {
      let parsedItems = [];
      try {
        parsedItems = JSON.parse(ord.items);
      } catch {}
      return {
        ...ord,
        items: parsedItems,
      };
    });
  }
}

export async function updateCustomerOrderStatus(
  id: number,
  status: string,
  paymentVoucher?: string,
  notes?: string,
  trackingNumber?: string,
  trackingCarrier?: string,
  trackingNotes?: string
) {
  const updatePayload: Record<string, any> = { status };
  if (paymentVoucher !== undefined) updatePayload.paymentVoucher = paymentVoucher;
  if (notes !== undefined) updatePayload.notes = notes;
  if (trackingNumber !== undefined) updatePayload.trackingNumber = trackingNumber;
  if (trackingCarrier !== undefined) updatePayload.trackingCarrier = trackingCarrier;
  if (trackingNotes !== undefined) updatePayload.trackingNotes = trackingNotes;

  // Retrieve existing order first to compare previous status & stock impact
  let existingOrder: any = null;
  if (isPostgresConfigured()) {
    try {
      const [ord] = await db
        .select()
        .from(customerOrders)
        .where(eq(customerOrders.id, id))
        .limit(1);
      existingOrder = ord || null;
    } catch {}
  }
  if (!existingOrder) {
    const state = storage.getState();
    existingOrder = state.customerOrders.find((o) => o.id === id) || null;
  }

  if (!existingOrder) {
    throw new Error('Pedido no encontrado');
  }

  const prevStatus = existingOrder.status;
  const wasFinalized = isFinalizedSaleStatus(prevStatus);
  const isNowFinalized = isFinalizedSaleStatus(status);

  // Automatic Stock Transition:
  // Case 1: Sale finalized (pending -> confirmed/shipped/delivered) -> deduct stock (-1)
  if (!wasFinalized && isNowFinalized) {
    await adjustInventoryStockForItems(existingOrder.items, -1);
  }
  // Case 2: Sale un-finalized/cancelled (confirmed/shipped/delivered -> pending/cancelled) -> restore stock (+1)
  else if (wasFinalized && !isNowFinalized) {
    await adjustInventoryStockForItems(existingOrder.items, 1);
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const ord = state.customerOrders.find((o) => o.id === id);
    if (!ord) throw new Error('Pedido no encontrado');
    Object.assign(ord, updatePayload);
    storage.save();

    try {
      await upsertCustomerFromOrder(ord);
    } catch {}

    return ord;
  }

  try {
    const result = await db
      .update(customerOrders)
      .set(updatePayload)
      .where(eq(customerOrders.id, id))
      .returning();

    if (result[0]) {
      const state = storage.getState();
      const localOrd = state.customerOrders.find((o) => o.id === id);
      if (localOrd) {
        Object.assign(localOrd, updatePayload);
        storage.save();
      }

      try {
        await upsertCustomerFromOrder(result[0]);
      } catch {}
    }

    return result[0];
  } catch (error) {
    console.warn('Error updating order status in SQL, fallback to local store:', error);
    const state = storage.getState();
    const ord = state.customerOrders.find((o) => o.id === id);
    if (ord) {
      Object.assign(ord, updatePayload);
      storage.save();
      try {
        await upsertCustomerFromOrder(ord);
      } catch {}
      return ord;
    }
    throw error;
  }
}

export async function updateCustomerOrder(
  id: number,
  data: {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCi?: string | null;
  ci?: string | null;
  items?: any[];
  totalAmount?: number | string;
  paymentMethod?: string;
  status?: string;
  paymentVoucher?: string;
  notes?: string;
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingNotes?: string;
  fulfillmentStatus?: string;
  linkedPurchaseId?: number | null;
  linkedPurchaseNumber?: string | null;
}) {
  const updatePayload: Record<string, any> = {};

  if (data.customerName !== undefined) updatePayload.customerName = data.customerName;
  if (data.customerPhone !== undefined) {
    const normalizedPhone = normalizeEcuadorPhone(data.customerPhone);
    updatePayload.customerPhone = normalizedPhone.local || data.customerPhone;
  }
  if (data.customerCi !== undefined) {
    updatePayload.customerCi = data.customerCi ? data.customerCi.trim() : null;
    updatePayload.ci = updatePayload.customerCi;
  } else if (data.ci !== undefined) {
    updatePayload.customerCi = data.ci ? data.ci.trim() : null;
    updatePayload.ci = updatePayload.customerCi;
  }
  if (data.customerAddress !== undefined) updatePayload.customerAddress = data.customerAddress;
  if (data.items !== undefined) {
    updatePayload.items = typeof data.items === 'string' ? data.items : JSON.stringify(data.items);
  }
  if (data.totalAmount !== undefined) {
    updatePayload.totalAmount = cleanNumericString(data.totalAmount, '0.00');
  }
  if (data.paymentMethod !== undefined) updatePayload.paymentMethod = data.paymentMethod;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.paymentVoucher !== undefined) updatePayload.paymentVoucher = data.paymentVoucher;
  if (data.notes !== undefined) updatePayload.notes = data.notes;
  if (data.trackingNumber !== undefined) updatePayload.trackingNumber = data.trackingNumber;
  if (data.trackingCarrier !== undefined) updatePayload.trackingCarrier = data.trackingCarrier;
  if (data.trackingNotes !== undefined) updatePayload.trackingNotes = data.trackingNotes;
  if (data.fulfillmentStatus !== undefined) updatePayload.fulfillmentStatus = data.fulfillmentStatus;
  if (data.linkedPurchaseId !== undefined) updatePayload.linkedPurchaseId = data.linkedPurchaseId;
  if (data.linkedPurchaseNumber !== undefined) updatePayload.linkedPurchaseNumber = data.linkedPurchaseNumber;

  // Retrieve existing order to check status transitions & item differences
  let existingOrder: any = null;
  if (isPostgresConfigured()) {
    try {
      const [ord] = await db
        .select()
        .from(customerOrders)
        .where(eq(customerOrders.id, id))
        .limit(1);
      existingOrder = ord || null;
    } catch {}
  }
  if (!existingOrder) {
    const state = storage.getState();
    existingOrder = state.customerOrders.find((o) => o.id === id) || null;
  }

  if (existingOrder) {
    const prevStatus = existingOrder.status;
    const newStatus = data.status !== undefined ? data.status : prevStatus;
    const wasFinalized = isFinalizedSaleStatus(prevStatus);
    const isNowFinalized = isFinalizedSaleStatus(newStatus);

    if (!wasFinalized && isNowFinalized) {
      // Transitioning to finalized sale
      const itemsToDeduct = data.items !== undefined ? data.items : existingOrder.items;
      await adjustInventoryStockForItems(itemsToDeduct, -1);
    } else if (wasFinalized && !isNowFinalized) {
      // Transitioning away from finalized sale
      await adjustInventoryStockForItems(existingOrder.items, 1);
    }
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const ord = state.customerOrders.find((o) => o.id === id);
    if (!ord) throw new Error('Order not found');
    Object.assign(ord, updatePayload);
    storage.save();
    try {
      await upsertCustomerFromOrder(ord);
    } catch {}
    let parsedItems = [];
    try {
      parsedItems = JSON.parse(ord.items);
    } catch {}
    return {
      ...ord,
      items: parsedItems,
    };
  }

  try {
    const result = await db
      .update(customerOrders)
      .set(updatePayload)
      .where(eq(customerOrders.id, id))
      .returning();

    if (!result[0]) {
      throw new Error('Order not found');
    }

    const state = storage.getState();
    const localOrd = state.customerOrders.find((o) => o.id === id);
    if (localOrd) {
      Object.assign(localOrd, updatePayload);
      storage.save();
    }

    try {
      await upsertCustomerFromOrder(result[0]);
    } catch {}

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(result[0].items);
    } catch {}

    return {
      ...result[0],
      items: parsedItems,
    };
  } catch (error) {
    console.warn('Error updating customer order in SQL, fallback to local store:', error);
    const state = storage.getState();
    const ord = state.customerOrders.find((o) => o.id === id);
    if (ord) {
      Object.assign(ord, updatePayload);
      storage.save();
      try {
        await upsertCustomerFromOrder(ord);
      } catch {}
      let parsedItems = [];
      try {
        parsedItems = JSON.parse(ord.items);
      } catch {}
      return {
        ...ord,
        items: parsedItems,
      };
    }
    throw error;
  }
}

export async function deleteCustomerOrder(id: number) {
  // If the order was in a finalized state, restore inventory stock before deleting
  let existingOrder: any = null;
  if (isPostgresConfigured()) {
    try {
      const [ord] = await db
        .select()
        .from(customerOrders)
        .where(eq(customerOrders.id, id))
        .limit(1);
      existingOrder = ord || null;
    } catch {}
  }
  if (!existingOrder) {
    const state = storage.getState();
    existingOrder = state.customerOrders.find((o) => o.id === id) || null;
  }

  if (existingOrder && isFinalizedSaleStatus(existingOrder.status)) {
    await adjustInventoryStockForItems(existingOrder.items, 1);
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    const idx = state.customerOrders.findIndex((o) => o.id === id);
    let deleted = null;
    if (idx !== -1) {
      deleted = state.customerOrders.splice(idx, 1)[0];
      storage.save();
    }
    return { success: true, deleted };
  }

  try {
    const result = await db
      .delete(customerOrders)
      .where(eq(customerOrders.id, id))
      .returning();

    const state = storage.getState();
    const idx = state.customerOrders.findIndex((o) => o.id === id);
    if (idx !== -1) {
      state.customerOrders.splice(idx, 1);
      storage.save();
    }

    return { success: true, deleted: result[0] || null };
  } catch (error) {
    console.warn('Error deleting customer order from SQL, fallback:', error);
    const state = storage.getState();
    const idx = state.customerOrders.findIndex((o) => o.id === id);
    let deleted = null;
    if (idx !== -1) {
      deleted = state.customerOrders.splice(idx, 1)[0];
      storage.save();
    }
    return { success: true, deleted };
  }
}

// ----------------------------------------------------
// CUSTOMERS MANAGEMENT & CRM SYSTEM
// ----------------------------------------------------

export function parseCustomerShippingData(addressStr?: string | null, fallbackCi?: string | null) {
  let province = '';
  let canton = '';
  let parish = '';
  let exactAddress = '';
  let reference = '';
  let ci = (fallbackCi || '').trim();

  if (!addressStr || typeof addressStr !== 'string') {
    return { province, canton, parish, exactAddress, reference, ci };
  }

  const lines = addressStr.split(/[\n|]/).map((l) => l.trim()).filter(Boolean);
  const unparsedLines: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('provincia:')) {
      province = line.substring(10).trim();
    } else if (lower.startsWith('cantón:') || lower.startsWith('canton:') || lower.startsWith('ciudad:')) {
      canton = line.replace(/^(cantón|canton|ciudad):/i, '').trim();
    } else if (lower.startsWith('parroquia:')) {
      parish = line.substring(10).trim();
    } else if (lower.startsWith('dirección:') || lower.startsWith('direccion:') || lower.startsWith('calles:') || lower.startsWith('calle:')) {
      exactAddress = line.replace(/^(dirección|direccion|calles|calle):/i, '').trim();
    } else if (lower.startsWith('referencia:')) {
      reference = line.substring(11).trim();
    } else if (lower.startsWith('cédula:') || lower.startsWith('cedula:') || lower.startsWith('ci:') || lower.startsWith('ruc:')) {
      if (!ci) {
        ci = line.replace(/^(cédula|cedula|ci|ruc):/i, '').trim();
      }
    } else {
      unparsedLines.push(line);
    }
  }

  if (!exactAddress && unparsedLines.length > 0) {
    exactAddress = unparsedLines.join(', ');
  }

  return { province, canton, parish, exactAddress, reference, ci };
}

/**
 * Automatically upserts a customer record when an order is created, modified or confirmed.
 */
export async function upsertCustomerFromOrder(order: any, preferredUserId?: number) {
  if (!order || !order.customerPhone) return null;

  // ONLY register customer when the order is in CONFIRMED state (confirmed, paid, shipped, delivered, completed)
  const orderStatus = (order.status || '').toLowerCase().trim();
  const isConfirmedState = ['confirmed', 'paid', 'shipped', 'delivered', 'completed'].includes(orderStatus);
  if (!isConfirmedState) {
    return null;
  }

  const rawCi = order.customerCi || order.ci || '';
  const parsed = parseCustomerShippingData(order.customerAddress, rawCi);
  const cleanName = (order.customerName || 'Cliente').trim();
  const resolvedCi = (parsed.ci || (rawCi ? String(rawCi).trim() : null));

  const phoneNorm = normalizeEcuadorPhone(order.customerPhone);
  const cleanPhone = phoneNorm.formattedInternational || phoneNorm.e164 || order.customerPhone.trim();
  const phoneDigits = phoneNorm.digits || cleanPhone.replace(/\D/g, '');

  const targetUserId = await resolveValidUserId(order.userId || preferredUserId);
  const now = new Date();
  const nowIso = now.toISOString();
  const lastOrderDate = order.createdAt || nowIso;

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (!state.customers) {
      state.customers = [];
    }

    // Match customer by CI first, then phone
    let existingIndex = state.customers.findIndex((c) => {
      const matchCi = resolvedCi && c.ci && String(c.ci).trim().toLowerCase() === String(resolvedCi).trim().toLowerCase();
      if (matchCi) return true;
      const cNorm = normalizeEcuadorPhone(c.phone);
      const cDigits = cNorm.digits || c.phone.replace(/\D/g, '');
      const matchPhone = (phoneDigits.length >= 7 && cDigits.length >= 7 && (phoneDigits === cDigits || phoneDigits.endsWith(cDigits) || cDigits.endsWith(phoneDigits)));
      return matchPhone;
    });

    // Calculate customer order stats from local orders (confirmed orders only)
    const confirmedStatuses = ['confirmed', 'paid', 'shipped', 'delivered', 'completed'];
    const allUserOrders = state.customerOrders.filter((o) => {
      const oNorm = normalizeEcuadorPhone(o.customerPhone);
      const oDigits = oNorm.digits || o.customerPhone.replace(/\D/g, '');
      const matchPhone = (phoneDigits.length >= 7 && oDigits.length >= 7 && (phoneDigits === oDigits || phoneDigits.endsWith(oDigits) || oDigits.endsWith(phoneDigits)));
      const matchCi = resolvedCi && (o.customerCi || o.ci) && String(o.customerCi || o.ci).trim().toLowerCase() === String(resolvedCi).trim().toLowerCase();
      const oStatus = (o.status || '').toLowerCase().trim();
      return (matchPhone || matchCi) && confirmedStatuses.includes(oStatus);
    });

    const totalOrdersCount = allUserOrders.length > 0 ? allUserOrders.length : 1;
    const totalSpentSum = allUserOrders.reduce((sum, o) => sum + (parseFloat(String(o.totalAmount || 0)) || 0), 0);

    if (existingIndex !== -1) {
      const existing = state.customers[existingIndex];
      existing.name = cleanName || existing.name;
      existing.fullName = cleanName || existing.fullName || existing.name;
      existing.phone = cleanPhone || existing.phone;
      if (resolvedCi) existing.ci = resolvedCi;
      if (order.customerAddress) {
        existing.address = order.customerAddress;
        existing.fullAddress = order.customerAddress;
      }
      if (parsed.province) existing.province = parsed.province;
      if (parsed.canton) existing.canton = parsed.canton;
      if (parsed.parish) existing.parish = parsed.parish;
      if (parsed.exactAddress) existing.exactAddress = parsed.exactAddress;
      if (parsed.reference) existing.reference = parsed.reference;
      existing.totalOrders = Math.max(existing.totalOrders || 0, totalOrdersCount);
      existing.totalSpent = totalSpentSum > 0 ? totalSpentSum.toFixed(2) : existing.totalSpent;
      existing.lastOrderDate = lastOrderDate;
      existing.updatedAt = nowIso;
      storage.save();
      return existing;
    } else {
      const nextId = state.nextId.customers ? state.nextId.customers++ : (state.customers.length + 1);
      if (!state.nextId.customers) state.nextId.customers = nextId + 1;

      const newCustomer = {
        id: nextId,
        userId: targetUserId,
        name: cleanName,
        fullName: cleanName,
        phone: cleanPhone,
        ci: resolvedCi || null,
        email: null,
        address: order.customerAddress || null,
        fullAddress: order.customerAddress || null,
        province: parsed.province || null,
        canton: parsed.canton || null,
        parish: parsed.parish || null,
        exactAddress: parsed.exactAddress || null,
        reference: parsed.reference || null,
        totalOrders: totalOrdersCount,
        totalSpent: totalSpentSum > 0 ? totalSpentSum.toFixed(2) : cleanNumericString(order.totalAmount, '0.00'),
        lastOrderDate,
        notes: order.notes ? `Nota de pedido: ${order.notes}` : null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      state.customers.unshift(newCustomer);
      storage.save();
      return newCustomer;
    }
  }

  try {
    // Postgres upsert
    // Search existing customer by CI first or phone
    const ciCondition = resolvedCi && resolvedCi.trim() ? ilike(customers.ci, resolvedCi.trim()) : sql`false`;
    const phoneCondition = phoneDigits.length >= 7 ? ilike(customers.phone, `%${phoneDigits.slice(-8)}%`) : sql`false`;

    const existing = await db
      .select()
      .from(customers)
      .where(or(ciCondition, phoneCondition))
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      const updated = await db
        .update(customers)
        .set({
          name: cleanName || current.name,
          phone: cleanPhone || current.phone,
          ci: resolvedCi || current.ci,
          address: order.customerAddress || current.address,
          province: parsed.province || current.province,
          canton: parsed.canton || current.canton,
          parish: parsed.parish || current.parish,
          exactAddress: parsed.exactAddress || current.exactAddress,
          reference: parsed.reference || current.reference,
          totalOrders: sql`${customers.totalOrders} + 1`,
          totalSpent: sql`${customers.totalSpent} + ${parseFloat(cleanNumericString(order.totalAmount, '0.00'))}`,
          lastOrderDate: now,
          updatedAt: now,
        })
        .where(eq(customers.id, current.id))
        .returning();

      const enriched = {
        ...updated[0],
        fullName: updated[0].name,
        fullAddress: updated[0].address,
      };

      // Keep local state in sync
      const state = storage.getState();
      if (!state.customers) state.customers = [];
      const idx = state.customers.findIndex((c) => c.id === current.id);
      if (idx !== -1) {
        state.customers[idx] = enriched as any;
      } else {
        state.customers.unshift(enriched as any);
      }
      storage.save();

      return enriched;
    } else {
      const inserted = await db
        .insert(customers)
        .values({
          userId: targetUserId,
          name: cleanName,
          phone: cleanPhone,
          ci: resolvedCi || null,
          email: null,
          address: order.customerAddress || null,
          province: parsed.province || null,
          canton: parsed.canton || null,
          parish: parsed.parish || null,
          exactAddress: parsed.exactAddress || null,
          reference: parsed.reference || null,
          totalOrders: 1,
          totalSpent: cleanNumericString(order.totalAmount, '0.00'),
          lastOrderDate: now,
          notes: order.notes ? `Nota de pedido: ${order.notes}` : null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const enriched = {
        ...inserted[0],
        fullName: inserted[0].name,
        fullAddress: inserted[0].address,
      };

      // Keep local state in sync
      const state = storage.getState();
      if (!state.customers) state.customers = [];
      state.customers.unshift(enriched as any);
      storage.save();

      return enriched;
    }
  } catch (error) {
    console.warn('Error upserting customer to SQL, fallback to local storage:', error);
    const state = storage.getState();
    if (!state.customers) state.customers = [];
    let existingIndex = state.customers.findIndex((c) => {
      const matchCi = resolvedCi && c.ci && String(c.ci).trim().toLowerCase() === String(resolvedCi).trim().toLowerCase();
      if (matchCi) return true;
      const cNorm = normalizeEcuadorPhone(c.phone);
      const cDigits = cNorm.digits || c.phone.replace(/\D/g, '');
      return phoneDigits.length >= 7 && cDigits.length >= 7 && (phoneDigits === cDigits || phoneDigits.endsWith(cDigits) || cDigits.endsWith(phoneDigits));
    });

    if (existingIndex !== -1) {
      const existing = state.customers[existingIndex];
      existing.name = cleanName || existing.name;
      existing.fullName = cleanName || existing.fullName || existing.name;
      existing.phone = cleanPhone || existing.phone;
      if (resolvedCi) existing.ci = resolvedCi;
      if (order.customerAddress) existing.address = order.customerAddress;
      existing.lastOrderDate = lastOrderDate;
      existing.updatedAt = nowIso;
      storage.save();
      return existing;
    } else {
      const nextId = state.nextId.customers ? state.nextId.customers++ : (state.customers.length + 1);
      if (!state.nextId.customers) state.nextId.customers = nextId + 1;
      const newCustomer = {
        id: nextId,
        userId: targetUserId,
        name: cleanName,
        fullName: cleanName,
        phone: cleanPhone,
        ci: resolvedCi || null,
        email: null,
        address: order.customerAddress || null,
        fullAddress: order.customerAddress || null,
        province: parsed.province || null,
        canton: parsed.canton || null,
        parish: parsed.parish || null,
        exactAddress: parsed.exactAddress || null,
        reference: parsed.reference || null,
        totalOrders: 1,
        totalSpent: cleanNumericString(order.totalAmount, '0.00'),
        lastOrderDate,
        notes: order.notes ? `Nota de pedido: ${order.notes}` : null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      state.customers.unshift(newCustomer);
      storage.save();
      return newCustomer;
    }
  }
}

/**
 * Get list of all customers
 */
export async function getCustomers(userId?: number, search?: string) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (!state.customers) state.customers = [];
    let list = [...state.customers];

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.ci?.toLowerCase().includes(q) ||
          c.province?.toLowerCase().includes(q) ||
          c.canton?.toLowerCase().includes(q) ||
          c.parish?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const dateA = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return list;
  }

  try {
    let query = db.select().from(customers);

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      const filtered = await db
        .select()
        .from(customers)
        .where(
          or(
            ilike(customers.name, q),
            ilike(customers.phone, q),
            ilike(customers.ci, q),
            ilike(customers.province, q),
            ilike(customers.canton, q),
            ilike(customers.parish, q),
            ilike(customers.address, q),
            ilike(customers.email, q)
          )
        )
        .orderBy(desc(customers.updatedAt));
      return filtered;
    }

    const all = await db
      .select()
      .from(customers)
      .orderBy(desc(customers.updatedAt));

    return all;
  } catch (error) {
    console.warn('Error fetching customers from SQL, fallback to local store:', error);
    const state = storage.getState();
    if (!state.customers) state.customers = [];
    return state.customers;
  }
}

/**
 * Get a single customer by ID
 */
export async function getCustomerById(id: number) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    return state.customers?.find((c) => c.id === id) || null;
  }

  try {
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);
    return c || null;
  } catch (error) {
    console.warn('Error fetching customer by id from SQL:', error);
    const state = storage.getState();
    return state.customers?.find((c) => c.id === id) || null;
  }
}

/**
 * Create a new customer manually
 */
export async function createCustomer(data: {
  userId?: number;
  name?: string;
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
  notes?: string | null;
}) {
  const phoneNorm = normalizeEcuadorPhone(data.phone);
  const cleanPhone = phoneNorm.formattedInternational || phoneNorm.e164 || data.phone.trim();
  const cleanCi = data.ci ? data.ci.trim() : null;

  if (!cleanCi) {
    throw new Error('El número de cédula o RUC es obligatorio para registrar un cliente.');
  }

  const targetUserId = await resolveValidUserId(data.userId);
  const now = new Date().toISOString();
  const resolvedName = (data.fullName || data.name || 'Cliente').trim();

  // If address is structured or raw, compile exact full address
  let fullAddress = data.fullAddress || data.address || '';
  if (!fullAddress && (data.province || data.canton || data.exactAddress)) {
    const parts = [];
    if (data.province) parts.push(`Provincia: ${data.province}`);
    if (data.canton) parts.push(`Cantón: ${data.canton}`);
    if (data.parish) parts.push(`Parroquia: ${data.parish}`);
    if (data.exactAddress) parts.push(`Dirección: ${data.exactAddress}`);
    if (data.reference) parts.push(`Referencia: ${data.reference}`);
    fullAddress = parts.join('\n');
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (!state.customers) state.customers = [];

    // Deduplication by CI (Cédula de Identidad)
    if (cleanCi) {
      const existingIdx = state.customers.findIndex(
        (c) => c.ci && c.ci.trim().toLowerCase() === cleanCi.toLowerCase()
      );
      if (existingIdx !== -1) {
        const existing = state.customers[existingIdx];
        existing.name = resolvedName || existing.name;
        existing.fullName = resolvedName || existing.fullName || existing.name;
        if (cleanPhone) existing.phone = cleanPhone;
        if (data.email !== undefined) existing.email = data.email ? data.email.trim() : null;
        if (fullAddress) {
          existing.address = fullAddress;
          existing.fullAddress = fullAddress;
        }
        if (data.province !== undefined) existing.province = data.province?.trim() || null;
        if (data.canton !== undefined) existing.canton = data.canton?.trim() || null;
        if (data.parish !== undefined) existing.parish = data.parish?.trim() || null;
        if (data.exactAddress !== undefined) existing.exactAddress = data.exactAddress?.trim() || null;
        if (data.reference !== undefined) existing.reference = data.reference?.trim() || null;
        if (data.notes !== undefined) existing.notes = data.notes?.trim() || null;
        existing.updatedAt = now;
        storage.save();
        return { ...existing, alreadyExisted: true };
      }
    }

    const nextId = state.nextId.customers ? state.nextId.customers++ : (state.customers.length + 1);
    if (!state.nextId.customers) state.nextId.customers = nextId + 1;

    const newCustomer = {
      id: nextId,
      userId: targetUserId,
      name: resolvedName,
      fullName: resolvedName,
      phone: cleanPhone,
      ci: cleanCi,
      email: data.email ? data.email.trim() : null,
      address: fullAddress || null,
      fullAddress: fullAddress || null,
      province: data.province?.trim() || null,
      canton: data.canton?.trim() || null,
      parish: data.parish?.trim() || null,
      exactAddress: data.exactAddress?.trim() || null,
      reference: data.reference?.trim() || null,
      totalOrders: 0,
      totalSpent: '0.00',
      lastOrderDate: null,
      notes: data.notes?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };

    state.customers.unshift(newCustomer);
    storage.save();
    return newCustomer;
  }

  try {
    // Deduplication by CI (Cédula de Identidad) in PostgreSQL
    if (cleanCi) {
      const existing = await db
        .select()
        .from(customers)
        .where(ilike(customers.ci, cleanCi))
        .limit(1);

      if (existing.length > 0) {
        const current = existing[0];
        const updatePayload: Record<string, any> = {
          name: resolvedName || current.name,
          phone: cleanPhone || current.phone,
          updatedAt: new Date(),
        };
        if (data.email !== undefined) updatePayload.email = data.email ? data.email.trim() : null;
        if (fullAddress) updatePayload.address = fullAddress;
        if (data.province !== undefined) updatePayload.province = data.province?.trim() || null;
        if (data.canton !== undefined) updatePayload.canton = data.canton?.trim() || null;
        if (data.parish !== undefined) updatePayload.parish = data.parish?.trim() || null;
        if (data.exactAddress !== undefined) updatePayload.exactAddress = data.exactAddress?.trim() || null;
        if (data.reference !== undefined) updatePayload.reference = data.reference?.trim() || null;
        if (data.notes !== undefined) updatePayload.notes = data.notes?.trim() || null;

        const result = await db
          .update(customers)
          .set(updatePayload)
          .where(eq(customers.id, current.id))
          .returning();

        const updated = result[0];
        const enriched = {
          ...updated,
          fullName: updated.name,
          fullAddress: updated.address,
          alreadyExisted: true,
        };

        const state = storage.getState();
        if (state.customers) {
          const idx = state.customers.findIndex((c) => c.id === current.id);
          if (idx !== -1) {
            state.customers[idx] = enriched as any;
            storage.save();
          }
        }

        return enriched;
      }
    }

    const result = await db
      .insert(customers)
      .values({
        userId: targetUserId,
        name: resolvedName,
        phone: cleanPhone,
        ci: cleanCi,
        email: data.email ? data.email.trim() : null,
        address: fullAddress || null,
        province: data.province?.trim() || null,
        canton: data.canton?.trim() || null,
        parish: data.parish?.trim() || null,
        exactAddress: data.exactAddress?.trim() || null,
        reference: data.reference?.trim() || null,
        totalOrders: 0,
        totalSpent: '0.00',
        notes: data.notes?.trim() || null,
      })
      .returning();

    const created = result[0];
    const enriched = {
      ...created,
      fullName: created.name,
      fullAddress: created.address,
    };
    const state = storage.getState();
    if (!state.customers) state.customers = [];
    state.customers.unshift(enriched as any);
    storage.save();

    return enriched;
  } catch (error) {
    console.warn('Error creating customer in SQL, fallback to local store:', error);
    const state = storage.getState();
    if (!state.customers) state.customers = [];

    // Fallback deduplication by CI
    if (cleanCi) {
      const existingIdx = state.customers.findIndex(
        (c) => c.ci && c.ci.trim().toLowerCase() === cleanCi.toLowerCase()
      );
      if (existingIdx !== -1) {
        const existing = state.customers[existingIdx];
        existing.name = resolvedName || existing.name;
        existing.fullName = resolvedName || existing.fullName || existing.name;
        if (cleanPhone) existing.phone = cleanPhone;
        if (data.email !== undefined) existing.email = data.email ? data.email.trim() : null;
        if (fullAddress) {
          existing.address = fullAddress;
          existing.fullAddress = fullAddress;
        }
        existing.updatedAt = now;
        storage.save();
        return { ...existing, alreadyExisted: true };
      }
    }

    const nextId = state.nextId.customers ? state.nextId.customers++ : (state.customers.length + 1);
    if (!state.nextId.customers) state.nextId.customers = nextId + 1;

    const newCustomer = {
      id: nextId,
      userId: targetUserId,
      name: resolvedName,
      fullName: resolvedName,
      phone: cleanPhone,
      ci: cleanCi,
      email: data.email ? data.email.trim() : null,
      address: fullAddress || null,
      fullAddress: fullAddress || null,
      province: data.province?.trim() || null,
      canton: data.canton?.trim() || null,
      parish: data.parish?.trim() || null,
      exactAddress: data.exactAddress?.trim() || null,
      reference: data.reference?.trim() || null,
      totalOrders: 0,
      totalSpent: '0.00',
      lastOrderDate: null,
      notes: data.notes?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    state.customers.unshift(newCustomer);
    storage.save();
    return newCustomer;
  }
}

/**
 * Update an existing customer
 */
export async function updateCustomer(
  id: number,
  data: {
    name?: string;
    fullName?: string;
    phone?: string;
    ci?: string | null;
    email?: string | null;
    address?: string | null;
    fullAddress?: string | null;
    province?: string | null;
    canton?: string | null;
    parish?: string | null;
    exactAddress?: string | null;
    reference?: string | null;
    notes?: string | null;
    totalOrders?: number;
    totalSpent?: string | number;
  }
) {
  const updatePayload: Record<string, any> = {
    updatedAt: new Date(),
  };

  const nameVal = data.fullName !== undefined ? data.fullName : data.name;
  if (nameVal !== undefined) updatePayload.name = nameVal.trim();
  if (data.phone !== undefined) {
    const phoneNorm = normalizeEcuadorPhone(data.phone);
    updatePayload.phone = phoneNorm.formattedInternational || phoneNorm.e164 || data.phone.trim();
  }
  if (data.ci !== undefined) updatePayload.ci = data.ci ? data.ci.trim() : null;
  if (data.email !== undefined) updatePayload.email = data.email ? data.email.trim() : null;
  const addrVal = data.fullAddress !== undefined ? data.fullAddress : data.address;
  if (addrVal !== undefined) updatePayload.address = addrVal;
  if (data.province !== undefined) updatePayload.province = data.province ? data.province.trim() : null;
  if (data.canton !== undefined) updatePayload.canton = data.canton ? data.canton.trim() : null;
  if (data.parish !== undefined) updatePayload.parish = data.parish ? data.parish.trim() : null;
  if (data.exactAddress !== undefined) updatePayload.exactAddress = data.exactAddress ? data.exactAddress.trim() : null;
  if (data.reference !== undefined) updatePayload.reference = data.reference ? data.reference.trim() : null;
  if (data.notes !== undefined) updatePayload.notes = data.notes;
  if (data.totalOrders !== undefined) updatePayload.totalOrders = cleanInteger(data.totalOrders, 0);
  if (data.totalSpent !== undefined) updatePayload.totalSpent = cleanNumericString(data.totalSpent, '0.00');

  // Rebuild full address if structured fields provided
  if (data.province || data.canton || data.exactAddress) {
    const parts = [];
    if (data.province) parts.push(`Provincia: ${data.province}`);
    if (data.canton) parts.push(`Cantón: ${data.canton}`);
    if (data.parish) parts.push(`Parroquia: ${data.parish}`);
    if (data.exactAddress) parts.push(`Dirección: ${data.exactAddress}`);
    if (data.reference) parts.push(`Referencia: ${data.reference}`);
    updatePayload.address = parts.join('\n');
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (!state.customers) state.customers = [];
    const customer = state.customers.find((c) => c.id === id);
    if (!customer) throw new Error('Cliente no encontrado');
    Object.assign(customer, {
      ...updatePayload,
      updatedAt: new Date().toISOString(),
    });
    storage.save();
    return customer;
  }

  try {
    const result = await db
      .update(customers)
      .set(updatePayload)
      .where(eq(customers.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error('Cliente no encontrado');
    }

    const updated = result[0];
    const state = storage.getState();
    if (!state.customers) state.customers = [];
    const localIdx = state.customers.findIndex((c) => c.id === id);
    if (localIdx !== -1) {
      state.customers[localIdx] = updated as any;
      storage.save();
    }

    return updated;
  } catch (error) {
    console.warn('Error updating customer in SQL, fallback to local store:', error);
    const state = storage.getState();
    if (!state.customers) state.customers = [];
    const customer = state.customers.find((c) => c.id === id);
    if (customer) {
      Object.assign(customer, {
        ...updatePayload,
        updatedAt: new Date().toISOString(),
      });
      storage.save();
      return customer;
    }
    throw error;
  }
}

/**
 * Delete a customer by ID
 */
export async function deleteCustomer(id: number) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (!state.customers) state.customers = [];
    const idx = state.customers.findIndex((c) => c.id === id);
    let deleted = null;
    if (idx !== -1) {
      deleted = state.customers.splice(idx, 1)[0];
      storage.save();
    }
    return { success: true, deleted };
  }

  try {
    const result = await db
      .delete(customers)
      .where(eq(customers.id, id))
      .returning();

    const state = storage.getState();
    if (!state.customers) state.customers = [];
    const idx = state.customers.findIndex((c) => c.id === id);
    if (idx !== -1) {
      state.customers.splice(idx, 1);
      storage.save();
    }

    return { success: true, deleted: result[0] || null };
  } catch (error) {
    console.warn('Error deleting customer from SQL, fallback:', error);
    const state = storage.getState();
    if (!state.customers) state.customers = [];
    const idx = state.customers.findIndex((c) => c.id === id);
    let deleted = null;
    if (idx !== -1) {
      deleted = state.customers.splice(idx, 1)[0];
      storage.save();
    }
    return { success: true, deleted };
  }
}

/**
 * Sync all existing orders into customer directory
 */
export async function syncCustomersFromOrders(userId?: number) {
  const orders = await getCustomerOrders(userId);
  const synced: any[] = [];
  for (const ord of orders) {
    const c = await upsertCustomerFromOrder(ord, userId);
    if (c) synced.push(c);
  }
  return { success: true, totalOrders: orders.length, syncedCount: synced.length };
}

// ==========================================
// COMPRAS Y PEDIDOS A PROVEEDORES (PURCHASES)
// ==========================================

export async function getPurchases(
  userId?: number,
  filters?: { status?: string; supplierName?: string; linkedCustomerOrderId?: number }
) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (!state.purchases) state.purchases = [];
    let list = [...state.purchases];

    if (filters?.status && filters.status !== 'all') {
      list = list.filter((p) => p.status === filters.status);
    }
    if (filters?.supplierName) {
      const q = filters.supplierName.toLowerCase();
      list = list.filter((p) => p.supplierName?.toLowerCase().includes(q));
    }
    if (filters?.linkedCustomerOrderId) {
      list = list.filter((p) => p.linkedCustomerOrderId === filters.linkedCustomerOrderId);
    }

    list.sort((a, b) => new Date(b.createdAt || b.purchaseDate).getTime() - new Date(a.createdAt || a.purchaseDate).getTime());

    return list.map((p) => {
      let parsedItems: any[] = [];
      try {
        parsedItems = typeof p.items === 'string' ? JSON.parse(p.items) : p.items || [];
      } catch {}
      return {
        ...p,
        items: parsedItems,
      };
    });
  }

  try {
    let query = db.select().from(purchases);
    const conditions: any[] = [];

    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(purchases.status, filters.status));
    }
    if (filters?.supplierName) {
      conditions.push(ilike(purchases.supplierName, `%${filters.supplierName}%`));
    }
    if (filters?.linkedCustomerOrderId) {
      conditions.push(eq(purchases.linkedCustomerOrderId, filters.linkedCustomerOrderId));
    }

    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(purchases.createdAt))
      : await query.orderBy(desc(purchases.createdAt));

    return rows.map((p) => {
      let parsedItems: any[] = [];
      try {
        parsedItems = typeof p.items === 'string' ? JSON.parse(p.items) : p.items || [];
      } catch {}
      return {
        ...p,
        items: parsedItems,
      };
    });
  } catch (error) {
    console.warn('Error fetching purchases from SQL, fallback to local store:', error);
    const state = storage.getState();
    if (!state.purchases) state.purchases = [];
    let list = [...state.purchases];
    if (filters?.status && filters.status !== 'all') {
      list = list.filter((p) => p.status === filters.status);
    }
    return list.map((p) => {
      let parsedItems: any[] = [];
      try {
        parsedItems = typeof p.items === 'string' ? JSON.parse(p.items) : p.items || [];
      } catch {}
      return {
        ...p,
        items: parsedItems,
      };
    });
  }
}

export async function getPurchaseById(id: number) {
  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (!state.purchases) state.purchases = [];
    const p = state.purchases.find((item) => item.id === id);
    if (!p) return null;
    let parsedItems = [];
    try {
      parsedItems = typeof p.items === 'string' ? JSON.parse(p.items) : p.items || [];
    } catch {}
    return { ...p, items: parsedItems };
  }

  try {
    const rows = await db.select().from(purchases).where(eq(purchases.id, id)).limit(1);
    if (!rows[0]) return null;
    const p = rows[0];
    let parsedItems = [];
    try {
      parsedItems = typeof p.items === 'string' ? JSON.parse(p.items) : p.items || [];
    } catch {}
    return { ...p, items: parsedItems };
  } catch (error) {
    console.warn('Error fetching purchase by id from SQL, fallback:', error);
    const state = storage.getState();
    if (!state.purchases) state.purchases = [];
    const p = state.purchases.find((item) => item.id === id);
    if (!p) return null;
    let parsedItems = [];
    try {
      parsedItems = typeof p.items === 'string' ? JSON.parse(p.items) : p.items || [];
    } catch {}
    return { ...p, items: parsedItems };
  }
}

export async function createPurchase(data: {
  userId?: number;
  supplierName: string;
  supplierContact?: string;
  items: any[];
  totalCost?: number | string;
  status?: string; // 'pending', 'ordered', 'in_transit', 'received', 'cancelled'
  paymentStatus?: string; // 'unpaid', 'paid'
  linkedCustomerOrderId?: number;
  linkedCustomerOrderNumber?: string;
  receiptVoucher?: string;
  notes?: string;
  purchaseDate?: string;
}) {
  const userId = data.userId || 1;
  const purchaseNumber = `COM-${Date.now().toString().slice(-6)}`;
  const status = data.status || 'pending';
  const paymentStatus = data.paymentStatus || 'paid';
  const now = new Date().toISOString();

  // Calculate total cost if not provided
  let calculatedTotal = 0;
  if (Array.isArray(data.items)) {
    calculatedTotal = data.items.reduce((sum, it) => {
      const unitCost = Number(it.costPrice ?? it.salePrice ?? 0);
      const qty = Number(it.quantity ?? 1);
      return sum + (unitCost * qty);
    }, 0);
  }
  const cleanTotal = cleanNumericString(data.totalCost !== undefined ? data.totalCost : calculatedTotal, '0.00');

  // If initial status is already 'received', we should increment inventory stock immediately
  const shouldIncrementStock = status === 'received';

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (!state.purchases) state.purchases = [];
    if (!state.nextId.purchases) state.nextId.purchases = 1;
    const nextId = state.nextId.purchases++;

    const newPurchase = {
      id: nextId,
      userId,
      purchaseNumber,
      supplierName: data.supplierName || 'Proveedor Telegram',
      supplierContact: data.supplierContact || '',
      items: typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []),
      totalCost: cleanTotal,
      status,
      paymentStatus,
      linkedCustomerOrderId: data.linkedCustomerOrderId || null,
      linkedCustomerOrderNumber: data.linkedCustomerOrderNumber || null,
      receiptVoucher: data.receiptVoucher || null,
      notes: data.notes || '',
      purchaseDate: data.purchaseDate || now,
      receivedDate: shouldIncrementStock ? now : null,
      createdAt: now,
      updatedAt: now,
    };

    state.purchases.unshift(newPurchase);

    if (shouldIncrementStock && Array.isArray(data.items)) {
      await adjustInventoryStockForItems(data.items, 1);
    }

    // If linked to a customer order, update the order's fulfillment status
    if (data.linkedCustomerOrderId) {
      const linkedOrder = state.customerOrders.find((o) => o.id === data.linkedCustomerOrderId);
      if (linkedOrder) {
        linkedOrder.fulfillmentStatus = shouldIncrementStock ? 'supplier_received' : 'supplier_ordered';
        linkedOrder.linkedPurchaseId = newPurchase.id;
        linkedOrder.linkedPurchaseNumber = newPurchase.purchaseNumber;
      }
    }

    storage.save();

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(newPurchase.items);
    } catch {}

    return {
      success: true,
      purchase: { ...newPurchase, items: parsedItems },
      purchaseNumber,
    };
  }

  try {
    const targetUserId = await resolveValidUserId(data.userId);
    const result = await db
      .insert(purchases)
      .values({
        userId: targetUserId,
        purchaseNumber,
        supplierName: data.supplierName || 'Proveedor Telegram',
        supplierContact: data.supplierContact || '',
        items: typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []),
        totalCost: cleanTotal,
        status,
        paymentStatus,
        linkedCustomerOrderId: data.linkedCustomerOrderId || null,
        linkedCustomerOrderNumber: data.linkedCustomerOrderNumber || null,
        receiptVoucher: data.receiptVoucher || null,
        notes: data.notes || '',
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
        receivedDate: shouldIncrementStock ? new Date() : null,
      })
      .returning();

    const created = result[0];

    if (shouldIncrementStock && Array.isArray(data.items)) {
      await adjustInventoryStockForItems(data.items, 1);
    }

    // Sync to local fallback storage
    const state = storage.getState();
    if (!state.purchases) state.purchases = [];
    state.purchases.unshift(created as any);

    if (data.linkedCustomerOrderId) {
      try {
        await db
          .update(customerOrders)
          .set({
            fulfillmentStatus: shouldIncrementStock ? 'supplier_received' : 'supplier_ordered',
            linkedPurchaseId: created.id,
            linkedPurchaseNumber: created.purchaseNumber,
          })
          .where(eq(customerOrders.id, data.linkedCustomerOrderId));
      } catch (linkErr) {
        console.warn('Could not link customer order in SQL:', linkErr);
      }

      const localOrd = state.customerOrders.find((o) => o.id === data.linkedCustomerOrderId);
      if (localOrd) {
        localOrd.fulfillmentStatus = shouldIncrementStock ? 'supplier_received' : 'supplier_ordered';
        localOrd.linkedPurchaseId = created.id;
        localOrd.linkedPurchaseNumber = created.purchaseNumber;
      }
    }

    storage.save();

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(created.items);
    } catch {}

    return {
      success: true,
      purchase: { ...created, items: parsedItems },
      purchaseNumber,
    };
  } catch (error) {
    console.error('Error creating purchase in SQL, fallback to local store:', error);
    const state = storage.getState();
    if (!state.purchases) state.purchases = [];
    if (!state.nextId.purchases) state.nextId.purchases = 1;
    const nextId = state.nextId.purchases++;

    const newPurchase = {
      id: nextId,
      userId,
      purchaseNumber,
      supplierName: data.supplierName || 'Proveedor Telegram',
      supplierContact: data.supplierContact || '',
      items: typeof data.items === 'string' ? data.items : JSON.stringify(data.items || []),
      totalCost: cleanTotal,
      status,
      paymentStatus,
      linkedCustomerOrderId: data.linkedCustomerOrderId || null,
      linkedCustomerOrderNumber: data.linkedCustomerOrderNumber || null,
      receiptVoucher: data.receiptVoucher || null,
      notes: data.notes || '',
      purchaseDate: data.purchaseDate || now,
      receivedDate: shouldIncrementStock ? now : null,
      createdAt: now,
      updatedAt: now,
    };

    state.purchases.unshift(newPurchase);
    if (shouldIncrementStock && Array.isArray(data.items)) {
      await adjustInventoryStockForItems(data.items, 1);
    }
    storage.save();

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(newPurchase.items);
    } catch {}

    return {
      success: true,
      purchase: { ...newPurchase, items: parsedItems },
      purchaseNumber,
    };
  }
}

export async function updatePurchase(
  id: number,
  data: {
    supplierName?: string;
    supplierContact?: string;
    items?: any[];
    totalCost?: number | string;
    status?: string;
    paymentStatus?: string;
    receiptVoucher?: string;
    notes?: string;
    purchaseDate?: string;
    receivedDate?: string;
  }
) {
  const updatePayload: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };

  if (data.supplierName !== undefined) updatePayload.supplierName = data.supplierName;
  if (data.supplierContact !== undefined) updatePayload.supplierContact = data.supplierContact;
  if (data.items !== undefined) {
    updatePayload.items = typeof data.items === 'string' ? data.items : JSON.stringify(data.items);
  }
  if (data.totalCost !== undefined) {
    updatePayload.totalCost = cleanNumericString(data.totalCost, '0.00');
  }
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.paymentStatus !== undefined) updatePayload.paymentStatus = data.paymentStatus;
  if (data.receiptVoucher !== undefined) updatePayload.receiptVoucher = data.receiptVoucher;
  if (data.notes !== undefined) updatePayload.notes = data.notes;
  if (data.purchaseDate !== undefined) updatePayload.purchaseDate = data.purchaseDate;
  if (data.receivedDate !== undefined) updatePayload.receivedDate = data.receivedDate;

  // Check status transition to handle inventory stock adjustments
  let existingPurchase = await getPurchaseById(id);
  if (!existingPurchase) {
    throw new Error('Compra a proveedor no encontrada');
  }

  const prevStatus = existingPurchase.status;
  const newStatus = data.status !== undefined ? data.status : prevStatus;
  const wasReceived = prevStatus === 'received';
  const isNowReceived = newStatus === 'received';

  if (!wasReceived && isNowReceived) {
    // Goods arrived -> increase inventory stock
    const itemsToAdd = data.items !== undefined ? data.items : existingPurchase.items;
    await adjustInventoryStockForItems(itemsToAdd, 1);
    if (!updatePayload.receivedDate) {
      updatePayload.receivedDate = new Date().toISOString();
    }
  } else if (wasReceived && !isNowReceived) {
    // Reverted from received -> decrease inventory stock
    await adjustInventoryStockForItems(existingPurchase.items, -1);
  }

  if (!isPostgresConfigured()) {
    const state = storage.getState();
    if (!state.purchases) state.purchases = [];
    const p = state.purchases.find((item) => item.id === id);
    if (!p) throw new Error('Compra no encontrada');
    Object.assign(p, updatePayload);

    // If purchase was linked to customer order, synchronize customer order fulfillment status
    if (p.linkedCustomerOrderId && data.status !== undefined) {
      const ord = state.customerOrders.find((o) => o.id === p.linkedCustomerOrderId);
      if (ord) {
        if (newStatus === 'received') {
          ord.fulfillmentStatus = 'supplier_received';
        } else if (newStatus === 'ordered' || newStatus === 'in_transit') {
          ord.fulfillmentStatus = 'supplier_ordered';
        } else if (newStatus === 'pending') {
          ord.fulfillmentStatus = 'supplier_pending';
        }
      }
    }

    storage.save();

    let parsedItems = [];
    try {
      parsedItems = typeof p.items === 'string' ? JSON.parse(p.items) : p.items || [];
    } catch {}
    return { ...p, items: parsedItems };
  }

  try {
    const result = await db
      .update(purchases)
      .set(updatePayload)
      .where(eq(purchases.id, id))
      .returning();

    const updated = result[0];
    const state = storage.getState();
    if (!state.purchases) state.purchases = [];
    const localP = state.purchases.find((item) => item.id === id);
    if (localP) {
      Object.assign(localP, updatePayload);
      storage.save();
    }

    if (updated?.linkedCustomerOrderId && data.status !== undefined) {
      let targetFulfillment: string | null = null;
      if (newStatus === 'received') targetFulfillment = 'supplier_received';
      else if (newStatus === 'ordered' || newStatus === 'in_transit') targetFulfillment = 'supplier_ordered';
      else if (newStatus === 'pending') targetFulfillment = 'supplier_pending';

      if (targetFulfillment) {
        try {
          await db
            .update(customerOrders)
            .set({ fulfillmentStatus: targetFulfillment })
            .where(eq(customerOrders.id, updated.linkedCustomerOrderId));
        } catch {}
      }
    }

    let parsedItems = [];
    try {
      parsedItems = typeof updated.items === 'string' ? JSON.parse(updated.items) : updated.items || [];
    } catch {}
    return { ...updated, items: parsedItems };
  } catch (error) {
    console.warn('Error updating purchase in SQL, fallback to local store:', error);
    const state = storage.getState();
    if (!state.purchases) state.purchases = [];
    const p = state.purchases.find((item) => item.id === id);
    if (p) {
      Object.assign(p, updatePayload);
      storage.save();
      let parsedItems = [];
      try {
        parsedItems = typeof p.items === 'string' ? JSON.parse(p.items) : p.items || [];
      } catch {}
      return { ...p, items: parsedItems };
    }
    throw error;
  }
}

/**
 * 1-Click Receive Purchase in Warehouse:
 * Marks purchase as 'received', registers receivedDate, increments stock of all items in catalog,
 * and updates any linked customer order to 'supplier_received' ready for dispatch!
 */
export async function receivePurchase(id: number) {
  const purchase = await getPurchaseById(id);
  if (!purchase) {
    throw new Error('Compra no encontrada');
  }

  if (purchase.status === 'received') {
    return { success: true, message: 'La compra ya fue recibida anteriormente', purchase };
  }

  const updated = await updatePurchase(id, {
    status: 'received',
    receivedDate: new Date().toISOString(),
    paymentStatus: 'paid',
  });

  return {
    success: true,
    message: `¡Compra #${purchase.purchaseNumber} recibida exitosamente! El stock de los productos ha sido ingresado a bodega.`,
    purchase: updated,
  };
}

export async function deletePurchase(id: number) {
  const purchase = await getPurchaseById(id);
  if (!purchase) {
    return { success: true, deleted: null };
  }

  // If purchase was already marked received, we subtract the stock before deleting
  if (purchase.status === 'received' && purchase.items) {
    try {
      await adjustInventoryStockForItems(purchase.items, -1);
    } catch (e) {
      console.warn('Could not adjust stock when deleting received purchase:', e);
    }
  }

  // Unlink any customer orders that had this linkedPurchaseId
  try {
    if (isPostgresConfigured()) {
      await db
        .update(customerOrders)
        .set({
          linkedPurchaseId: null,
          linkedPurchaseNumber: null,
          fulfillmentStatus: 'supplier_pending',
        })
        .where(eq(customerOrders.linkedPurchaseId, id));
    }
  } catch (linkErr) {
    console.warn('Could not unlink customer orders for purchase in SQL:', linkErr);
  }

  const state = storage.getState();
  if (state.customerOrders) {
    state.customerOrders.forEach((co) => {
      if (co.linkedPurchaseId === id) {
        co.linkedPurchaseId = undefined;
        co.linkedPurchaseNumber = undefined;
        if (co.fulfillmentStatus === 'supplier_ordered' || co.fulfillmentStatus === 'supplier_received') {
          co.fulfillmentStatus = 'supplier_pending';
        }
      }
    });
  }

  if (!isPostgresConfigured()) {
    if (!state.purchases) state.purchases = [];
    const idx = state.purchases.findIndex((p) => p.id === id);
    let deleted = null;
    if (idx !== -1) {
      deleted = state.purchases.splice(idx, 1)[0];
      storage.save();
    }
    return { success: true, deleted };
  }

  try {
    const result = await db.delete(purchases).where(eq(purchases.id, id)).returning();
    if (!state.purchases) state.purchases = [];
    const idx = state.purchases.findIndex((p) => p.id === id);
    if (idx !== -1) {
      state.purchases.splice(idx, 1);
      storage.save();
    }
    return { success: true, deleted: result[0] || null };
  } catch (error) {
    console.warn('Error deleting purchase from SQL, fallback to local store:', error);
    if (!state.purchases) state.purchases = [];
    const idx = state.purchases.findIndex((p) => p.id === id);
    let deleted = null;
    if (idx !== -1) {
      deleted = state.purchases.splice(idx, 1)[0];
      storage.save();
    }
    return { success: true, deleted };
  }
}

/**
 * Automatically Generates a Supplier Purchase Order from a Customer Order that has on-demand or out-of-stock items.
 */
export async function autoGeneratePurchaseForOrder(orderId: number, userId?: number) {
  const orders = await getCustomerOrders(userId);
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    throw new Error('Pedido del cliente no encontrado');
  }

  // Get current inventory to check available stock and supplier details
  const inventory = await getInventoryItems();
  const purchaseItems: any[] = [];
  let detectedSupplierName = 'Proveedor Telegram Principal';

  for (const it of order.items) {
    const invItem = inventory.find(
      (inv) => inv.id === it.id || (inv.sku && it.sku && inv.sku.toLowerCase() === it.sku.toLowerCase())
    );

    const currentStock = invItem ? Number(invItem.stock || 0) : 0;
    const neededQty = Number(it.quantity || 1);
    const missingQty = Math.max(neededQty - currentStock, neededQty); // Order the quantity needed

    const itemCostPrice = invItem ? Number(invItem.costPrice || invItem.salePrice || 0) : Number(it.salePrice || 0) * 0.7;
    const supplier = (invItem as any)?.supplier || (invItem as any)?.channelTitle || 'Proveedor Telegram';
    if (supplier) detectedSupplierName = supplier;

    purchaseItems.push({
      inventoryItemId: invItem ? invItem.id : it.id,
      name: it.name || invItem?.name || 'Producto bajo pedido',
      sku: it.sku || invItem?.sku || '',
      costPrice: itemCostPrice.toFixed(2),
      salePrice: it.salePrice,
      quantity: missingQty,
      imageUrl: it.imageUrl || invItem?.imageUrl || null,
      supplierName: supplier,
      customerOrderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
    });
  }

  if (purchaseItems.length === 0) {
    throw new Error('El pedido no contiene productos para generar compra');
  }

  // Create the purchase order with status 'pending' (Consultando al proveedor)
  const purchaseResult = await createPurchase({
    userId: userId || order.userId || 1,
    supplierName: detectedSupplierName,
    supplierContact: '',
    items: purchaseItems,
    status: 'pending',
    paymentStatus: 'unpaid',
    linkedCustomerOrderId: order.id,
    linkedCustomerOrderNumber: order.orderNumber,
    notes: `Generado automáticamente desde Pedido de Cliente #${order.orderNumber} para ${order.customerName} (${order.customerPhone}) - Consultando disponibilidad con proveedor`,
  });

  // Update order fulfillment status to supplier_pending and attach purchase details
  await updateCustomerOrder(order.id, {
    fulfillmentStatus: 'supplier_pending',
    linkedPurchaseId: purchaseResult.purchase.id,
    linkedPurchaseNumber: purchaseResult.purchaseNumber,
    notes: (order.notes ? order.notes + '\n' : '') + `[Abastecimiento] 🔍 Consultando al proveedor la disponibilidad (Orden de Compra #${purchaseResult.purchaseNumber})`,
  });

  return {
    success: true,
    purchase: purchaseResult.purchase,
    purchaseNumber: purchaseResult.purchaseNumber,
    customerOrderNumber: order.orderNumber,
  };
}

/**
 * Comprehensive Financial Overview & Real Margin Calculation:
 * - Inversión en Compras vs Ingresos por Ventas
 * - Costo de Mercancía Vendida (COGS)
 * - Utilidad Bruta y Margen Neto Real
 * - Valoración del inventario físico inmovilizado
 */
export async function getFinancialSummary(userId?: number, period: string = 'all') {
  const [orders, allPurchases, inventory] = await Promise.all([
    getCustomerOrders(userId),
    getPurchases(userId),
    getInventoryItems(userId),
  ]);

  const now = new Date();
  const filterByDate = (dateVal?: string | Date | null) => {
    if (!dateVal || period === 'all') return true;
    const itemDate = new Date(dateVal);
    if (isNaN(itemDate.getTime())) return true;

    if (period === 'today') {
      return itemDate.toDateString() === now.toDateString();
    }
    if (period === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return itemDate >= oneWeekAgo;
    }
    if (period === 'month') {
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }
    if (period === 'year') {
      return itemDate.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // 1. Purchases Metrics
  const filteredPurchases = allPurchases.filter((p) => filterByDate(p.purchaseDate || p.createdAt));

  let totalPurchasesCost = 0;
  let totalPendingPurchasesCost = 0;
  let totalPurchasesCount = 0;

  for (const p of filteredPurchases) {
    const cost = Number(p.totalCost || 0);
    if (p.status === 'received' || p.paymentStatus === 'paid') {
      totalPurchasesCost += cost;
      totalPurchasesCount++;
    } else if (p.status === 'pending' || p.status === 'ordered' || p.status === 'in_transit') {
      totalPendingPurchasesCost += cost;
    }
  }

  // 2. Sales Metrics (Only confirmed, shipped, delivered count as finalized sales revenue)
  const filteredOrders = orders.filter((o) => filterByDate(o.createdAt));

  let totalSalesRevenue = 0;
  let totalOrdersCount = 0;
  let costOfGoodsSold = 0;

  // Build inventory cost lookup map
  const itemCostMap = new Map<string, number>();
  for (const inv of inventory) {
    const cost = Number(inv.costPrice || 0);
    itemCostMap.set(String(inv.id), cost);
    if (inv.sku) itemCostMap.set(inv.sku.toLowerCase(), cost);
  }

  for (const ord of filteredOrders) {
    const isFinalized = ord.status === 'confirmed' || ord.status === 'shipped' || ord.status === 'delivered';
    if (isFinalized) {
      const orderRev = Number(ord.totalAmount || 0);
      totalSalesRevenue += orderRev;
      totalOrdersCount++;

      // Compute COGS for this order
      if (Array.isArray(ord.items)) {
        for (const it of ord.items) {
          const qty = Number(it.quantity || 1);
          let unitCost = Number(it.costPrice || 0);
          if (unitCost <= 0) {
            unitCost = itemCostMap.get(String(it.id)) || itemCostMap.get((it.sku || '').toLowerCase()) || (Number(it.salePrice || 0) * 0.7);
          }
          costOfGoodsSold += (unitCost * qty);
        }
      }
    }
  }

  // If no COGS could be calculated directly, estimate based on purchased cost
  const effectiveCogs = costOfGoodsSold > 0 ? costOfGoodsSold : totalPurchasesCost;
  const grossProfit = totalSalesRevenue - effectiveCogs;
  const netProfitMarginPercent = totalSalesRevenue > 0 ? Math.round((grossProfit / totalSalesRevenue) * 100) : 0;

  // 3. Current Physical Stock Valuation
  let currentPhysicalStockUnits = 0;
  let currentPhysicalStockCostValue = 0;
  let currentPhysicalStockSaleValue = 0;

  for (const inv of inventory) {
    if (inv.status !== 'archived') {
      const stock = Number(inv.stock || 0);
      if (stock > 0) {
        const cost = Number(inv.costPrice || 0);
        const sale = Number(inv.salePrice || 0);
        currentPhysicalStockUnits += stock;
        currentPhysicalStockCostValue += (cost * stock);
        currentPhysicalStockSaleValue += (sale * stock);
      }
    }
  }

  // 4. Combined Recent Ledger / Transactions
  const recentTransactions: any[] = [];

  for (const ord of filteredOrders.slice(0, 15)) {
    const isFinal = ord.status === 'confirmed' || ord.status === 'shipped' || ord.status === 'delivered';
    const rev = Number(ord.totalAmount || 0);
    recentTransactions.push({
      type: 'sale',
      id: ord.id,
      reference: `#${ord.orderNumber}`,
      description: `Venta a ${ord.customerName} (${ord.items?.length || 1} productos)`,
      amount: rev,
      cost: rev * 0.7,
      profit: isFinal ? (rev * 0.3) : 0,
      date: ord.createdAt,
      status: ord.status,
    });
  }

  for (const p of filteredPurchases.slice(0, 15)) {
    const cost = Number(p.totalCost || 0);
    recentTransactions.push({
      type: 'purchase',
      id: p.id,
      reference: `#${p.purchaseNumber}`,
      description: `Compra a ${p.supplierName} (${p.items?.length || 1} productos)`,
      amount: -cost,
      cost: cost,
      profit: -cost,
      date: p.purchaseDate || p.createdAt,
      status: p.status,
    });
  }

  recentTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    period,
    totalPurchasesCost,
    totalPurchasesCount,
    totalPendingPurchasesCost,
    totalSalesRevenue,
    totalOrdersCount,
    costOfGoodsSold: effectiveCogs,
    grossProfit,
    netProfitMarginPercent,
    currentPhysicalStockUnits,
    currentPhysicalStockCostValue,
    currentPhysicalStockSaleValue,
    recentTransactions: recentTransactions.slice(0, 20),
  };
}
