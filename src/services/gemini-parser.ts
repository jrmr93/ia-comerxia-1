import { GoogleGenAI, Type } from '@google/genai';

let activeCustomApiKey: string | null = null;
let aiInstance: GoogleGenAI | null = null;

export function setCustomAiApiKey(key: string | null) {
  activeCustomApiKey = key && key.trim().length > 0 ? key.trim() : null;
  aiInstance = null;
}

export function resetAiClient() {
  aiInstance = null;
}

export function getAiClient(customKey?: string): GoogleGenAI {
  const keyToUse = customKey?.trim() || activeCustomApiKey || process.env.GEMINI_API_KEY;
  if (!keyToUse) {
    throw new Error('No se ha configurado ninguna clave API de Google Gemini (GEMINI_API_KEY).');
  }

  if (customKey && customKey.trim()) {
    return new GoogleGenAI({
      apiKey: customKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: keyToUse,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

/**
 * Tests connection to Google Gemini API with a specific key and model.
 */
export async function testGeminiApiKey(
  apiKey?: string,
  modelName: string = 'gemini-3.7-flash'
): Promise<{
  success: boolean;
  model: string;
  message: string;
  latencyMs: number;
  sampleResponse?: string;
}> {
  const startTime = Date.now();
  const keyToTest = apiKey?.trim() || activeCustomApiKey || process.env.GEMINI_API_KEY;

  // Normalize legacy or deprecated model names
  let activeModel = modelName || 'gemini-3.7-flash';
  if (
    activeModel.includes('gemini-2.5') ||
    activeModel.includes('gemini-2.0') ||
    activeModel.includes('gemini-1.5')
  ) {
    activeModel = 'gemini-3.7-flash';
  }

  if (!keyToTest) {
    return {
      success: false,
      model: activeModel,
      message: 'No se ingresó ninguna API Key para validar.',
      latencyMs: 0,
    };
  }

  let modelsToTry = [
    activeModel,
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ];
  modelsToTry = Array.from(new Set(modelsToTry.filter(Boolean)));
  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    try {
      const testAi = new GoogleGenAI({
        apiKey: keyToTest,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await testAi.models.generateContent({
        model: currentModel,
        contents: 'Responde estrictamente en una sola palabra: "CONECTADO"',
        config: {
          temperature: 0.1,
        },
      });

      const latencyMs = Date.now() - startTime;
      const responseText = response.text?.trim() || 'OK';

      return {
        success: true,
        model: currentModel,
        message: `Conexión exitosa con Google Gemini (${currentModel}). Tiempo de respuesta: ${latencyMs}ms.`,
        latencyMs,
        sampleResponse: responseText,
      };
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || err?.toString() || '';
      // If error is model not found, busy or unavailable, try next candidate model
      if (
        errMsg.includes('404') ||
        errMsg.includes('NOT_FOUND') ||
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('429') ||
        errMsg.includes('no longer available')
      ) {
        continue;
      }
      break;
    }
  }

  const latencyMs = Date.now() - startTime;
  const errMsg = lastError?.message || lastError?.toString() || 'Error desconocido al validar API Key';
  console.error('Error testing Gemini API Key:', lastError);

  let friendlyMsg = errMsg;
  if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('invalid') || errMsg.includes('400')) {
    friendlyMsg = 'La API Key de Google Gemini ingresada no es válida o está revocada.';
  } else if (errMsg.includes('403') || errMsg.includes('PERMISSION_DENIED')) {
    friendlyMsg = 'Permiso denegado. Asegúrate de que la API de Gemini esté habilitada para esta clave.';
  } else if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
    friendlyMsg = 'Límite de cuota excedido (Rate Limit / Quota Exceeded). Intenta nuevamente en unos momentos.';
  }

  return {
    success: false,
    model: activeModel,
    message: friendlyMsg,
    latencyMs,
  };
}

export interface CostOption {
  label: string;
  price: number;
}

export interface ParsedProductResult {
  name: string;
  sku: string;
  category: string;
  costPrice: number;
  costOptions: CostOption[];
  profitMarginPercent: number;
  salePrice: number;
  stock: number;
  description: string;
  tags: string[];
  attributes: Record<string, string | number | string[] | any>;
  supplierNotes?: string;
  confidenceScore: number;
}

/**
 * Resolves an image input (Data URI, HTTP/HTTPS URL, or raw base64) into
 * clean base64 data and a valid MIME type for Gemini inlineData.
 */
async function resolveImageToPart(
  photoInput?: string,
  fallbackMime: string = 'image/jpeg'
): Promise<{ data: string; mimeType: string } | null> {
  if (!photoInput || typeof photoInput !== 'string') return null;

  try {
    const trimmed = photoInput.trim();

    // 1. Data URL format (data:image/...;base64,...)
    if (trimmed.startsWith('data:')) {
      const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
      if (match) {
        return {
          mimeType: match[1] || fallbackMime,
          data: match[2].trim(),
        };
      }
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx !== -1) {
        return {
          mimeType: fallbackMime,
          data: trimmed.slice(commaIdx + 1).trim(),
        };
      }
    }

    // 2. HTTP / HTTPS URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const response = await fetch(trimmed);
        if (!response.ok) {
          console.warn(`Could not fetch image URL for Gemini analysis: ${trimmed} (${response.status})`);
          return null;
        }
        const contentType = response.headers.get('content-type') || fallbackMime;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = contentType.split(';')[0].trim() || fallbackMime;

        return {
          data: buffer.toString('base64'),
          mimeType: mimeType.startsWith('image/') ? mimeType : fallbackMime,
        };
      } catch (fetchErr) {
        console.warn('Network error while downloading image for Gemini parsing:', fetchErr);
        return null;
      }
    }

    // 3. Raw base64 string
    const cleanStr = trimmed.replace(/[\r\n\s]/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(cleanStr) && cleanStr.length > 50) {
      return {
        data: cleanStr,
        mimeType: fallbackMime,
      };
    }

    return null;
  } catch (error) {
    console.warn('Error resolving image for Gemini analysis:', error);
    return null;
  }
}

