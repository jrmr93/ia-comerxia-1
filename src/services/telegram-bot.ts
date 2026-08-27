import {
  getTelegramConfig,
  createInventoryItem,
  createTelegramMessageRecord,
  appendImageToInventoryItem,
  setInventoryItemVideo,
  findExistingInventoryItem,
  generateNextSku,
  getSupplierSkuPrefix,
} from '../db/inventory.ts';
import { parseSupplierTelegramMessage } from './gemini-parser.ts';
import { saveVideoBufferLocally } from './media-storage.ts';

let pollingActive = false;
let pollingAbortController: AbortController | null = null;
let lastUpdateId = 0;
let currentBotToken: string | null = null;
let currentBotInfo: { id: number; username: string; first_name: string } | null = null;
let pollingError: string | null = null;
let watchdogInterval: NodeJS.Timeout | null = null;
let isPollingLoopRunning = false;

// Media Group (Telegram Album) buffer map to combine multiple photos/videos of the same product
interface MediaGroupBuffer {
  mediaGroupId: string;
  token: string;
  userId: number;
  chatId?: number;
  senderName: string;
  senderUsername?: string;
  caption: string;
  photos: Array<{ photoBase64: string; photoMimeType: string }>;
  videoUrl?: string | null;
  messageIds: string[];
  timer: NodeJS.Timeout;
}
const mediaGroupBuffers = new Map<string, MediaGroupBuffer>();

// Tracker for recently processed products (allows linking subsequent single photos/videos forwarded within 12s)
interface RecentProduct {
  itemId: number;
  name: string;
  timestamp: number;
  chatId?: number;
  supplierName: string;
}
const recentProducts = new Map<string, RecentProduct>();

export function getBotRuntimeStatus() {
  return {
    pollingActive,
    hasToken: Boolean(currentBotToken || process.env.TELEGRAM_BOT_TOKEN),
    botInfo: currentBotInfo,
    lastUpdateId,
    pollingError,
  };
}

/**
 * Sends a message back to the Telegram chat
 */
export async function sendTelegramChatMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown'
) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('Error sending Telegram response message:', err);
    return null;
  }
}

/**
 * Downloads a video file sent to the bot from Telegram's servers and saves it to local /uploads
 */
export async function downloadTelegramVideo(
  botToken: string,
  fileId: string,
  fileNameHint?: string
): Promise<{ videoUrl: string; mimeType: string } | null> {
  try {
    const fileInfoRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const fileInfo = await fileInfoRes.json();

    if (!fileInfo.ok || !fileInfo.result?.file_path) {
      console.warn('[Telegram Bot] Could not get video file path from Telegram API:', fileInfo);
      return null;
    }

    const filePath = fileInfo.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const vidRes = await fetch(downloadUrl);

    if (!vidRes.ok) {
      console.warn(`[Telegram Bot] Failed to download video stream (${vidRes.status})`);
      return null;
    }

    const arrayBuf = await vidRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const mimeType = filePath.endsWith('.webm')
      ? 'video/webm'
      : filePath.endsWith('.mov')
      ? 'video/quicktime'
      : 'video/mp4';

    const savedLocalUrl = await saveVideoBufferLocally(buffer, mimeType, fileNameHint || 'tg_video');

    return {
      videoUrl: savedLocalUrl,
      mimeType,
    };
  } catch (err) {
    console.error('Failed to download video from Telegram:', err);
    return null;
  }
}

/**
 * Downloads a photo sent to the bot from Telegram's servers
 */
export async function downloadTelegramPhoto(
  botToken: string,
  fileId: string
): Promise<{ photoBase64: string; photoMimeType: string } | null> {
  try {
    const fileInfoRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const fileInfo = await fileInfoRes.json();

    if (!fileInfo.ok || !fileInfo.result?.file_path) {
      return null;
    }

    const filePath = fileInfo.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const imgRes = await fetch(downloadUrl);

    if (!imgRes.ok) return null;

    const arrayBuf = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;

    return {
      photoBase64: base64,
      photoMimeType: mimeType,
    };
  } catch (err) {
    console.error('Failed to download photo from Telegram:', err);
    return null;
  }
}

