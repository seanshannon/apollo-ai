
/**
 * Zero-Knowledge Cryptography Library
 * 
 * This library implements a true zero-knowledge architecture where:
 * 1. All sensitive data is encrypted CLIENT-SIDE before sending to server
 * 2. Encryption keys are derived from user's password using PBKDF2-SHA256
 * 3. Server NEVER has access to encryption keys or plaintext data
 * 4. Keys are stored only in browser memory (never localStorage)
 * 
 * Based on best practices from:
 * - "Building Secure & Reliable Systems" (Google)
 * - "Clean Code" principles
 * - OWASP Security Guidelines
 * 
 * Uses Web Crypto API (natively supported in modern browsers)
 */

// Use Web Crypto API for all cryptographic operations
const getCrypto = () => {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto
  }
  // For Node.js environment
  if (typeof global !== 'undefined') {
    try {
      return require('crypto').webcrypto
    } catch {
      return null
    }
  }
  return null
}

/**
 * Key derivation parameters
 */
const PBKDF2_ITERATIONS = 600000 // OWASP recommended minimum for 2024
const SALT_LENGTH = 32
const KEY_LENGTH = 32 // 256 bits for AES-256

/**
 * Derives an encryption key from user password using PBKDF2
 * This ensures the server never knows the encryption key
 * 
 * @param password User's password
 * @param salt Unique salt for this user (stored on server, not secret)
 * @returns Derived encryption key
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const crypto = getCrypto()
  if (!crypto) {
    throw new Error('Web Crypto API not available')
  }

  // Convert password to key material
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  // Derive actual encryption key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable - key cannot be exported
    ['encrypt', 'decrypt']
  )
}

/**
 * Generates a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  const crypto = getCrypto()
  if (!crypto) {
    throw new Error('Web Crypto API not available')
  }
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

/**
 * Encrypts data using AES-GCM (authenticated encryption)
 * 
 * @param data Data to encrypt (string)
 * @param key Encryption key
 * @returns Encrypted data with IV (as base64 string)
 */
export async function encryptData(
  data: string,
  key: CryptoKey
): Promise<string> {
  const crypto = getCrypto()
  if (!crypto) {
    throw new Error('Web Crypto API not available')
  }

  // Generate a random IV (Initialization Vector)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  // Encrypt the data
  const encodedData = new TextEncoder().encode(data)
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encodedData
  )

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encryptedData), iv.length)

  // Convert to base64 for storage
  return arrayBufferToBase64(combined)
}

/**
 * Decrypts data encrypted with encryptData
 * 
 * @param encryptedData Encrypted data (base64 string)
 * @param key Decryption key
 * @returns Decrypted data (string)
 */
export async function decryptData(
  encryptedData: string,
  key: CryptoKey
): Promise<string> {
  const crypto = getCrypto()
  if (!crypto) {
    throw new Error('Web Crypto API not available')
  }

  // Convert from base64
  const combined = base64ToArrayBuffer(encryptedData)
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)

  // Decrypt
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    data
  )

  // Convert back to string
  return new TextDecoder().decode(decryptedData)
}

/**
 * Encrypts an object (converts to JSON first)
 */
export async function encryptObject(
  obj: any,
  key: CryptoKey
): Promise<string> {
  const jsonStr = JSON.stringify(obj)
  return encryptData(jsonStr, key)
}

/**
 * Decrypts an object (parses JSON after decryption)
 */
export async function decryptObject<T>(
  encryptedData: string,
  key: CryptoKey
): Promise<T> {
  const jsonStr = await decryptData(encryptedData, key)
  return JSON.parse(jsonStr)
}

/**
 * Hashes data using SHA-256 (one-way hash for verification)
 */
export async function hashData(data: string): Promise<string> {
  const crypto = getCrypto()
  if (!crypto) {
    throw new Error('Web Crypto API not available')
  }
  
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  return arrayBufferToBase64(new Uint8Array(hashBuffer))
}

/**
 * Utility: Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Utility: Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Utility: Convert Uint8Array to hex string
 */
export function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Utility: Convert hex string to Uint8Array
 */
export function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

/**
 * Session storage for encryption key (in-memory only, never persisted)
 */
let sessionEncryptionKey: CryptoKey | null = null

export function setSessionEncryptionKey(key: CryptoKey): void {
  sessionEncryptionKey = key
}

export function getSessionEncryptionKey(): CryptoKey | null {
  return sessionEncryptionKey
}

export function clearSessionEncryptionKey(): void {
  sessionEncryptionKey = null
}

/**
 * Check if encryption key is available
 */
export function hasEncryptionKey(): boolean {
  return sessionEncryptionKey !== null
}