/**
 * Helper to sleep for exponential backoff
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Selects the default cost price prioritizing the "precio afiliado por 1 unidad" (affiliate 1 unit price).
 * If an option specifically mentions 1 unit (e.g. "x 1", "1 unidad", "1 u", "unidad"), it is selected.
 * Otherwise, selects the highest affiliate price (which represents the 1-unit single item cost).
 * If no affiliate prices are present, defaults to the highest general cost price detected.
 */
export function selectDefaultAffiliateCostPrice(
  costOptions: CostOption[],
  fallbackParsedCost: number
): { selectedCost: number; isAffiliate: boolean; isSingleUnitAffiliate: boolean; optionLabel?: string } {
  if (!Array.isArray(costOptions) || costOptions.length === 0) {
    const cost = Math.max(0, fallbackParsedCost) || 10.0;
    return { selectedCost: cost, isAffiliate: false, isSingleUnitAffiliate: false };
  }

  // Look for options whose label mentions 'afiliad' (afiliado, afiliados, precio afiliado, costo afiliado, etc.)
  const affiliateOptions = costOptions.filter(
    (opt) =>
      opt &&
      typeof opt.label === 'string' &&
      /afiliad/i.test(opt.label) &&
      Number(opt.price) > 0
  );

  if (affiliateOptions.length > 0) {
    // 1. Look for explicit 1-unit affiliate indicator (e.g. "x 1 unidad", "1 unidad", "1 u", "1 und", "por unidad", "1 pza", "unidad")
    const oneUnitOption = affiliateOptions.find((opt) =>
      /(?:x\s*1\b|1\s*(?:u\b|und|unidad|pieza|pza)|unidad\b|unitario|detal|menor)/i.test(opt.label)
    );

    if (oneUnitOption && Number(oneUnitOption.price) > 0) {
      return {
        selectedCost: Number(oneUnitOption.price),
        isAffiliate: true,
        isSingleUnitAffiliate: true,
        optionLabel: oneUnitOption.label,
      };
    }

    // 2. If multiple affiliate options exist without explicit '1 unidad', the single-unit price is typically the highest affiliate price
    const maxAffiliatePrice = Math.max(...affiliateOptions.map((o) => Number(o.price)));
    const matchedOpt = affiliateOptions.find((o) => Number(o.price) === maxAffiliatePrice);
    return {
      selectedCost: maxAffiliatePrice > 0 ? maxAffiliatePrice : fallbackParsedCost || 10.0,
      isAffiliate: true,
      isSingleUnitAffiliate: true,
      optionLabel: matchedOpt?.label,
    };
  }

  // If no affiliate options, take the highest cost among all options or fallback
  const optionPrices = costOptions.map((o) => Number(o.price)).filter((p) => p > 0);
  const maxGeneralCost =
    optionPrices.length > 0
      ? Math.max(...optionPrices, fallbackParsedCost || 0)
      : fallbackParsedCost || 10.0;

  return { selectedCost: maxGeneralCost, isAffiliate: false, isSingleUnitAffiliate: false };
}

/**
 * Intelligent regex & heuristic extractor as a failsafe when AI APIs are overloaded
 */
