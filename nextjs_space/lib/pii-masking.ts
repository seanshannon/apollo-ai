
/**
 * PII (Personally Identifiable Information) Detection and Masking
 * Automatically detects and masks sensitive information
 */

export interface PIIMask {
  original: string
  masked: string
  type: 'email' | 'phone' | 'ssn' | 'credit_card' | 'name' | 'address'
}

/**
 * Detects if string contains email
 */
export function containsEmail(text: string): boolean {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  return emailRegex.test(text)
}

/**
 * Masks email addresses
 */
export function maskEmail(email: string): string {
  const [username, domain] = email.split('@')
  if (username.length <= 2) {
    return `${username[0]}***@${domain}`
  }
  return `${username[0]}${username[1]}***@${domain}`
}

/**
 * Detects if string contains phone number. Digit-boundary guards stop the
 * pattern from matching inside longer digit runs (card numbers, ids).
 */
export function containsPhone(text: string): boolean {
  const phoneRegex = /(?<!\d)(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/g
  return phoneRegex.test(text)
}

/**
 * Masks phone numbers
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 10) {
    return `***-***-${digits.slice(-4)}`
  }
  return '***-****'
}

/**
 * Structural SSN validation — filters out the many 9-digit numbers that are
 * not SSNs (order numbers, ids, ...). SSA rules: area not 000/666/900-999,
 * group not 00, serial not 0000.
 */
export function isLikelySSN(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 9) return false
  const area = parseInt(digits.slice(0, 3), 10)
  const group = parseInt(digits.slice(3, 5), 10)
  const serial = parseInt(digits.slice(5), 10)
  if (area === 0 || area === 666 || area >= 900) return false
  if (group === 0) return false
  if (serial === 0) return false
  return true
}

/**
 * Detects if string contains SSN
 */
export function containsSSN(text: string): boolean {
  const matches = text.match(/\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/g)
  return !!matches && matches.some(isLikelySSN)
}

/**
 * Masks Social Security Numbers
 */
export function maskSSN(ssn: string): string {
  const digits = ssn.replace(/\D/g, '')
  if (digits.length === 9) {
    return `***-**-${digits.slice(-4)}`
  }
  return '***-**-****'
}

/**
 * Luhn checksum — real card numbers pass it; random 16-digit ids almost
 * never do, so masking is limited to plausible card numbers.
 */
export function passesLuhn(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 13) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

/**
 * Detects if string contains credit card
 */
export function containsCreditCard(text: string): boolean {
  const matches = text.match(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g)
  return !!matches && matches.some(passesLuhn)
}

/**
 * Masks credit card numbers
 */
export function maskCreditCard(cc: string): string {
  const digits = cc.replace(/\D/g, '')
  if (digits.length >= 13) {
    return `****-****-****-${digits.slice(-4)}`
  }
  return '****-****-****-****'
}

/**
 * Tokenizes a name (for anonymization)
 */
let nameTokenMap: Map<string, string> = new Map()
let nameTokenCounter = 1

export function tokenizeName(name: string): string {
  if (nameTokenMap.has(name)) {
    return nameTokenMap.get(name)!
  }
  const token = `User_${nameTokenCounter++}`
  nameTokenMap.set(name, token)
  return token
}

/**
 * Clears name token map (for testing)
 */
export function clearNameTokens() {
  nameTokenMap.clear()
  nameTokenCounter = 1
}

/**
 * Main PII masking function
 * Detects and masks all PII in a string
 */
export function maskPII(text: string): { masked: string; detected: string[] } {
  if (!text) return { masked: text, detected: [] }
  
  let masked = text
  const detected: string[] = []

  // Mask SSN — only values that structurally look like real SSNs; a bare
  // 9-digit order number or id passes through untouched
  if (containsSSN(text)) {
    masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/g, (match) => {
      if (!isLikelySSN(match)) return match
      detected.push('ssn')
      return maskSSN(match)
    })
  }

  // Mask Credit Cards — only numbers that pass the Luhn checksum
  if (containsCreditCard(text)) {
    masked = masked.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, (match) => {
      if (!passesLuhn(match)) return match
      detected.push('credit_card')
      return maskCreditCard(match)
    })
  }

  // Mask Emails
  if (containsEmail(text)) {
    masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, (match) => {
      detected.push('email')
      return maskEmail(match)
    })
  }

  // Mask Phone Numbers (digit-boundary guards keep longer digit runs intact)
  if (containsPhone(masked)) {
    masked = masked.replace(/(?<!\d)(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/g, (match) => {
      detected.push('phone')
      return maskPhone(match)
    })
  }

  return { masked, detected: [...new Set(detected)] }
}

/**
 * Masks PII in query results
 */
export function maskQueryResults(results: any): any {
  if (!results) return results

  if (Array.isArray(results)) {
    return results.map(row => maskQueryResults(row))
  }

  if (typeof results === 'object') {
    const masked: any = {}
    for (const [key, value] of Object.entries(results)) {
      if (typeof value === 'string') {
        const { masked: maskedValue } = maskPII(value)
        masked[key] = maskedValue
      } else if (typeof value === 'object') {
        masked[key] = maskQueryResults(value)
      } else {
        masked[key] = value
      }
    }
    return masked
  }

  return results
}