/**
 * Helper to extract supplier info prioritizing forwarded original remitente
 */
export function extractSupplierFromMessage(message: any): {
  senderName: string;
  senderUsername?: string;
} {
  let supplierName = 'Proveedor Telegram';
  let supplierUsername: string | undefined = undefined;

  // Case A: Modern Telegram forward_origin
  if (message.forward_origin) {
    if (message.forward_origin.type === 'user' && message.forward_origin.sender_user) {
      const u = message.forward_origin.sender_user;
      supplierName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'Proveedor';
      supplierUsername = u.username ? `@${u.username}` : undefined;
    } else if (message.forward_origin.type === 'channel' && message.forward_origin.chat) {
      supplierName = message.forward_origin.chat.title || 'Canal Proveedor';
      supplierUsername = message.forward_origin.chat.username ? `@${message.forward_origin.chat.username}` : undefined;
    } else if (message.forward_origin.type === 'chat' && message.forward_origin.sender_chat) {
      supplierName = message.forward_origin.sender_chat.title || 'Grupo Proveedor';
      supplierUsername = message.forward_origin.sender_chat.username ? `@${message.forward_origin.sender_chat.username}` : undefined;
    } else if (message.forward_origin.type === 'hidden_user') {
      supplierName = message.forward_origin.sender_user_name || 'Proveedor Oculto';
    }
  }
  // Case B: Legacy forward_from
  else if (message.forward_from) {
    const f = message.forward_from;
    supplierName = `${f.first_name || ''} ${f.last_name || ''}`.trim() || f.username || 'Proveedor';
    supplierUsername = f.username ? `@${f.username}` : undefined;
  } else if (message.forward_from_chat) {
    supplierName = message.forward_from_chat.title || 'Canal Proveedor';
    supplierUsername = message.forward_from_chat.username ? `@${message.forward_from_chat.username}` : undefined;
  } else if (message.forward_sender_name) {
    supplierName = message.forward_sender_name;
  }
  // Case C: Direct sender
  else {
    supplierName = message.from?.first_name
      ? `${message.from.first_name} ${message.from.last_name || ''}`.trim()
      : message.chat?.title || 'Proveedor Telegram';
    supplierUsername = message.from?.username ? `@${message.from.username}` : undefined;
  }

  return { senderName: supplierName, senderUsername: supplierUsername };
}

/**
 * Extracts photo from either photo array or document image
 */
export async function extractPhotoFromMessage(
  token: string,
  message: any
): Promise<{ photoBase64: string; photoMimeType: string } | null> {
  if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
    const highestResPhoto = message.photo[message.photo.length - 1];
    return await downloadTelegramPhoto(token, highestResPhoto.file_id);
  } else if (
    message.document &&
    (message.document.mime_type?.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp)$/i.test(message.document.file_name || ''))
  ) {
    return await downloadTelegramPhoto(token, message.document.file_id);
  }
  return null;
}

/**
 * Extracts video from message.video, message.animation, message.video_note or document video
 */
export async function extractVideoFromMessage(
  token: string,
  message: any
): Promise<{ videoUrl: string; mimeType: string } | null> {
  if (message.video && message.video.file_id) {
    return await downloadTelegramVideo(token, message.video.file_id, message.video.file_name || 'tg_video');
  } else if (message.animation && message.animation.file_id) {
    return await downloadTelegramVideo(token, message.animation.file_id, message.animation.file_name || 'tg_animation');
  } else if (message.video_note && message.video_note.file_id) {
    return await downloadTelegramVideo(token, message.video_note.file_id, 'tg_video_note');
  } else if (
    message.document &&
    (message.document.mime_type?.startsWith('video/') ||
      /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(message.document.file_name || ''))
  ) {
    return await downloadTelegramVideo(token, message.document.file_id, message.document.file_name);
  }
  return null;
}

/**
 * Creates or updates a product with multiple photos and optional video
 */