function extractFallbackFromText(
  caption: string,
  defaultMarginPercent: number,
  currency: string
): ParsedProductResult {
  const text = caption.trim();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. Detect title
  let name = lines[0] || 'Producto de Proveedor';
  // If first line starts with emoji or looks like "Llegaron ...", clean it up
  name = name.replace(/^(📦|⚡|🔥|✨|✅|🚨|NUEVO|LOTE:?)\s*/i, '').slice(0, 60);

  // 2. Detect prices and affiliate prices specifically
  // Search for lines or segments matching affiliate patterns:
  // e.g. "Precio Afiliado x 1 unidad: $24.50", "Afiliado 1 unidad: $20", "Afiliados: 16.50", "Afiliado: $15"
  const affiliateOptionsFound: { label: string; price: number; isOneUnit: boolean }[] = [];
  
  for (const line of lines) {
    if (/afiliad/i.test(line)) {
      const numMatch = line.match(/\$?\s*(\d+(?:[.,]\d{1,2})?)/i);
      if (numMatch) {
        const priceVal = parseFloat(numMatch[1].replace(',', '.'));
        if (priceVal > 0 && priceVal < 50000) {
          const isOneUnit = /(?:x\s*1\b|1\s*(?:u\b|und|unidad|pieza|pza)|unidad\b|unitario|detal|menor)/i.test(line);
          let cleanLabel = line.replace(/^[•\-*👉*#]+\s*/, '').replace(/\s*c\/u\s*/i, '').trim();
          if (cleanLabel.length > 55) cleanLabel = cleanLabel.slice(0, 55);
          affiliateOptionsFound.push({
            label: cleanLabel || `Precio Afiliado (${currency} ${priceVal.toFixed(2)})`,
            price: priceVal,
            isOneUnit,
          });
        }
      }
    }
  }

  // Also extract all general price matches ($45, 45 USD, 45€, etc.)
  const priceMatches = text.match(/(?:costo|precio|mayorista|afiliad[a-z]*|\$|€|usd|s\/)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:usd|\$|€|soles)?/gi);
  const rawNumbers: number[] = [];
  if (priceMatches) {
    for (const m of priceMatches) {
      const numMatch = m.match(/\d+(?:[.,]\d{1,2})?/);
      if (numMatch) {
        const val = parseFloat(numMatch[0].replace(',', '.'));
        if (val > 0 && val < 50000 && !rawNumbers.includes(val)) rawNumbers.push(val);
      }
    }
  }

  let costPrice = 15.0;
  let costOptions: CostOption[] = [];

  if (affiliateOptionsFound.length > 0) {
    // Look for explicit 1-unit affiliate option
    const oneUnit = affiliateOptionsFound.find((o) => o.isOneUnit);
    if (oneUnit) {
      costPrice = oneUnit.price;
    } else {
      // Pick highest affiliate price (equivalent to 1-unit)
      costPrice = Math.max(...affiliateOptionsFound.map((o) => o.price));
    }

    costOptions = affiliateOptionsFound.map((o) => ({
      label: o.label,
      price: o.price,
    }));

    // Append any non-affiliate prices detected
    const foundPrices = affiliateOptionsFound.map((o) => o.price);
    const nonAffiliatePrices = rawNumbers.filter((n) => !foundPrices.includes(n));
    nonAffiliatePrices.forEach((p, idx) => {
      costOptions.push({
        label: `Opción Mayorista / General ${idx + 1} (${currency} ${p.toFixed(2)})`,
        price: p,
      });
    });
  } else {
    // Sort general prices descending
    rawNumbers.sort((a, b) => b - a);
    costPrice = rawNumbers[0] || 15.0;
    costOptions =
      rawNumbers.length > 1
        ? rawNumbers.map((p, idx) => ({
            label:
              idx === 0
                ? `Precio Mayor (${currency} ${p.toFixed(2)})`
                : `Opción ${idx + 1} (${currency} ${p.toFixed(2)})`,
            price: p,
          }))
        : [{ label: `Costo Principal (${currency} ${costPrice.toFixed(2)})`, price: costPrice }];
  }

  // 3. Detect Stock
  let stock = 1;
  const stockMatch = text.match(/(?:stock|cant|cantidad|unidades|disponibles|lote(?:\s+de)?)\s*[:=-]?\s*(\d+)/i) ||
                     text.match(/(\d+)\s*(?:unidades|pares|piezas|pcs|unds)/i);
  if (stockMatch && stockMatch[1]) {
    stock = Math.max(1, parseInt(stockMatch[1], 10));
  }

  // 4. Detect Category
  let category = 'General';
  const lower = text.toLowerCase();
  if (/zapat|sneaker|calzado|botas|sandalia|tenis|nike|adidas|puma|crocs/.test(lower)) category = 'Calzado';
  else if (/polo|camisa|vestido|pantalon|casaca|buzo|ropa|algodon|poleron/.test(lower)) category = 'Ropa y Moda';
  else if (/celular|iphone|samsung|xiaomi|cargador|funda|auricular|smartwatch|airpods/.test(lower)) category = 'Electrónica y Celulares';
  else if (/laptop|mouse|teclado|monitor|disco|computador|ram/.test(lower)) category = 'Computación y Accesorios';
  else if (/cocina|olla|termo|sarten|sabana|lampara|almohada|hogar/.test(lower)) category = 'Hogar y Cocina';
  else if (/perfume|crema|maquillaje|labial|shampoo|skincare/.test(lower)) category = 'Belleza y Cuidado Personal';
  else if (/pesa|mancuerna|balon|guante|proteina|fitness|gym/.test(lower)) category = 'Deportes y Fitness';
  else if (/taladro|herramienta|tornillo|foco|cable|pintura/.test(lower)) category = 'Ferretería y Herramientas';

  // 5. SKU generation
  const sku = 'AUTO';

  // 6. Margin & Sale price
  const profitMarginPercent = defaultMarginPercent || 30;
  const salePrice = Math.round(costPrice * (1 + profitMarginPercent / 100) * 100) / 100;

  // 7. Tags
  const tags = [category.toLowerCase(), 'telegram', 'proveedor'];
  if (lower.includes('nike')) tags.push('nike');
  if (lower.includes('adidas')) tags.push('adidas');
  if (lower.includes('original')) tags.push('original');

  return {
    name: name || 'Producto Nuevo Telegram',
    sku,
    category,
    costPrice,
    costOptions,
    profitMarginPercent,
    salePrice,
    stock,
    description: text || 'Producto importado automáticamente desde mensaje de proveedor en Telegram.',
    tags,
    attributes: {
      origen: 'Telegram Bot',
      moneda: currency,
      procesamiento: 'Extracción Heurística Automática',
    },
    supplierNotes: lines.slice(1).join(' ').slice(0, 120),
    confidenceScore: 75,
  };
}

export async function parseSupplierTelegramMessage(
  caption: string,
  photoInput?: string | string[],
  photoMimeType?: string,
  defaultMarginPercent: number = 30,
  currency: string = 'USD'
): Promise<ParsedProductResult> {
  try {
    const ai = getAiClient();

    const photoList = Array.isArray(photoInput)
      ? photoInput.filter(Boolean)
      : photoInput
      ? [photoInput]
      : [];

    const prompt = `Eres un asistente experto en gestión de inventario y comercio electrónico para una empresa.
Tu tarea es analizar un mensaje enviado por un proveedor en Telegram (que incluye texto/descripción y ${
      photoList.length > 1
        ? `${photoList.length} fotografías adjuntas del mismo producto en diferentes ángulos/detalles`
        : 'opcionalmente la foto del producto'
    }) y extraer de forma exacta todos los datos necesarios para registrar el producto en la base de datos de inventario SQL.

Instrucciones de extracción:
1. "name": Genera un título claro, profesional y comercial para el producto (ej. "Zapatillas Deportivas Nike Air Zoom", "Smartwatch Reloj Inteligente T500").
2. "sku": Código SKU alfanumérico secuencial sencillo (ej. "PF00001", "PF00002") o el código del fabricante si se menciona explícitamente. Si no hay código explícito en el texto, coloca "AUTO".
3. "category": Clasifica en una de las siguientes categorías estándar: "Calzado", "Ropa y Moda", "Electrónica y Celulares", "Computación y Accesorios", "Hogar y Cocina", "Belleza y Cuidado Personal", "Deportes y Fitness", "Juguetes y Niños", "Ferretería y Herramientas", o "General".
4. "costOptions": Si el mensaje o imagen contiene varios precios de costo (por ejemplo: precios de afiliado por unidad/volumen, escalas de cantidad, precios por mayor vs por menor, por docena, o variantes), extrae TODOS los precios disponibles en una lista de objetos { "label": string, "price": number } (ej. [{"label": "Precio Afiliado x 1 unidad", "price": 28.0}, {"label": "Precio Afiliado x 3 unidades", "price": 24.0}, {"label": "Precio Mayorista / Bulto", "price": 20.0}]). Si solo hay un único precio de costo, incluye ese único precio.
5. "costPrice": REGLA CRÍTICA OBLIGATORIA DE SELECCIÓN DE PRECIO POR DEFECTO:
   - Si en el mensaje o imagen existen precios de AFILIADO (ej. "Precio Afiliado x 1 unidad", "Afiliado 1 u", "Afiliados", "Costo Afiliado", etc.), el "costPrice" seleccionado por defecto DEBE SER OBLIGATORIAMENTE EL PRECIO AFILIADO POR 1 UNIDAD (la opción unitaria/por 1 unidad de afiliado). Si solo hay un precio de afiliado general, usa ese.
   - Si NO hay ningún precio que mencione afiliado en el mensaje, coloca como "costPrice" el precio de costo más alto general detectado.
6. "profitMarginPercent": Porcentaje de margen de ganancia a aplicar sobre el costo. Usa ${defaultMarginPercent} como valor por defecto, a menos que el mensaje del proveedor especifique explícitamente otro margen.
7. "salePrice": Si el mensaje menciona precio de venta sugerido (MSRP o PVP), úsalo. Si no, calcúlalo aplicando el profitMarginPercent sobre el costPrice seleccionado (el precio afiliado por 1 unidad) (salePrice = costPrice * (1 + profitMarginPercent/100)).
8. "stock": Cantidad de unidades disponibles mencionadas (ej. "llegaron 30 unidades", "lote de 15"). Si no especifica, pon 1.
9. "description": Redacta una descripción atractiva, estructurada y completa con viñetas sobre las características del producto, materiales, usos y ventajas tomando en cuenta las fotos adjuntas.
10. "tags": Lista de 3 a 7 etiquetas de búsqueda (ej. ["zapatillas", "running", "deportes", "nike", "calzado"]).
11. "attributes": Objeto JSON con detalles específicos extraídos (ej. colores disponibles, tallas, modelo, marca, conectividad, capacidad, garantía, etc. observados en el texto y las imágenes).
12. "supplierNotes": Notas adicionales del proveedor (condiciones de pago, entrega, disponibilidad, etc.).
13. "confidenceScore": Puntuación del 0 al 100 de qué tan confiable fue la extracción.

Texto del mensaje recibido del proveedor:
"""
${caption || '(Sin texto en el mensaje, analizar las fotos adjuntas del producto)'}
"""`;

    const contents: any[] = [];

    // Safely resolve all images provided (whether URLs, Data URIs or base64)
    for (const photo of photoList) {
      const resolvedImage = await resolveImageToPart(photo, photoMimeType || 'image/jpeg');
      if (resolvedImage && resolvedImage.data) {
        contents.push({
          inlineData: {
            data: resolvedImage.data,
            mimeType: resolvedImage.mimeType,
          },
        });
      }
    }

    contents.push(prompt);

  // Prioritize high-availability models with fast response and robust fallback
  const candidateModels = [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ];

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              sku: { type: Type.STRING },
              category: { type: Type.STRING },
              costPrice: {
                type: Type.NUMBER,
                description: 'El mayor precio de entre todos los precios que dicen AFILIADO (o el costo mas alto general si no hay precios de afiliado)',
              },
              costOptions: {
                type: Type.ARRAY,
                description: 'Lista de todos los precios de costo disponibles con su etiqueta explicativa (ej. "Precio Afiliado x 1", "Precio Afiliado x 3", "Mayorista")',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                  },
                  required: ['label', 'price'],
                },
              },
              profitMarginPercent: { type: Type.NUMBER, description: 'Porcentaje de margen de ganancia' },
              salePrice: { type: Type.NUMBER, description: 'Precio de venta al publico' },
              stock: { type: Type.INTEGER },
              description: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              attributes: {
                type: Type.OBJECT,
                description: 'Atributos clave como colores, tallas, especificaciones tecnicas',
                properties: {
                  marca: { type: Type.STRING },
                  color: { type: Type.STRING },
                  talla_o_tamano: { type: Type.STRING },
                  material: { type: Type.STRING },
                  modelo: { type: Type.STRING },
                  detalles_extra: { type: Type.STRING },
                },
              },
              supplierNotes: { type: Type.STRING },
              confidenceScore: { type: Type.INTEGER },
            },
            required: [
              'name',
              'sku',
              'category',
              'costPrice',
              'salePrice',
              'stock',
              'description',
              'tags',
            ],
          },
          temperature: 0.2,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('Empty response from model');
      }

      const parsed = JSON.parse(text) as any;

      // Extract & normalize cost options
      let costOptions: CostOption[] = [];
      if (Array.isArray(parsed.costOptions) && parsed.costOptions.length > 0) {
        costOptions = parsed.costOptions
          .map((opt: any) => ({
            label: String(opt.label || 'Opción de Costo'),
            price: Math.max(0, Number(opt.price) || 0),
          }))
          .filter((opt: CostOption) => opt.price > 0);
      }

      // Determine default cost price: prioritizes the HIGHEST price among options labeled as 'afiliad'
      const parsedCost = Math.max(0, Number(parsed.costPrice) || 0);
      const { selectedCost: finalHighestCost } = selectDefaultAffiliateCostPrice(
        costOptions,
        parsedCost
      );

      if (costOptions.length === 0) {
        costOptions = [{ label: `Costo Principal (${currency} ${finalHighestCost.toFixed(2)})`, price: finalHighestCost }];
      }

      const margin = Math.max(1, Number(parsed.profitMarginPercent) || defaultMarginPercent || 30);
      const finalSalePrice = Math.max(
        0,
        Number(parsed.salePrice) || Math.round(finalHighestCost * (1 + margin / 100) * 100) / 100
      );

      return {
        name: parsed.name || 'Producto Nuevo Telegram',
        sku: parsed.sku || `PROD-${Date.now().toString().slice(-6)}`,
        category: parsed.category || 'General',
        costPrice: finalHighestCost,
        costOptions,
        profitMarginPercent: margin,
        salePrice: finalSalePrice,
        stock: Math.max(1, Number(parsed.stock) || 1),
        description: parsed.description || caption || 'Sin descripción',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        attributes: parsed.attributes || {},
        supplierNotes: parsed.supplierNotes || '',
        confidenceScore: Number(parsed.confidenceScore) || 92,
      };
    } catch {
      // If candidate model is busy or throttled, smoothly try next model in candidate list
      continue;
    }
  }

  // If all Gemini models are experiencing temporary high demand/overload, use smart regex heuristic fallback
  return extractFallbackFromText(caption, defaultMarginPercent, currency);
} catch {
  return extractFallbackFromText(caption, defaultMarginPercent, currency);
}
}

