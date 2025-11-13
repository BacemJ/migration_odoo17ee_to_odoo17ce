#!/usr/bin/env node

/**
 * Generate a secure encryption key for the migration tool
 * This script generates a 32-byte (256-bit) hex key for AES-256-CBC encryption
 */

const crypto = require('crypto');

console.log('\n🔐 Generating Encryption Key for Odoo Migration Tool\n');

// Generate 32 random bytes (256 bits) and convert to hex (64 characters)
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('Your encryption key (copy this to .env.local):');
console.log('\x1b[32m%s\x1b[0m', encryptionKey);
console.log('\n📝 Add this to your .env.local file:');
console.log('\x1b[33m%s\x1b[0m', `ENCRYPTION_KEY=${encryptionKey}`);
console.log('\n⚠️  Keep this key secure and never commit it to version control!\n');