async function processCompleteProduct(
  token: string,
  data: {
    userId: number;
    chatId?: number;
    messageIds: string[];
    senderName: string;
    senderUsername?: string;
    caption: string;
    photos: Array<{ photoBase64: string; photoMimeType: string }>;
    videoUrl?: string | null;
  }
) {
  const { userId, chatId, messageIds, senderName, senderUsername, caption, photos, videoUrl } = data;

  // 1. Get User config for pricing and currency
  const config = await getTelegramConfig(userId);

  // 2. Extract photos list
  const photosBase64List = photos.map((p) => p.photoBase64);
  const primaryPhoto = photosBase64List[0] || null;

  // 3. Parse with Gemini AI Multimodal (passing all product photos together)
  const parsed = await parseSupplierTelegramMessage(
    caption || 'Producto recibido con fotos por Telegram',
    photosBase64List,
    photos[0]?.photoMimeType || 'image/jpeg',
    config.defaultMarginPercent || 30,
    config.currency || 'USD'
  );

  // Include photos array, video, cost options and profit margin inside extractedAttributes
  const attributesWithGallery = {
    ...parsed.attributes,
    images: photosBase64List,
    totalPhotos: photosBase64List.length,
    videoUrl: videoUrl || null,
    costOptions: parsed.costOptions || [],
    profitMarginPercent: parsed.profitMarginPercent || config.defaultMarginPercent || 30,
    selectedCostPrice: parsed.costPrice,
  };

  const currencySym = config.currency === 'EUR' ? '€' : '$';

  // 4. Duplicate Check: verify if product already exists
  const existingItem = await findExistingInventoryItem({
    name: parsed.name,
    sku: parsed.sku !== 'AUTO' ? parsed.sku : undefined,
    rawTelegramMessage: caption,
    supplierName: senderName,
  });

  if (existingItem) {
    console.log(
      `[Telegram Bot] Duplicate detected: "${parsed.name}" already exists with SKU "${existingItem.sku}" (ID: ${existingItem.id}).`
    );

    // If new video arrived for existing product and it doesn't have one, attach it
    if (videoUrl && !existingItem.videoUrl) {
      await setInventoryItemVideo(existingItem.id, videoUrl);
      console.log(`[Telegram Bot] Attached video to existing product "${existingItem.name}" (ID: ${existingItem.id})`);
    }

    // Save message log linked to existing product
    const messageLog = await createTelegramMessageRecord({
      userId,
      telegramMessageId: messageIds.join(','),
      senderName,
      senderUsername,
      caption: caption || `(Intento duplicado - Lote de ${photos.length} fotos${videoUrl ? ' + video' : ''})`,
      photoUrl: primaryPhoto,
      processedStatus: 'duplicate',
      extractedData: JSON.stringify({
        ...parsed,
        duplicateOfSku: existingItem.sku,
        imagesCount: photos.length,
        hasVideo: Boolean(videoUrl),
      }),
      inventoryItemId: existingItem.id,
    });

    // Send duplicate notification to Telegram chat
    if (chatId) {
      const videoUpdatedNote =
        videoUrl && !existingItem.videoUrl
          ? `🎬 *Video del producto guardado y vinculado correctamente.*\n\n`
          : '';

      const duplicateMsg =
        `⚠️ *Producto ya ingresado*\n\n` +
        `El producto "*${existingItem.name}*" ya se encuentra registrado en el inventario de Comerxia App.\n\n` +
        videoUpdatedNote +
        `🏷️ *Código SKU:* \`${existingItem.sku}\`\n` +
        `📂 *Categoría:* ${existingItem.category}\n` +
        `💰 *Costo Registrado:* ${currencySym}${Number(existingItem.costPrice).toFixed(2)}\n` +
        `🏷️ *PVP Actual:* ${currencySym}${Number(existingItem.salePrice).toFixed(2)}\n` +
        `📊 *Stock en Inventario:* ${existingItem.stock} unidades\n` +
        `👤 *Proveedor:* ${existingItem.supplierName}\n\n` +
        `ℹ️ _No se ha duplicado el registro para evitar inconsistencias de inventario._`;

      await sendTelegramChatMessage(token, chatId, duplicateMsg);
    }

    return {
      isDuplicate: true,
      existingItem,
      parsed,
      messageLog,
    };
  }

  // 5. Generate sequential SKU representing up to 3 letters of supplier (e.g. JUA00001)
  let finalSku = parsed.sku;
  const supplierPrefix = getSupplierSkuPrefix(senderName);
  if (!finalSku || finalSku === 'AUTO' || !finalSku.toUpperCase().startsWith(supplierPrefix)) {
    finalSku = await generateNextSku(senderName);
    parsed.sku = finalSku;
  }

  // Apply default stock if enabled in Telegram config
  const isDefaultStockActive = Boolean(config.defaultStockEnabled);
  const effectiveStock =
    isDefaultStockActive && config.defaultStockQuantity !== undefined && config.defaultStockQuantity !== null
      ? Math.max(0, Number(config.defaultStockQuantity))
      : parsed.stock;
  parsed.stock = effectiveStock;

  // 6. Create product in PostgreSQL
  const inventoryItem = await createInventoryItem({
    userId,
    name: parsed.name,
    sku: finalSku,
    description: parsed.description,
    category: parsed.category,
    costPrice: String(parsed.costPrice.toFixed(2)),
    salePrice: String(parsed.salePrice.toFixed(2)),
    stock: effectiveStock,
    imageUrl: primaryPhoto,
    videoUrl: videoUrl || null,
    supplierName: senderName,
    tags: parsed.tags.join(', '),
    extractedAttributes: JSON.stringify(attributesWithGallery),
    status: 'available',
    rawTelegramMessage: caption,
  });

  // 7. Record message log
  const messageLog = await createTelegramMessageRecord({
    userId,
    telegramMessageId: messageIds.join(','),
    senderName,
    senderUsername,
    caption: caption || `(Lote de ${photos.length} fotos${videoUrl ? ' + video' : ''})`,
    photoUrl: primaryPhoto,
    processedStatus: 'processed',
    extractedData: JSON.stringify({
      ...parsed,
      sku: finalSku,
      stock: effectiveStock,
      imagesCount: photos.length,
      videoUrl: videoUrl || null,
    }),
    inventoryItemId: inventoryItem.id,
  });

  // 8. Track as recent product for subsequent rapid forwarded photos/videos
  const trackerKey = `${chatId || ''}_${senderName}`;
  recentProducts.set(trackerKey, {
    itemId: inventoryItem.id,
    name: parsed.name,
    timestamp: Date.now(),
    chatId,
    supplierName: senderName,
  });

  // 9. Send rich confirmation to Telegram
  if (chatId) {
    const profit = (parsed.salePrice - parsed.costPrice).toFixed(2);
    const photoCountNote =
      photos.length > 1 ? `📸 *Galería:* ${photos.length} fotografías vinculadas al producto\n` : '';
    const videoNote = videoUrl ? `🎬 *Video del producto:* Guardado y listo para la tienda / catálogo\n` : '';

    let costSection = `💰 *Costo:* ${currencySym}${parsed.costPrice.toFixed(2)}`;
    if (parsed.costOptions && parsed.costOptions.length > 1) {
      const hasAffiliate = parsed.costOptions.some((o) => /afiliad/i.test(o.label));
      const modeNote = hasAffiliate ? 'Precio afiliado por 1 unidad por defecto' : 'Mayor por defecto';
      costSection =
        `💰 *Costo Seleccionado:* ${currencySym}${parsed.costPrice.toFixed(2)} _(${modeNote})_\n` +
        `📋 *Opciones de Costo Detectadas:*\n` +
        parsed.costOptions
          .map((o) => `   • ${o.label}: ${currencySym}${Number(o.price).toFixed(2)}`)
          .join('\n');
    }

    const stockMsg = isDefaultStockActive
      ? `📊 *Stock Ingresado:* ${effectiveStock} unidades _(Stock predeterminado)_\n\n`
      : `📊 *Stock Ingresado:* ${effectiveStock} unidades\n\n`;

    const responseText =
      `✅ *¡Producto Registrado con Éxito en PostgreSQL!*\n\n` +
      `📦 *${parsed.name}*\n` +
      `👤 *Proveedor:* ${senderName}${senderUsername ? ` (${senderUsername})` : ''}\n` +
      photoCountNote +
      videoNote +
      `🏷️ *SKU:* \`${finalSku}\`\n` +
      `📂 *Categoría:* ${parsed.category}\n` +
      `${costSection}\n` +
      `🏷️ *PVP Sugerido (${parsed.profitMarginPercent || config.defaultMarginPercent || 30}%):* ${currencySym}${parsed.salePrice.toFixed(2)}\n` +
      `📈 *Margen Estimado:* +${currencySym}${profit}\n` +
      stockMsg +
      `⚡ _Ya puedes verlo con todas sus opciones de costo, video y fotos en tu panel de inventario._`;

    await sendTelegramChatMessage(token, chatId, responseText);
  }

  console.log(
    `[Telegram Bot] Product "${parsed.name}" (SKU: ${finalSku}, ID: ${inventoryItem.id}) created with ${photos.length} photo(s)${videoUrl ? ' and 1 video' : ''}.`
  );

  return {
    parsed,
    inventoryItem,
    messageLog,
  };
}

