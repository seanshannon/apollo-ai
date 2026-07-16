
/**
 * Encryption utilities for sensitive data
 * Using AES-256 encryption with crypto-js
 */

import CryptoJS from 'crypto-js'

// SECURITY: No fallback key - ENCRYPTION_KEY must be set in environment
function getValidatedEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required but not set');
  }

  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long for security');
  }

  // Validate it's not the old default key
  if (key.includes('default') || key.includes('change-in-production')) {
    throw new Error('ENCRYPTION_KEY appears to be using a default value. Please set a secure key.');
  }

  return key;
}

// Validated lazily (and cached) so importing this module never throws when
// ENCRYPTION_KEY is absent (e.g. during `next build`); the first actual
// encrypt/decrypt call still fails loudly on a missing or weak key.
let cachedKey: string | null = null;
function getEncryptionKey(): string {
  if (cachedKey === null) {
    cachedKey = getValidatedEncryptionKey();
  }
  return cachedKey;
}

/**
 * Encrypts sensitive data
 */
export function encrypt(data: string): string {
  if (!data) return data
  try {
    return CryptoJS.AES.encrypt(data, getEncryptionKey()).toString()
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypts encrypted data
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return encryptedData
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, getEncryptionKey())
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Hash data (one-way, for passwords)
 */
export function hash(data: string): string {
  if (!data) return data
  return CryptoJS.SHA256(data).toString()
}

/**
 * Verify hashed data
 */
export function verifyHash(data: string, hashedData: string): boolean {
  return hash(data) === hashedData
}
