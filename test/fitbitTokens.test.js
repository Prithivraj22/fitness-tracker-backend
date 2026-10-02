const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

process.env.FITBIT_TOKEN_ENCRYPTION_KEY = 'test-fitbit-encryption-secret-that-is-distinct';
process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = 'test-provider-encryption-secret-that-is-distinct';
process.env.REFRESH_SECRET = 'legacy-test-refresh-secret';

const { decryptToken, encryptToken } = require('../fitbitTokens');

test('Fitbit tokens round-trip through authenticated encryption', () => {
    const encrypted = encryptToken('provider-token-value');

    assert.match(encrypted, /^v3\./);
    assert.equal(decryptToken(encrypted), 'provider-token-value');
});

test('tampered Fitbit tokens are rejected', () => {
    const encrypted = encryptToken('provider-token-value');
    const parts = encrypted.split('.');
    const ciphertext = Buffer.from(parts[3], 'base64url');
    ciphertext[0] ^= 1;
    parts[3] = ciphertext.toString('base64url');
    const tampered = parts.join('.');

    assert.equal(decryptToken(tampered), null);
});

test('tokens encrypted by the previous format remain readable', () => {
    const iv = crypto.randomBytes(12);
    const legacyKey = crypto.createHash('sha256').update(process.env.REFRESH_SECRET).digest();
    const cipher = crypto.createCipheriv('aes-256-gcm', legacyKey, iv);
    const encrypted = Buffer.concat([cipher.update('legacy-provider-token', 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const legacyValue = [iv, tag, encrypted]
        .map((value) => value.toString('base64url'))
        .join('.');

    assert.equal(decryptToken(legacyValue), 'legacy-provider-token');
});

test('version 2 Fitbit tokens remain readable after provider migration', () => {
    const iv = crypto.randomBytes(12);
    const v2Key = crypto
        .createHmac('sha256', process.env.FITBIT_TOKEN_ENCRYPTION_KEY)
        .update('nutrix:fitbit-token-encryption:v2')
        .digest();
    const cipher = crypto.createCipheriv('aes-256-gcm', v2Key, iv);
    const encrypted = Buffer.concat([cipher.update('version-two-token', 'utf8'), cipher.final()]);
    const value = ['v2', iv, cipher.getAuthTag(), encrypted]
        .map((part) => Buffer.isBuffer(part) ? part.toString('base64url') : part)
        .join('.');

    assert.equal(decryptToken(value), 'version-two-token');
});
