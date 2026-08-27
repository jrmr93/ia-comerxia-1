/**
 * Utility functions for Order processing, customer identification (C.I. / Cédula),
 * and address normalization.
 */

/**
 * Extracts or retrieves the customer's identification (Cédula de Identidad, RUC, DNI, Passport)
 * from direct properties (customerCi, ci, idCard) or extracts it from the address/notes text.
 */
export function getCustomerCi(order: any): string {
  if (!order) return '';

  // 1. Direct field checks
  if (typeof order.customerCi === 'string' && order.customerCi.trim()) {
    return order.customerCi.trim();
  }
  if (typeof order.ci === 'string' && order.ci.trim()) {
    return order.ci.trim();
  }
  if (typeof order.idCard === 'string' && order.idCard.trim()) {
    return order.idCard.trim();
  }

  // 2. Check within customerAddress
  const address = order.customerAddress || '';
  if (typeof address === 'string' && address.trim()) {
    // Regex for: CI: 0912345678, Cédula: 0912345678, C.I.: 0912345678, Identificación: ..., RUC: ..., DNI: ...
    const ciMatch = address.match(/(?:C\.?I\.?|C[eé]dula(?:\s+de\s+identidad)?|Identificaci[oó]n|RUC|DNI)[\s:]*([0-9A-Za-z-]{5,20})/i);
    if (ciMatch && ciMatch[1]) {
      return ciMatch[1].trim();
    }
  }

  // 3. Check within order notes
  const notes = order.notes || '';
  if (typeof notes === 'string' && notes.trim()) {
    const ciMatch = notes.match(/(?:C\.?I\.?|C[eé]dula(?:\s+de\s+identidad)?|Identificaci[oó]n|RUC|DNI)[\s:]*([0-9A-Za-z-]{5,20})/i);
    if (ciMatch && ciMatch[1]) {
      return ciMatch[1].trim();
    }
  }

  return '';
}

/**
 * Strips C.I., Cédula, RUC, DNI or identification segments from an address string.
 * This guarantees the delivery address field never displays or duplicates the customer's ID card.
 */
export function stripCiFromAddress(rawAddress: string | null | undefined): string {
  if (!rawAddress) return '';
  let cleaned = String(rawAddress)
    // Remove parenthesized or bracketed C.I., e.g. (C.I: 1234567890), (Cédula: 1234567890)
    .replace(/\(\s*(?:C\.?I\.?|C[eé]dula(?:\s+de\s+identidad)?|Identificaci[oó]n|RUC|DNI)[\s:]*[0-9A-Za-z-]{5,20}\s*\)/gi, '')
    .replace(/\[\s*(?:C\.?I\.?|C[eé]dula(?:\s+de\s+identidad)?|Identificaci[oó]n|RUC|DNI)[\s:]*[0-9A-Za-z-]{5,20}\s*\]/gi, '')
    // Remove C.I: 1234567890, Cédula: 1234567890, etc. with surrounding pipes, dashes or spaces
    .replace(/(?:^|[|\n,;\-–—])\s*(?:C\.?I\.?|C[eé]dula(?:\s+de\s+identidad)?|Identificaci[oó]n|RUC|DNI)[\s:]*[0-9A-Za-z-]{5,20}/gi, '')
    // Also remove standalone "C.I: [number]" pattern anywhere
    .replace(/(?:C\.?I\.?|C[eé]dula(?:\s+de\s+identidad)?|Identificaci[oó]n|RUC|DNI)[\s:]*[0-9A-Za-z-]{5,20}/gi, '')
    // Clean up empty pipe artifacts " | | " -> " | "
    .replace(/\s*\|\s*\|\s*/g, ' | ')
    .replace(/\s*,\s*,\s*/g, ', ')
    .replace(/\s*-\s*-\s*/g, ' - ')
    // Strip leading/trailing delimiters
    .replace(/^[|\s,;\-–—]+|[|\s,;\-–—]+$/g, '')
    .trim();

  return cleaned;
}

/**
 * Returns a display-ready clean address, stripping any duplicate C.I. tags.
 */
export function getCleanAddress(rawAddress: string | null | undefined): string {
  const cleaned = stripCiFromAddress(rawAddress);
  if (!cleaned) return 'No especificada';
  return cleaned;
}
