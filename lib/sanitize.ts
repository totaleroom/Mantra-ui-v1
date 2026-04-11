/**
 * XSS Prevention Utilities
 * Sanitize all dynamic content before rendering
 */

// HTML entities map for escaping
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char)
}

/**
 * Sanitize message content for safe display
 * - Escapes HTML entities
 * - Removes potential script injections
 * - Preserves newlines and basic formatting
 */
export function sanitizeMessage(content: string | null | undefined): string {
  if (!content || typeof content !== 'string') return ''
  
  // First, escape HTML entities
  let sanitized = escapeHtml(content)
  
  // Remove any remaining potentially dangerous patterns
  sanitized = sanitized
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: protocol for non-image content
    .replace(/data:(?!image\/(png|jpeg|gif|webp|svg\+xml))/gi, '')
    // Remove on* event handlers that might have slipped through
    .replace(/on\w+\s*=/gi, '')
    // Remove expression() CSS
    .replace(/expression\s*\(/gi, '')
  
  return sanitized
}

/**
 * Sanitize user input for forms
 * More aggressive than message sanitization
 */
export function sanitizeInput(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return ''
  
  return input
    .trim()
    // Remove null bytes
    .replace(/\x00/g, '')
    // Remove control characters except newlines and tabs
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Escape HTML
    .replace(/[<>"']/g, (char) => HTML_ENTITIES[char] || char)
}

/**
 * Sanitize phone numbers - only allow digits and + prefix
 */
export function sanitizePhoneNumber(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return ''
  return phone.replace(/[^\d+]/g, '').slice(0, 20)
}

/**
 * Sanitize URL - validate and sanitize URLs
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return ''
  
  try {
    const parsed = new URL(url)
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return ''
    }
    return parsed.toString()
  } catch {
    return ''
  }
}

/**
 * Sanitize JSON content for AI thought process display
 */
export function sanitizeThoughtProcess(content: string | null | undefined): string {
  if (!content || typeof content !== 'string') return ''
  
  // Escape HTML but preserve JSON structure
  return content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Create a safe display component wrapper
 * Use this when rendering dynamic content
 */
export function createSafeContent(content: string): { __html: string } {
  return { __html: sanitizeMessage(content) }
}