/**
 * Processes an incoming Telegram message (with album / multi-photo detection)
 */
export async function processTelegramMessage(
  token: string,
  message: any,
  userId: number = 1
) {
  if (!message) return null;

  const chatId = message.chat?.id;
  const messageId = String(message.message_id);
  const text = message.text || message.caption || '';
  const mediaGroupId = message.media_group_id ? String(message.media_group_id) : null;

  const { senderName, senderUsername } = extractSupplierFromMessage(message);

  // 1. Handle commands like /start or /help
  if (text.startsWith('/start') || text.startsWith('/help')) {
    if (chatId) {
      const welcomeMsg =
        `👋 *¡Hola ${senderName}! Tu Bot de Inventario IA está activo.*\n\n` +
        `📦 *¿Cómo funciona?*\n` +
        `Reenvíame o envíame fotos de productos (puedes enviar *álbumes de varias fotos del mismo producto*), listas de precios o textos con descripciones (ej: _"Zapatillas Nike Air Max $45 stock 15 tallas 40-44"_).\n\n` +
        `🤖 *Gemini 3.7 Flash* agrupará todas las fotos del producto, identificará al proveedor original y extraerá SKU, costos, PVP sugerido y stock para guardarlo en tu PostgreSQL en tiempo real.`;

      await sendTelegramChatMessage(token, chatId, welcomeMsg);
    }
    return { status: 'command_handled' };
  }

  // 2. Extract Photo or Video if present
  const photoData = await extractPhotoFromMessage(token, message);
  const videoData = await extractVideoFromMessage(token, message);

  // If no photo, no video, and text is too short / empty
  if (!photoData && !videoData && (!text || text.trim().length < 2)) {
    return null;
  }

  // 3. Case: Media Group / Telegram Album (Multiple photos / video in same album)
  if (mediaGroupId) {
    const existingBuffer = mediaGroupBuffers.get(mediaGroupId);

    if (existingBuffer) {
      clearTimeout(existingBuffer.timer);
      if (photoData) {
        existingBuffer.photos.push(photoData);
      }
      if (videoData && !existingBuffer.videoUrl) {
        existingBuffer.videoUrl = videoData.videoUrl;
      }
      if (text && text.trim().length > existingBuffer.caption.length) {
        existingBuffer.caption = text;
      }
      existingBuffer.messageIds.push(messageId);

      // Reset debounce timer to process album when all media arrived
      existingBuffer.timer = setTimeout(async () => {
        mediaGroupBuffers.delete(mediaGroupId);
        try {
          await processCompleteProduct(token, existingBuffer);
        } catch (err) {
          console.error('[Telegram Bot] Error processing media group album:', err);
        }
      }, 1400);

      return {
        status: 'buffered_media_group',
        mediaGroupId,
        photosCount: existingBuffer.photos.length,
        hasVideo: Boolean(existingBuffer.videoUrl),
      };
    } else {
      // First item of an album
      if (chatId) {
        await sendTelegramChatMessage(
          token,
          chatId,
          `⏳ *Recibiendo archivos del producto...* Agrupando fotografías/video con Gemini IA...`
        );
      }

      const newBuffer: MediaGroupBuffer = {
        mediaGroupId,
        token,
        userId,
        chatId,
        senderName,
        senderUsername,
        caption: text,
        photos: photoData ? [photoData] : [],
        videoUrl: videoData ? videoData.videoUrl : null,
        messageIds: [messageId],
        timer: setTimeout(async () => {
          mediaGroupBuffers.delete(mediaGroupId);
          try {
            await processCompleteProduct(token, newBuffer);
          } catch (err) {
            console.error('[Telegram Bot] Error processing media group album:', err);
          }
        }, 1600),
      };

      mediaGroupBuffers.set(mediaGroupId, newBuffer);
      return { status: 'buffered_media_group_init', mediaGroupId };
    }
  }

  // 4. Case: Consecutive forwarded single photos or video (User forwards photo and then video within 12 seconds)
  const trackerKey = `${chatId || ''}_${senderName}`;
  const recent = recentProducts.get(trackerKey);

  // 4a. Consecutive video forwarded after a product was created
  if (recent && videoData && (!text || text.trim().length < 5) && Date.now() - recent.timestamp < 12000) {
    console.log(`[Telegram Bot] Appending consecutive video to recent product "${recent.name}" (ID: ${recent.itemId})`);
    await setInventoryItemVideo(recent.itemId, videoData.videoUrl);
    recent.timestamp = Date.now();

    if (chatId) {
      await sendTelegramChatMessage(
        token,
        chatId,
        `🎬 *Video guardado y vinculado* al producto "*${recent.name}*". Listo para la tienda y catálogo.`
      );
    }
    return { status: 'video_appended_to_product', itemId: recent.itemId, videoUrl: videoData.videoUrl };
  }

  // 4b. Consecutive photo forwarded after a product was created
  const isRecentPhotoAppend =
    recent &&
    photoData &&
    (!text || text.trim().length < 5) &&
    Date.now() - recent.timestamp < 10000;

  if (isRecentPhotoAppend) {
    console.log(`[Telegram Bot] Appending consecutive photo to recent product "${recent.name}" (ID: ${recent.itemId})`);
    await appendImageToInventoryItem(recent.itemId, photoData.photoBase64);
    recent.timestamp = Date.now(); // extend window for another photo/video

    if (chatId) {
      await sendTelegramChatMessage(
        token,
        chatId,
        `📸 *Fotografía adicional agregada* a la galería del producto "*${recent.name}*".`
      );
    }
    return { status: 'photo_appended_to_product', itemId: recent.itemId };
  }

  // 5. Case: Single product message (with photo, video or text)
  if (chatId) {
    await sendTelegramChatMessage(
      token,
      chatId,
      `⏳ *Analizando producto con Gemini IA...* Extrayendo datos y calculando márgenes...`
    );
  }

  return await processCompleteProduct(token, {
    userId,
    chatId,
    messageIds: [messageId],
    senderName,
    senderUsername,
    caption: text,
    photos: photoData ? [photoData] : [],
    videoUrl: videoData ? videoData.videoUrl : null,
  });
}

