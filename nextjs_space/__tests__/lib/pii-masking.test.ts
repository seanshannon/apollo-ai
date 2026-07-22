/**
 * Tests for the real PII masking module (lib/pii-masking.ts)
 */

import {
  containsEmail,
  maskEmail,
  containsPhone,
  maskPhone,
  containsSSN,
  maskSSN,
  containsCreditCard,
  maskCreditCard,
  maskPII,
  maskQueryResults,
  tokenizeName,
  clearNameTokens,
} from '@/lib/pii-masking'

describe('email masking', () => {
  it('detects emails', () => {
    expect(containsEmail('contact john.doe@example.com please')).toBe(true)
    expect(containsEmail('no email here')).toBe(false)
  })

  it('masks the local part but keeps the domain', () => {
    expect(maskEmail('john.doe@example.com')).toBe('jo***@example.com')
  })

  it('handles very short local parts', () => {
    expect(maskEmail('ab@example.com')).toBe('a***@example.com')
  })
})

describe('phone masking', () => {
  it('detects common phone formats', () => {
    expect(containsPhone('call 555-123-4567')).toBe(true)
    expect(containsPhone('call (555) 123-4567')).toBe(true)
  })

  it('keeps only the last four digits', () => {
    expect(maskPhone('555-123-4567')).toBe('***-***-4567')
  })
})

describe('SSN masking', () => {
  it('detects dashed SSNs', () => {
    expect(containsSSN('ssn is 123-45-6789')).toBe(true)
  })

  it('masks all but the last four digits', () => {
    expect(maskSSN('123-45-6789')).toBe('***-**-6789')
  })

  it('does not flag 9-digit numbers with invalid SSN structure', () => {
    expect(containsSSN('order 100000000 shipped')).toBe(false) // group 00
    expect(containsSSN('ref 987654321')).toBe(false) // area 900+
    expect(containsSSN('id 000123456')).toBe(false) // area 000
    expect(containsSSN('conf 666123456')).toBe(false) // area 666
  })

  it('leaves invalid 9-digit numbers unmasked in maskPII', () => {
    const { masked, detected } = maskPII('order number 987654321')
    expect(masked).toContain('987654321')
    expect(detected).not.toContain('ssn')
  })

  it('still masks structurally valid bare SSNs', () => {
    const { masked, detected } = maskPII('ssn 123456789')
    expect(masked).not.toContain('123456789')
    expect(detected).toContain('ssn')
  })
})

describe('credit card masking', () => {
  it('detects 16-digit card numbers with separators', () => {
    expect(containsCreditCard('4111 1111 1111 1111')).toBe(true)
    expect(containsCreditCard('4111-1111-1111-1111')).toBe(true)
  })

  it('keeps only the last four digits', () => {
    expect(maskCreditCard('4111 1111 1111 1111')).toBe('****-****-****-1111')
  })

  it('ignores 16-digit numbers that fail the Luhn checksum', () => {
    expect(containsCreditCard('tracking 1234 5678 1234 5678')).toBe(false)
    const { masked, detected } = maskPII('tracking 1234567812345678')
    expect(masked).toContain('1234567812345678')
    expect(detected).not.toContain('credit_card')
  })
})

describe('maskPII', () => {
  it('masks multiple PII types in one string and reports them', () => {
    const { masked, detected } = maskPII('Email john@example.com or call 555-123-4567')
    expect(masked).not.toContain('john@example.com')
    expect(masked).not.toContain('555-123-4567')
    expect(detected).toEqual(expect.arrayContaining(['email', 'phone']))
  })

  it('deduplicates detected types', () => {
    const { detected } = maskPII('a@b.com and c@d.com')
    expect(detected.filter((t) => t === 'email')).toHaveLength(1)
  })

  it('passes through clean text unchanged', () => {
    const { masked, detected } = maskPII('Total revenue was healthy this quarter')
    expect(masked).toBe('Total revenue was healthy this quarter')
    expect(detected).toEqual([])
  })

  it('handles empty input', () => {
    expect(maskPII('').masked).toBe('')
  })
})

describe('maskQueryResults', () => {
  it('masks string values in arrays of rows, including nested objects', () => {
    const rows = [
      { name: 'Alice', email: 'alice@example.com', meta: { phone: '555-123-4567' }, amount: 42 },
    ]
    const masked = maskQueryResults(rows)
    expect(masked[0].email).not.toContain('alice@example.com')
    expect(masked[0].meta.phone).not.toContain('555-123-4567')
    expect(masked[0].amount).toBe(42)
  })

  it('returns null/undefined unchanged', () => {
    expect(maskQueryResults(null)).toBeNull()
    expect(maskQueryResults(undefined)).toBeUndefined()
  })
})

describe('tokenizeName', () => {
  beforeEach(() => clearNameTokens())

  it('assigns stable tokens per name', () => {
    const t1 = tokenizeName('Jennifer Smith')
    const t2 = tokenizeName('Jennifer Smith')
    const t3 = tokenizeName('Someone Else')
    expect(t1).toBe(t2)
    expect(t1).not.toBe(t3)
  })
})
