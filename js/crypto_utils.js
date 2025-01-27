//  crypto-utils.js  -  helper and utility functions for cryptographic operations
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright National Research Council of Canada 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

/**
 * Derive an AES-GCM key from a given password using PBKDF2.
 * @param {string} password - The password or passphrase.
 * @param {Uint8Array} salt - A random salt.
 * @returns {Promise<CryptoKey>} - The derived AES-GCM key.
 */
async function deriveKey(password, salt) {
    const enc = new TextEncoder();
  
    // 1. Convert password into a key material
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),  // raw password bytes
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
  
    // 2. Derive a key using PBKDF2
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000, // number of iterations
        hash: 'SHA-256'
      },
      keyMaterial,
      { 
        name: 'AES-GCM',
        length: 256
      },
      false,  // whether the derived key is extractable
      ['encrypt', 'decrypt']
    );
  }
  
  /**
   * Encrypt data with AES-GCM (includes generating salt + IV).
   * @param {string} password - The password or passphrase.
   * @param {string} plaintext - The data to encrypt (UTF-8).
   * @returns {Promise<string>} - Base64 string containing [salt|IV|ciphertext].
   */
  async function encryptData(password, plaintext) {
    // 1. Generate random salt (16 bytes) and IV (12 bytes) for AES-GCM
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
    // 2. Derive key from password + salt
    const key = await deriveKey(password, salt);
  
    // 3. Encrypt the plaintext
    const encoder = new TextEncoder();
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encoder.encode(plaintext)
    );
  
    // 4. Concatenate salt + IV + ciphertext
    const encryptedBytes = new Uint8Array(encryptedBuffer);
    const totalLength = salt.byteLength + iv.byteLength + encryptedBytes.byteLength;
    const combined = new Uint8Array(totalLength);
    combined.set(salt, 0);
    combined.set(iv, salt.byteLength);
    combined.set(encryptedBytes, salt.byteLength + iv.byteLength);
  
    // 5. Convert to Base64 for storage/transmission
    return btoa(String.fromCharCode(...combined));
  }
  
  /**
   * Decrypt data with AES-GCM, expecting [salt|IV|ciphertext] in Base64.
   * @param {string} password - The password or passphrase.
   * @param {string} combinedBase64 - Base64 string of [salt|IV|ciphertext].
   * @returns {Promise<string>} - The decrypted plaintext (UTF-8).
   */
  async function decryptData(password, combinedBase64) {
    // 1. Decode the Base64
    const combinedBinary = atob(combinedBase64);
    const combined = new Uint8Array(combinedBinary.length);
    for (let i = 0; i < combinedBinary.length; i++) {
      combined[i] = combinedBinary.charCodeAt(i);
    }
  
    // 2. Extract salt, IV, and ciphertext bytes
    const salt = combined.slice(0, 16);       // first 16 bytes
    const iv = combined.slice(16, 28);       // next 12 bytes
    const ciphertext = combined.slice(28);   // remaining bytes
  
    // 3. Derive the same key from password + salt
    const key = await deriveKey(password, salt);
  
    // 4. Decrypt
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      ciphertext
    );
  
    // 5. Decode result to UTF-8 text
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }
  