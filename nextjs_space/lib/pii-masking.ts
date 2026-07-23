
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
 * Email pattern with NON-overlapping quantifiers. The domain is matched as
 * explicit dot-separated labels ([A-Za-z0-9-]+ then (?:\.[A-Za-z0-9-]+)*)
 * rather than a single [A-Za-z0-9.-]+ class, so the '.' can only be consumed
 * by an explicit label boundary. This removes the ambiguity that caused
 * catastrophic backtracking (quadratic/exponential blowup) on adversarial
 * inputs like 'a@' + 'a.'.repeat(50000) + '!'.
 */
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g

/** Upper bound on the length of any single value we attempt to mask (a defense
 * against pathological regex runtime on very large text/JSON column values). */
const MAX_MASK_LENGTH = 4096

/**
 * Detects if string contains email
 */
export function containsEmail(text: string): boolean {
  return new RegExp(EMAIL_REGEX.source).test(text)
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
 * Phone pattern requiring FORMATTING (at least the group separators must be
 * present). Bare 10-digit runs are NOT treated as phone numbers — they are
 * far more likely to be account/order ids, and masking them corrupts
 * legitimate results. Digit-boundary guards stop matches inside longer runs.
 */
const PHONE_REGEX = /(?<!\d)(?:\+?\d{1,3}[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)/g

/**
 * Detects if string contains a formatted phone number.
 */
export function containsPhone(text: string): boolean {
  return new RegExp(PHONE_REGEX.source).test(text)
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
 * Detects if string contains an SSN. Only the DASHED 3-2-4 form is treated as
 * an SSN: a bare 9-digit run is indistinguishable from a routing number,
 * account id, or order number, and masking those corrupts legitimate results.
 * The dashed form must also pass structural (SSA) validation.
 */
export function containsSSN(text: string): boolean {
  const matches = text.match(/\b\d{3}-\d{2}-\d{4}\b/g)
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

  // Skip very large values: they are almost never a single PII datum, and
  // running several global regexes over a multi-KB blob is a data-driven
  // CPU/latency risk. (Any embedded PII in such a field is not this layer's
  // job to catch.)
  if (text.length > MAX_MASK_LENGTH) return { masked: text, detected: [] }

  let masked = text
  const detected: string[] = []

  // Order matters: mask EMAIL first so digit runs inside an address's
  // local-part (e.g. a Luhn-valid number before the @) are not separately
  // rewritten by the card/phone maskers, which would produce order-dependent,
  // non-deterministic output.
  if (containsEmail(masked)) {
    masked = masked.replace(new RegExp(EMAIL_REGEX.source, 'g'), (match) => {
      detected.push('email')
      return maskEmail(match)
    })
  }

  // Mask SSN — dashed 3-2-4 form only, and only if structurally valid
  if (containsSSN(masked)) {
    masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, (match) => {
      if (!isLikelySSN(match)) return match
      detected.push('ssn')
      return maskSSN(match)
    })
  }

  // Mask Credit Cards — only numbers that pass the Luhn checksum
  if (containsCreditCard(masked)) {
    masked = masked.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, (match) => {
      if (!passesLuhn(match)) return match
      detected.push('credit_card')
      return maskCreditCard(match)
    })
  }

  // Mask Phone Numbers — formatted numbers only (bare digit runs left intact)
  if (containsPhone(masked)) {
    masked = masked.replace(new RegExp(PHONE_REGEX.source, 'g'), (match) => {
      detected.push('phone')
      return maskPhone(match)
    })
  }

  return { masked, detected: [...new Set(detected)] }
}

/**
 * True only for plain objects ({} / Object.create(null)). Dates, Buffers,
 * BigInt wrappers, and other class instances are NOT plain — recursing into
 * them with Object.entries() would strip their contents (a Date became {}).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Masks PII in query results. Strings are masked; arrays and plain objects are
 * traversed; everything else (Date, Buffer, number, boolean, null, class
 * instances) is passed through UNCHANGED so timestamps and typed values are
 * not destroyed.
 */
export function maskQueryResults(results: any): any {
  if (results === null || results === undefined) return results

  if (typeof results === 'string') {
    return maskPII(results).masked
  }

  if (Array.isArray(results)) {
    return results.map(row => maskQueryResults(row))
  }

  if (isPlainObject(results)) {
    const masked: any = {}
    for (const [key, value] of Object.entries(results)) {
      masked[key] = maskQueryResults(value)
    }
    return masked
  }

  // Date, Buffer, number, boolean, and other non-plain values: unchanged
  return results
}
