const crypto = require('crypto');

const unique = (values) => values.filter(
    (value, index) => value && values.indexOf(value) === index
);

const configuredRoots = () => unique([
    process.env.PROVIDER_TOKEN_ENCRYPTION_KEY,
    process.env.FITBIT_TOKEN_ENCRYPTION_KEY,
    process.env.REFRESH_SECRET,
]);

const deriveKey = (rootSecret, purpose) => crypto
    .createHmac('sha256', rootSecret)
    .update(purpose)
    .digest();

const getRoots = () => {
    const roots = configuredRoots();
    if (roots.length === 0) {
        throw new Error(
            'PROVIDER_TOKEN_ENCRYPTION_KEY, FITBIT_TOKEN_ENCRYPTION_KEY, or REFRESH_SECRET must be configured.'
        );
    }
    return roots;
};

const decryptWithKey = (parts, encryptionKey) => {
    const [ivValue, tagValue, encryptedValue] = parts;
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        encryptionKey,
        Buffer.from(ivValue, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
};

const encryptToken = (token) => {
    if (typeof token !== 'string' || token.length === 0) {
        throw new TypeError('A provider token is required.');
    }
    const iv = crypto.randomBytes(12);
    const key = deriveKey(getRoots()[0], 'nutrix:provider-token-encryption:v3');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v3', ...[iv, tag, encrypted].map((value) => value.toString('base64url'))].join('.');
};

const tryKeys = (parts, roots, purpose) => {
    for (const root of roots) {
        try {
            return decryptWithKey(parts, deriveKey(root, purpose));
        } catch (error) {
            // Continue through configured compatibility keys.
        }
    }
    return null;
};

const decryptToken = (value) => {
    if (!value) return null;

    try {
        const roots = getRoots();
        const parts = value.split('.');
        if (parts[0] === 'v3' && parts.length === 4) {
            return tryKeys(parts.slice(1), roots, 'nutrix:provider-token-encryption:v3');
        }
        if (parts[0] === 'v2' && parts.length === 4) {
            return tryKeys(parts.slice(1), roots, 'nutrix:fitbit-token-encryption:v2');
        }
        if (parts.length === 3 && process.env.REFRESH_SECRET) {
            const legacyKey = crypto.createHash('sha256').update(process.env.REFRESH_SECRET).digest();
            return decryptWithKey(parts, legacyKey);
        }
        return null;
    } catch (error) {
        return null;
    }
};

module.exports = { encryptToken, decryptToken };