/**
 * Synchronizes new updates immediately from Telegram (manual trigger or periodic poll)
 */
export async function syncTelegramUpdatesOnce(token?: string, userId: number = 1) {
  const effectiveToken = token || currentBotToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!effectiveToken) {
    return { success: false, error: 'No Bot Token configured' };
  }

  try {
    const url = `https://api.telegram.org/bot${effectiveToken}/getUpdates?offset=${
      lastUpdateId ? lastUpdateId + 1 : 0
    }&limit=20&timeout=2`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok) {
      // If a webhook is active, getUpdates gives 409. We can report that or clear webhook if needed.
      pollingError = data.description || 'Error fetching updates';
      return { success: false, error: data.description };
    }

    pollingError = null;
    const updates = data.result || [];
    const processed: any[] = [];

    for (const update of updates) {
      if (update.update_id >= lastUpdateId) {
        lastUpdateId = update.update_id;
      }

      const msg = update.message || update.channel_post;
      if (msg) {
        try {
          const result = await processTelegramMessage(effectiveToken, msg, userId);
          if (result) processed.push(result);
        } catch (err: any) {
          console.error('[Telegram Bot] Error processing individual update:', err);
        }
      }
    }

    return {
      success: true,
      updatesFound: updates.length,
      processedCount: processed.length,
      items: processed,
    };
  } catch (err: any) {
    pollingError = err.message;
    console.error('[Telegram Bot] Error syncing updates:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Starts continuous long-polling in the background with auto-recovery watchdog
 */
export async function startTelegramPolling(token: string, userId: number = 1) {
  if (pollingActive) {
    if (currentBotToken === token && isPollingLoopRunning) return;
    stopTelegramPolling();
  }

  currentBotToken = token;
  pollingActive = true;
  pollingAbortController = new AbortController();

  // 1. Clear any active webhooks so getUpdates works reliably without 409 Conflict
  try {
    const delRes = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
    const delData = await delRes.json();
    if (delData.ok) {
      console.log('[Telegram Bot] Webhooks cleared, ready for automatic Live Polling.');
    }
  } catch (webhookErr) {
    console.warn('[Telegram Bot] Notice while checking deleteWebhook:', webhookErr);
  }

  // 2. Validate token and get bot details
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();
    if (meData.ok) {
      currentBotInfo = meData.result;
      console.log(`[Telegram Bot] Connected as @${currentBotInfo?.username} (${currentBotInfo?.first_name})`);
    } else {
      pollingError = meData.description || 'Token inválido';
    }
  } catch (err: any) {
    console.error('[Telegram Bot] Error validating getMe:', err);
    pollingError = err.message;
  }

  // 3. Core asynchronous polling runner
  const runPollingCycle = async () => {
    if (!pollingActive || !currentBotToken || isPollingLoopRunning) return;
    isPollingLoopRunning = true;
    console.log('[Telegram Bot] Automatic Real-Time Polling worker active...');

    while (pollingActive && currentBotToken) {
      try {
        const url = `https://api.telegram.org/bot${currentBotToken}/getUpdates?offset=${
          lastUpdateId ? lastUpdateId + 1 : 0
        }&limit=10&timeout=4`;

        const res = await fetch(url, { signal: pollingAbortController?.signal });
        const data = await res.json();

        if (data.ok) {
          pollingError = null;
          const updates = data.result || [];
          for (const update of updates) {
            if (update.update_id >= lastUpdateId) {
              lastUpdateId = update.update_id;
            }
            const msg = update.message || update.channel_post || update.edited_message;
            if (msg) {
              try {
                await processTelegramMessage(currentBotToken, msg, userId);
              } catch (msgErr) {
                console.error('[Telegram Bot] Error processing incoming message update:', msgErr);
              }
            }
          }
        } else {
          // If error 409 conflict, clear webhook immediately and retry
          if (data.error_code === 409) {
            console.log('[Telegram Bot] Resolving webhook/getUpdates conflict...');
            await fetch(`https://api.telegram.org/bot${currentBotToken}/deleteWebhook`);
          } else {
            pollingError = data.description;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (err: any) {
        if (err.name === 'AbortError') break;
        pollingError = err.message;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    isPollingLoopRunning = false;
    console.log('[Telegram Bot] Real-Time Polling worker cycle ended.');
  };

  // Launch polling loop
  runPollingCycle();

  // 4. Watchdog: check every 6 seconds to ensure the polling worker never stalls
  if (watchdogInterval) clearInterval(watchdogInterval);
  watchdogInterval = setInterval(() => {
    if (pollingActive && currentBotToken && !isPollingLoopRunning) {
      console.log('[Telegram Bot] Watchdog: restarting real-time polling worker...');
      runPollingCycle();
    }
  }, 6000);
}

/**
 * Stops polling cleanly
 */
export function stopTelegramPolling() {
  pollingActive = false;
  isPollingLoopRunning = false;
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
  if (pollingAbortController) {
    pollingAbortController.abort();
    pollingAbortController = null;
  }
}
