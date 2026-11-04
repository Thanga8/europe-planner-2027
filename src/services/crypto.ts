/**
 * Hardware-grade Client-Side Zero-Knowledge Encryption using Web Crypto API
 * Uses AES-GCM (256-bit) with PBKDF2 (SHA-256, 100,000 iterations)
 * 100% on-device - zero third-party leakage.
 */

// Helper to convert ArrayBuffer to Base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 to Uint8Array
function base64ToBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives an AES-GCM 256-bit key from user PIN/passphrase using PBKDF2
 */
export async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Hashes PIN with salt to verify unlock attempts without storing raw PIN
 */
export async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const pinData = enc.encode(pin);
  const combined = new Uint8Array(pinData.length + salt.length);
  combined.set(salt, 0);
  combined.set(pinData, salt.length);

  const hashBuffer = await window.crypto.subtle.digest('SHA-256', combined);
  return bufferToBase64(hashBuffer);
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  salt: string;
}

/**
 * Encrypts a plaintext string with AES-GCM using the user's PIN
 */
export async function encryptWithPin(plaintext: string, pin: string): Promise<EncryptedPayload> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPin(pin, salt);

  const enc = new TextEncoder();
  const encodedData = enc.encode(plaintext);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encodedData
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv.buffer),
    salt: bufferToBase64(salt.buffer),
  };
}

/**
 * Decrypts an encrypted payload with AES-GCM using the user's PIN
 */
export async function decryptWithPin(payload: EncryptedPayload, pin: string): Promise<string> {
  const salt = base64ToBuffer(payload.salt);
  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.ciphertext);

  const key = await deriveKeyFromPin(pin, salt);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    ciphertext as BufferSource
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

/**
 * Generate a random 16-byte salt as base64
 */
export function generateSaltBase64(): string {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return bufferToBase64(salt.buffer);
}

/**
 * Convert file Blob/File to Base64 string for encrypted local storage
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