export interface MarketingCopyOptions {
  tone?: 'persuasive' | 'direct' | 'urgency' | 'exclusive';
  storeName?: string;
  storeAddress?: string;
  websiteUrl?: string;
  whatsappNumber?: string;
  cityOrRegion?: string;
  currency?: string;
  includeDeliveryNote?: boolean;
  warrantyInfo?: string;
  paymentTitles?: string[];
  shippingCompanies?: string[];
  showStock?: boolean;
  showPhone?: boolean;
  showSku?: boolean;
  showWebsite?: boolean;
}

export interface MarketingCopyOutput {
  title?: string;
  price?: string;
  sku?: string;
  tags?: string[];
  universalDescription: string;
  paymentTitles?: string[];
  shippingCompanies?: string[];
  showStock?: boolean;
  showPhone?: boolean;
  showSku?: boolean;
  showWebsite?: boolean;
  websiteUrl?: string;
  options?: {
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
    [key: string]: any;
  };
  allInOne?: string;
  savedAt?: string;
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

export function stripTrailingTags(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  // Strip trailing lines of hashtags (#word #another) or labels (Tags: ..., Etiquetas: ..., Hashtags: ...)
  cleaned = cleaned.replace(/(\r?\n)+\s*(?:Tags|Etiquetas|Hashtags)\s*:[^\n]*$/gi, '');
  cleaned = cleaned.replace(/(\r?\n)+\s*(?:#[\w\u00C0-\u017F\d_-]+(?:\s+|$))+$/gi, '');
  cleaned = cleaned.replace(/(\r?\n)+\s*(?:Tags|Etiquetas|Hashtags)\s*:[^\n]*$/gi, '');
  cleaned = cleaned.replace(/(\r?\n)+\s*(?:#[\w\u00C0-\u017F\d_-]+(?:\s+|$))+$/gi, '');
  return cleaned.trim();
}

/**
 * Generates a single universal marketing sales publication with high converting order,
 * clean line breaks, emojis/icons, payment method titles and couriers, using Google Gemini AI.
 */
export async function generateProductMarketingCopy(
  product: {
    name: string;
    sku?: string;
    description?: string | null;
    category?: string;
    salePrice?: number | string;
    stock?: number;
    tags?: string | string[] | null;
    extractedAttributes?: string | Record<string, any> | null;
    imageUrl?: string | null;
    images?: string[];
  },
  options: MarketingCopyOptions = {}
): Promise<MarketingCopyOutput> {
  const currency = options.currency || 'USD';
  const priceVal = parseFloat(String(product.salePrice || '0')) || 0;
  const priceStr = `$${priceVal.toFixed(2)} ${currency}`;
  const storeName = options.storeName || 'Comerxia Store';
  const storeAddress = (options.storeAddress || '').trim();
  const websiteUrl = (options.websiteUrl || '').trim();
  const whatsappNumber = options.whatsappNumber || '';
  const tone = options.tone || 'persuasive';
  const cityOrRegion = options.cityOrRegion || 'Envíos a todo el país';
  const warranty = options.warrantyInfo || 'Producto 100% nuevo y garantizado contra defectos de fábrica';

  const defaultPayments = [
    'Transferencia Bancaria',
    'Banco Pichincha',
    'Banco Guayaquil',
    'Deuna',
    'Efectivo',
  ];
  const paymentTitles = (options.paymentTitles && options.paymentTitles.length > 0)
    ? options.paymentTitles.map((p) => p.trim()).filter(Boolean)
    : defaultPayments;

  const defaultShippings = [
    'Servientrega',
    'LaarCourier',
    'Cooperativas de Transporte',
    'Entregas a Domicilio',
  ];
  const shippingCompanies = (options.shippingCompanies && options.shippingCompanies.length > 0)
    ? options.shippingCompanies.map((s) => s.trim()).filter(Boolean)
    : defaultShippings;

  const paymentBulletPoints = paymentTitles.map((t) => `• ${t}`).join('\n');
  const shippingBulletPoints = shippingCompanies.map((c) => `• ${c}`).join('\n');
  const addressSectionFallback = storeAddress ? `\n\n📍 UBICACIÓN / DIRECCIÓN DE LA TIENDA:\n• ${storeAddress}` : '';
  const websiteSectionFallback = (options.showWebsite !== false && websiteUrl) ? `\n\n🌐 TIENDA ONLINE / CATÁLOGO:\n• ${websiteUrl}` : '';

  let parsedAttributes: Record<string, any> = {};
  if (product.extractedAttributes) {
    try {
      parsedAttributes =
        typeof product.extractedAttributes === 'string'
          ? JSON.parse(product.extractedAttributes)
          : product.extractedAttributes;
    } catch {}
  }

  const attributesSummary = Object.entries(parsedAttributes)
    .filter(([k]) => k !== 'images' && k !== 'totalPhotos' && k !== 'costOptions' && k !== 'selectedCostPrice' && k !== 'profitMarginPercent')
    .map(([k, v]) => `• ${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
    .join('\n');

  const showStock = options.showStock !== false;
  const showPhone = options.showPhone !== false;
  const showSku = options.showSku !== false;
  const showWebsite = options.showWebsite !== false && Boolean(websiteUrl);

  // Fallback builder with strict order, icons and double line breaks (without trailing tags)
  const buildFallbackCopies = (): MarketingCopyOutput => {
    const rawTags = Array.isArray(product.tags)
      ? product.tags
      : typeof product.tags === 'string'
      ? product.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const defaultTagsList = [
      (product.category || 'tienda').replace(/\s+/g, '').toLowerCase(),
      product.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15).toLowerCase(),
      'ventasonline',
      'marketplace',
      'oferta',
      'comprasegura',
      'enviosnacionales',
    ].filter(Boolean);

    const cleanDesc = (product.description || '').replace(/[\r\n]+/g, ' ').slice(0, 300);

    const skuLine = showSku && product.sku ? `🏷️ CÓDIGO / SKU: ${product.sku}\n` : '';
    const stockLine = showStock ? `📊 DISPONIBILIDAD: ${product.stock ?? 1} unidades listas para entrega\n` : '';
    const contactLine = showPhone && whatsappNumber
      ? `• Escríbenos por mensaje privado o al WhatsApp ${whatsappNumber} para coordinar tu entrega hoy mismo.`
      : `• Escríbenos por mensaje privado para coordinar tu entrega hoy mismo.`;

    const universalText = `🔥 ${product.name.toUpperCase()} 🔥

💰 PRECIO: ${priceStr}
📦 ESTADO: 100% Nuevo en caja sellada
${skuLine}${stockLine}
✨ CARACTERÍSTICAS DESTACADAS:
${cleanDesc ? `• ${cleanDesc}` : '• Alta calidad, durabilidad y excelente rendimiento garantizado.'}
${attributesSummary ? attributesSummary : '• Diseño moderno, ergonómico y materiales de primera.'}
• ${warranty}

📲 PEDIDOS Y CONTACTO DIRECTO:
${contactLine}

💳 MÉTODOS DE PAGO:
${paymentBulletPoints}

🚚 EMPRESAS DE ENVÍO / ENTREGAS:
${shippingBulletPoints}${addressSectionFallback}${websiteSectionFallback}`.trim();

    return {
      title: product.name.trim(),
      price: `$${priceVal.toFixed(2)}`,
      sku: product.sku || '',
      universalDescription: universalText,
      allInOne: universalText,
      tags: rawTags.length > 0 ? rawTags : defaultTagsList,
      paymentTitles,
      shippingCompanies,
      showStock,
      showPhone,
      showSku,
      showWebsite,
      websiteUrl: websiteUrl || undefined,
      savedAt: new Date().toISOString(),
    };
  };

  try {
    const ai = getAiClient();

    const toneInstructions = {
      persuasive: 'Tono persuasivo, vendedor, enfocado en beneficios, valor y solución al cliente.',
      direct: 'Tono directo, claro, conciso, enfocado en especificaciones, precio y llamada a la acción sin rodeos.',
      urgency: 'Tono de urgencia y oferta flash (¡Últimas unidades disponibles, precio especial por tiempo limitado!).',
      exclusive: 'Tono premium, elegante, destacando exclusividad, sofisticación y calidad superior.',
    }[tone];

    const prompt = `Eres un redactor publicitario profesional de comercio electrónico.
Tu tarea es generar la información de venta del producto para que el usuario pueda copiarla fácilmente en plataformas como Facebook Marketplace, Mercado Libre, Shopify, Instagram, TikTok y WhatsApp.

Genera:
1. "title": Un título de venta optimizado, atractivo y claro (ideal para el campo de título de Marketplace y tiendas online).
2. "price": El precio formateado con el símbolo de moneda (ej: "$${priceVal.toFixed(2)}").
3. "sku": El código / SKU del producto ("${product.sku || ''}").
4. "tags": Lista de 6 a 12 etiquetas o palabras clave relevantes de búsqueda (sin el símbolo #, en minúsculas) para el panel separado de tags.
5. "universalDescription": La publicación universal completa, llamativa, ordenada y lista para copiar y pegar. IMPORTANTE: NO incluyas hashtags (#), tags ni etiquetas al final de esta publicación universal; los tags van únicamente en el campo "tags".

DATOS DEL PRODUCTO:
- Nombre: ${product.name}
${showSku ? `- SKU / Código: ${product.sku || 'N/A'}` : '- (NO INCLUIR CÓDIGO / SKU EN EL TEXTO)'}
- Categoría: ${product.category || 'General'}
- Precio de Venta: ${priceStr}
${showStock ? `- Stock disponible: ${product.stock ?? 1} unidades` : '- (NO INCLUIR CANTIDAD DE STOCK / UNIDADES EN EL TEXTO)'}
- Descripción base: ${product.description || 'Producto de alta demanda y calidad.'}
- Atributos/Especificaciones:
${attributesSummary || 'Producto nuevo y garantizado'}
- Nombre de la Tienda: ${storeName}
${storeAddress ? `- Dirección / Ubicación Física de la Tienda: ${storeAddress}` : ''}
${showWebsite && websiteUrl ? `- Enlace del Catálogo / Tienda Online: ${websiteUrl}` : ''}
${showPhone ? `- WhatsApp / Teléfono de Contacto: ${whatsappNumber || 'Disponible por mensaje privado'}` : '- (NO INCLUIR NÚMEROS TELEFÓNICOS NI WHATSAPP ESPECÍFICO, solo indicar mensaje privado)'}
- Ciudad / Envíos: ${cityOrRegion}
- Garantía: ${warranty}
- Estilo/Tono: ${toneInstructions}

MÉTODOS DE PAGO DISPONIBLES:
${paymentBulletPoints}

EMPRESAS DE ENVÍO DISPONIBLES:
${shippingBulletPoints}

REGLAS ESTRICTAS DE FORMATO Y ESTRUCTURA:
1. ORDEN Y SALTOS DE LÍNEA:
   - Debe usar saltos de línea claros (doble salto de línea entre secciones) para que sea súper legible, visual y organizado.
   - Debe incluir iconos/emojis llamativos y adecuados al inicio de cada sección y viñeta.
2. ESTRUCTURA EXACTA DE LA PUBLICACIÓN UNIVERSAL:
   - Encabezado con el nombre en mayúsculas y emojis (ej: 🔥 NOMBRE 🔥)
   - 💰 PRECIO: ${priceStr}
   - 📦 ESTADO: 100% Nuevo / Garantizado
   ${showSku ? `- 🏷️ CÓDIGO / SKU: ${product.sku || 'N/A'}` : ''}
   ${showStock ? `- 📊 DISPONIBILIDAD: ${product.stock ?? 1} unidades listas para entrega` : ''}
   - ✨ CARACTERÍSTICAS Y BENEFICIOS: (viñetas con viñeta • e iconos de beneficios clave)
   - 📲 PEDIDOS Y CONTACTO DIRECTO: (${showPhone && whatsappNumber ? `llamado a la acción con WhatsApp ${whatsappNumber}` : 'llamado a la acción por mensaje privado / DM sin números telefónicos'})
   - 💳 MÉTODOS DE PAGO: (OBLIGATORIO: listar ÚNICAMENTE los títulos de los métodos de pago con viñetas •, sin descripciones, sin datos bancarios ni explicaciones)
   - 🚚 EMPRESAS DE ENVÍO / ENTREGAS: (OBLIGATORIO: listar las empresas de envío con viñetas •)
   ${storeAddress ? `- 📍 UBICACIÓN / DIRECCIÓN DE LA TIENDA:\n• ${storeAddress}` : ''}
   ${showWebsite && websiteUrl ? `- 🌐 TIENDA ONLINE / CATÁLOGO:\n• ${websiteUrl}` : ''}
   (REGLA ABSOLUTA: Termina al final tras la última sección indicada. NO añadas hashtags (#), tags ni líneas de etiquetas al final).

${!showSku ? '⚠️ REGLA CRÍTICA: NO incluyas ninguna mención de SKU ni código de producto en la publicación universal.\n' : ''}${!showStock ? '⚠️ REGLA CRÍTICA: NO incluyas stock, ni cantidad de unidades disponibles en la publicación.\n' : ''}${!showPhone ? '⚠️ REGLA CRÍTICA: NO incluyas ningún número de WhatsApp ni número de teléfono en la publicación.\n' : ''}${!showWebsite ? '⚠️ REGLA: NO incluyas enlace web ni URL de sitio web en la publicación.\n' : ''}⚠️ REGLA CRÍTICA DE TAGS: NO incluyas ningún hashtag ni lista de tags dentro ni al final de "universalDescription". Los tags se devuelven exclusivamente en el campo de array JSON "tags".

Responde ÚNICAMENTE en formato JSON con la siguiente estructura.`;

    const candidateModels = [
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ];

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: 'Título optimizado de venta para Marketplace y tiendas online',
                },
                price: {
                  type: Type.STRING,
                  description: 'Precio formateado del producto',
                },
                sku: {
                  type: Type.STRING,
                  description: 'Código SKU del producto',
                },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Lista de palabras clave y tags de búsqueda sin el símbolo #',
                },
                universalDescription: {
                  type: Type.STRING,
                  description: 'La única publicación universal completa, ordenada con iconos, saltos de línea, métodos de pago (solo títulos) y empresas de envío al final (sin hashtags ni tags al final del texto)',
                },
              },
              required: ['universalDescription', 'title'],
            },
            temperature: 0.3,
          },
        });

        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text) as MarketingCopyOutput;
          if (parsed.universalDescription && parsed.universalDescription.trim().length > 30) {
            let cleanedUniversal = stripTrailingTags(parsed.universalDescription);
            if (showWebsite && websiteUrl && !cleanedUniversal.toLowerCase().includes(websiteUrl.toLowerCase())) {
              cleanedUniversal = `${cleanedUniversal}\n\n🌐 TIENDA ONLINE / CATÁLOGO:\n• ${websiteUrl}`.trim();
            }
            parsed.title = parsed.title?.trim() || product.name.trim();
            parsed.price = parsed.price?.trim() || `$${priceVal.toFixed(2)}`;
            parsed.sku = parsed.sku?.trim() || product.sku || '';
            parsed.tags = Array.isArray(parsed.tags) && parsed.tags.length > 0
              ? parsed.tags.map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean)
              : [product.category || 'tienda', 'oferta', 'ventas'];
            parsed.universalDescription = cleanedUniversal;
            parsed.allInOne = cleanedUniversal;
            parsed.paymentTitles = paymentTitles;
            parsed.shippingCompanies = shippingCompanies;
            parsed.showStock = showStock;
            parsed.showPhone = showPhone;
            parsed.showSku = showSku;
            parsed.showWebsite = showWebsite;
            parsed.websiteUrl = websiteUrl || undefined;
            parsed.savedAt = new Date().toISOString();
            return parsed;
          }
        }
      } catch (innerErr: any) {
        const msg = innerErr?.message || String(innerErr);
        if (msg.includes('503') || msg.includes('high demand') || msg.includes('429') || msg.includes('404')) {
          continue;
        }
        console.warn(`Attempt with ${modelName} for marketing copy failed, trying next candidate:`, innerErr);
        continue;
      }
    }

    return buildFallbackCopies();
  } catch (error) {
    console.error('Error generating product marketing copy with Gemini, using fallback:', error);
    return buildFallbackCopies();
  }
}

export interface CommercialDescriptionInput {
  name: string;
  category?: string;
  description?: string;
  rawTelegramMessage?: string;
  tags?: string[] | string;
  attributes?: Record<string, any> | string;
  imageUrl?: string;
  images?: string[];
  costPrice?: string | number;
  salePrice?: string | number;
}

/**
 * Generates or regenerates an attractive, structured and complete commercial product description
 * using Gemini AI, mirroring the exact quality and format generated when products arrive via Telegram.
 */
export async function generateProductCommercialDescription(
  input: CommercialDescriptionInput
): Promise<string> {
  const {
    name,
    category = 'General',
    description = '',
    rawTelegramMessage = '',
    tags,
    attributes,
    imageUrl,
    images,
  } = input;

  const photoList: string[] = [];
  if (imageUrl && imageUrl.trim()) photoList.push(imageUrl.trim());
  if (Array.isArray(images)) {
    images.forEach((img) => {
      if (img && typeof img === 'string' && img.trim() && !photoList.includes(img.trim())) {
        photoList.push(img.trim());
      }
    });
  }

  // Format tags and attributes for prompt context
  const cleanTags = Array.isArray(tags) ? tags.join(', ') : tags || '';
  let cleanAttributes = '';
  if (attributes) {
    if (typeof attributes === 'object') {
      try {
        cleanAttributes = Object.entries(attributes)
          .filter(([k]) => !['images', 'totalPhotos', 'costOptions'].includes(k))
          .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
          .join('\n');
      } catch {}
    } else if (typeof attributes === 'string') {
      cleanAttributes = attributes;
    }
  }

  const prompt = `Eres un asistente experto en gestión de inventario y comercio electrónico para una empresa.
Tu tarea es redactar o regenerar una DESCRIPCIÓN COMERCIAL atractiva, estructurada y completa con viñetas sobre las características del producto, materiales, usos y ventajas tomando en cuenta la información y las fotos adjuntas, tal como se genera automáticamente cuando un producto llega por Telegram.

INFORMACIÓN DEL PRODUCTO:
- Nombre: ${name || 'Producto'}
- Categoría: ${category || 'General'}
${cleanTags ? `- Etiquetas / Tags: ${cleanTags}` : ''}
${cleanAttributes ? `- Especificaciones y Atributos:\n${cleanAttributes}` : ''}
${rawTelegramMessage ? `- Mensaje original recibido del proveedor:\n"""${rawTelegramMessage}"""` : ''}
${description && description !== rawTelegramMessage ? `- Información / Descripción previa:\n"""${description}"""` : ''}
${photoList.length > 0 ? `- Fotografías adjuntas: ${photoList.length} imagen(es) analizadas` : ''}

REGLAS OBLIGATORIAS DE REDACCIÓN:
1. Redacta una descripción atractiva, estructurada y completa con viñetas (•) sobre las características del producto, materiales, usos y ventajas.
2. Estructura con una introducción atractiva, seguida de las características y especificaciones destacadas con viñetas claras.
3. Resalta la calidad, versatilidad y practicidad del producto para el cliente final.
4. NO inventes precios ni incluyas códigos internos o SKUs en la descripción.
5. NO uses hashtags (#) al final.
6. Devuelve ÚNICAMENTE el texto final redactado en español listo para la ficha de producto.`;

  try {
    const ai = getAiClient();
    const contents: any[] = [];

    // Safely attach images if any
    for (const photo of photoList.slice(0, 4)) {
      const resolved = await resolveImageToPart(photo);
      if (resolved && resolved.data) {
        contents.push({
          inlineData: {
            data: resolved.data,
            mimeType: resolved.mimeType,
          },
        });
      }
    }

    contents.push(prompt);

    const candidateModels = [
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ];

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            temperature: 0.3,
          },
        });

        const text = response.text?.trim();
        if (text && text.length > 20) {
          return text;
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes('503') || msg.includes('high demand') || msg.includes('429') || msg.includes('404')) {
          continue;
        }
        console.warn(`Attempt with ${modelName} for commercial description failed, trying next candidate:`, err);
        continue;
      }
    }
  } catch (error) {
    console.error('Error generating commercial description with Gemini:', error);
  }

  // Fallback description
  return buildFallbackCommercialDescription(name, category, cleanTags, rawTelegramMessage || description);
}

function buildFallbackCommercialDescription(
  name: string,
  category: string,
  tags: string,
  notes: string
): string {
  const parts: string[] = [];
  parts.push(`${name} es la opción ideal para quienes buscan calidad, diseño moderno y excelente rendimiento.`);
  parts.push('\nCaracterísticas destacadas:');
  parts.push(`• Fabricación de alta resistencia y durabilidad garantizada.`);
  parts.push(`• Diseño ergonómico y práctico adaptado para el uso diario.`);
  parts.push(`• Excelente relación calidad-precio y versatilidad.`);
  if (category && category !== 'General') {
    parts.push(`• Categoría: ${category}.`);
  }
  if (notes && notes.trim().length > 15 && notes.trim() !== name) {
    parts.push(`\nDetalles del producto:\n• ${notes.trim().slice(0, 250)}`);
  }
  return parts.join('\n');
}

