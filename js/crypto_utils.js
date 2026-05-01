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


// =============================================================================
//  PBKDF2 KEY DERIVATION FOR KVSTORE AUTH (added for v0.2 server rewrite)
// =============================================================================

/**
 * Derive the encryption key (encKey) from password and username.
 * Uses username+"_enc" as salt so it is distinct from authHash.
 * This key stays in the browser — it is NEVER sent to the server.
 * extractable:true so the key can be exported and stored in sessionStorage.
 * @param {string} password
 * @param {string} username
 * @returns {Promise<CryptoKey>} AES-GCM-256 key for encrypting/decrypting KV values
 */
async function deriveEncKey(password, username) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(username + '_enc'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,  // extractable — needed to store in sessionStorage
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive the authentication hash (authHash) from password and username.
 * Uses username+"_auth" as salt — different from encKey salt so server
 * cannot use authHash to derive encKey.
 * This value IS sent to the server; the server stores bcrypt(authHash).
 * @param {string} password
 * @param {string} username
 * @returns {Promise<string>} 64-char lowercase hex string (256-bit PBKDF2 output)
 */
async function deriveAuthHash(password, username) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(username + '_auth'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypt plaintext using an existing CryptoKey — no PBKDF2 per call.
 * Use this after deriving encKey once at login rather than calling encryptData()
 * which re-runs PBKDF2 for every value.
 * Output format: base64([IV(12 bytes) | ciphertext]) — no salt needed since
 * the key is already derived and stable.
 * @param {CryptoKey} cryptoKey - from deriveEncKey()
 * @param {string} plaintext
 * @returns {Promise<string>} base64 string
 */
async function encryptWithKey(cryptoKey, plaintext) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(plaintext)
  );
  const combined = new Uint8Array(12 + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), 12);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a value produced by encryptWithKey().
 * @param {CryptoKey} cryptoKey - from deriveEncKey()
 * @param {string} combinedBase64 - base64([IV(12) | ciphertext])
 * @returns {Promise<string>} decrypted plaintext
 */
async function decryptWithKey(cryptoKey, combinedBase64) {
  const combined = Uint8Array.from(atob(combinedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  );
  return new TextDecoder().decode(decryptedBuffer);
}


// =============================================================================
//  ED25519 IDENTITY KEY — DID generation and storage
// =============================================================================

function _base58btcEncode(bytes) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let n = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
    const result = [];
    while (n > 0n) {
        const rem = n % 58n;
        n = n / 58n;
        result.push(ALPHABET[Number(rem)]);
    }
    for (const byte of bytes) {
        if (byte === 0) result.push(ALPHABET[0]);
        else break;
    }
    return result.reverse().join('');
}

async function generateIdentityKeyPair() {
    const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const xBytes = Uint8Array.from(atob(publicKeyJwk.x.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const didKey = 'did:key:z' + _base58btcEncode(new Uint8Array([0xED, 0x01, ...xBytes]));
    return { keyPair, publicKeyJwk, didKey };
}

async function encryptIdentityPrivateKey(privateKey, encKey) {
    const privateJwk = await crypto.subtle.exportKey('jwk', privateKey);
    return encryptWithKey(encKey, JSON.stringify(privateJwk));
}

async function decryptIdentityPrivateKey(encryptedBase64, encKey) {
    const jwkStr = await decryptWithKey(encKey, encryptedBase64);
    return crypto.subtle.importKey('jwk', JSON.parse(jwkStr), { name: 'Ed25519' }, true, ['sign']);
}
