import config from 'config';
import { encrypt, generateKey } from '../../shared/helpers/crypto.js';
import VALID_TTL from '../helpers/validate-ttl.js';
import prisma from '../services/prisma.js';

const DEFAULT_EXPIRATION = 60 * 60 * 24 * 1000; // 1 day in milliseconds

// Format date to Australia/Sydney timezone in ISO format
function formatDateToSydney(date) {
    // Use Intl.DateTimeFormat to get the date parts in Sydney timezone
    const formatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === 'year').value;
    const month = parts.find((p) => p.type === 'month').value;
    const day = parts.find((p) => p.type === 'day').value;
    const hour = parts.find((p) => p.type === 'hour').value;
    const minute = parts.find((p) => p.type === 'minute').value;
    const second = parts.find((p) => p.type === 'second').value;

    // Get timezone offset for Sydney at this specific date/time
    const sydneyDate = new Date(date.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offsetMs = sydneyDate.getTime() - utcDate.getTime();
    const offsetMinutes = Math.round(offsetMs / (1000 * 60));
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    const offsetSign = offsetMinutes >= 0 ? '+' : '-';
    const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetString}`;
}

/**
 * Secret Encryption API Controller
 *
 * Provides endpoints for encrypting secrets and creating shareable secret links
 * for automation purposes. Similar to the password generation API, but accepts
 * a plain text password/secret to encrypt.
 */
async function encryptSecret(fastify) {
    /**
     * POST /api/encrypt
     *
     * Encrypt a provided secret/password, create a secret, and return a shareable URL
     *
     * Request body:
     * {
     *   "password": "my-secret-password", // Required: The secret/password to encrypt (supports multi-line text)
     *   "ttl": 86400,                      // Optional: Secret lifetime in seconds (default: 86400 = 1 day)
     *   "maxViews": 1,                     // Optional: Maximum views before secret is deleted (default: 1)
     *   "preventBurn": false,              // Optional: Prevent secret from being deleted after expiration (default: false, only if feature enabled)
     *   "title": "My Secret"              // Optional: Title for the secret (max: 255 characters)
     * }
     *
     * Response:
     * {
     *   "url": "https://hemmelig.app/secret/abc123#encryptionkey",
     *   "secretId": "abc123",
     *   "expiresAt": "2024-01-02T00:00:00.000Z"
     * }
     */
    fastify.post(
        '/',
        {
            schema: {
                body: {
                    type: 'object',
                    required: ['password'],
                    properties: {
                        password: {
                            type: 'string',
                            minLength: 1,
                        },
                        ttl: {
                            type: 'integer',
                            minimum: 1,
                            enum: VALID_TTL,
                            default: 86400,
                        },
                        maxViews: {
                            type: 'integer',
                            minimum: 1,
                            maximum: config.get('secret.maxViewsLimit'),
                            default: 1,
                        },
                        preventBurn: {
                            type: 'boolean',
                            default: false,
                        },
                        title: {
                            type: 'string',
                            maxLength: 255,
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const {
                password,
                ttl = 86400,
                maxViews = 1,
                preventBurn = false,
                title,
            } = request.body;

            // Validate password is provided and not empty
            if (!password || typeof password !== 'string' || password.trim().length === 0) {
                return reply.code(400).send({
                    error: 'Password is required and must be a non-empty string',
                });
            }

            // Validate maxViews
            const maxViewsNum = parseInt(maxViews, 10);
            const maxViewsLimit = config.get('secret.maxViewsLimit');
            if (isNaN(maxViewsNum) || maxViewsNum < 1 || maxViewsNum > maxViewsLimit) {
                return reply.code(400).send({
                    error: `maxViews must be a number between 1 and ${maxViewsLimit}`,
                });
            }

            // Validate preventBurn is only used if feature is enabled
            const enableBurnAfterTime = config.get('secret.enableBurnAfterTime');
            if (!enableBurnAfterTime && preventBurn === false) {
                return reply.code(400).send({
                    error: 'Burn after time feature is disabled for this instance',
                });
            }

            // If feature is disabled, force preventBurn to true
            const finalPreventBurn = enableBurnAfterTime ? preventBurn : true;

            try {
                // Generate encryption key
                const encryptionKey = generateKey();

                // Encrypt the password/secret
                const encryptedPassword = encrypt(password, encryptionKey);

                // Encrypt the title if provided
                const encryptedTitle = title ? encrypt(title, encryptionKey) : undefined;

                // Create the secret
                const secret = await prisma.secret.create({
                    data: {
                        title: encryptedTitle,
                        maxViews: maxViewsNum,
                        preventBurn: finalPreventBurn,
                        data: encryptedPassword,
                        user_id: request?.user?.user_id ?? null,
                        expiresAt: new Date(
                            Date.now() + (parseInt(ttl) ? parseInt(ttl) * 1000 : DEFAULT_EXPIRATION)
                        ),
                        ipAddress: '',
                    },
                });

                // Update statistics
                await prisma.statistic.upsert({
                    where: {
                        id: 'secrets_created',
                    },
                    update: {
                        value: {
                            increment: 1,
                        },
                    },
                    create: { id: 'secrets_created' },
                });

                // Build the shareable URL
                // Use request host if SECRET_HOST is not set or is a placeholder
                const hostConfig = config.get('host');
                let baseUrl;

                if (
                    !hostConfig ||
                    hostConfig === 'localhost' ||
                    hostConfig === '!changeme!' ||
                    hostConfig.includes('changeme')
                ) {
                    // Use the request host from headers
                    // Check for protocol from forwarded headers or connection
                    const forwardedProto = request.headers['x-forwarded-proto'];
                    const isSecure =
                        request.secure ||
                        request.headers['x-forwarded-ssl'] === 'on' ||
                        forwardedProto === 'https';
                    const protocol = forwardedProto || (isSecure ? 'https' : 'http');
                    const host = request.headers.host || request.hostname || 'localhost:3000';
                    baseUrl = `${protocol}://${host}`;
                } else if (hostConfig.startsWith('http')) {
                    baseUrl = hostConfig;
                } else {
                    baseUrl = `https://${hostConfig}`;
                }

                const encryptionKeyBase64 = Buffer.from(encryptionKey).toString('base64');
                const shareableUrl = `${baseUrl}/secret/${secret.id}#${encryptionKeyBase64}`;

                const response = {
                    url: shareableUrl,
                    secretId: secret.id,
                    expiresAt: formatDateToSydney(secret.expiresAt),
                };

                return reply.code(200).send(response);
            } catch (error) {
                fastify.log.error(error);
                return reply.code(500).send({
                    error: 'Failed to encrypt secret and create shareable link',
                    message: error.message,
                });
            }
        }
    );

    /**
     * GET /api/encrypt
     *
     * Encrypt a secret and create a shareable link with query parameters
     *
     * Query parameters:
     * - password: The secret/password to encrypt (required, supports multi-line text when URL-encoded)
     * - ttl: Secret lifetime in seconds (default: 86400)
     * - maxViews: Maximum views (default: 1)
     * - preventBurn: Prevent burn after expiration (default: false)
     */
    fastify.get(
        '/',
        {
            schema: {
                querystring: {
                    type: 'object',
                    required: ['password'],
                    properties: {
                        password: {
                            type: 'string',
                        },
                        ttl: {
                            type: 'string',
                            pattern: '^\\d+$',
                        },
                        maxViews: {
                            type: 'string',
                            pattern: '^\\d+$',
                        },
                        preventBurn: {
                            type: 'string',
                            enum: ['true', 'false'],
                        },
                        title: {
                            type: 'string',
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const {
                password,
                ttl = '86400',
                maxViews = '1',
                preventBurn = 'false',
                title,
            } = request.query;

            // Validate password is provided
            if (!password || typeof password !== 'string' || password.trim().length === 0) {
                return reply.code(400).send({
                    error: 'Password is required and must be a non-empty string',
                });
            }

            const ttlNum = parseInt(ttl, 10);
            if (!VALID_TTL.includes(ttlNum)) {
                return reply.code(400).send({
                    error: `TTL must be one of: ${VALID_TTL.join(', ')}`,
                });
            }

            const maxViewsNum = parseInt(maxViews, 10);
            const maxViewsLimit = config.get('secret.maxViewsLimit');
            if (isNaN(maxViewsNum) || maxViewsNum < 1 || maxViewsNum > maxViewsLimit) {
                return reply.code(400).send({
                    error: `maxViews must be a number between 1 and ${maxViewsLimit}`,
                });
            }

            // Validate preventBurn is only used if feature is enabled
            const enableBurnAfterTime = config.get('secret.enableBurnAfterTime');
            const preventBurnBool = preventBurn === 'true';
            if (!enableBurnAfterTime && !preventBurnBool) {
                return reply.code(400).send({
                    error: 'Burn after time feature is disabled for this instance',
                });
            }

            // If feature is disabled, force preventBurn to true
            const finalPreventBurn = enableBurnAfterTime ? preventBurnBool : true;

            try {
                // Generate encryption key
                const encryptionKey = generateKey();

                // Encrypt the password/secret
                const encryptedPassword = encrypt(password, encryptionKey);

                // Encrypt the title if provided
                const encryptedTitle = title ? encrypt(title, encryptionKey) : undefined;

                // Create the secret
                const secret = await prisma.secret.create({
                    data: {
                        title: encryptedTitle,
                        maxViews: maxViewsNum,
                        preventBurn: finalPreventBurn,
                        data: encryptedPassword,
                        user_id: request?.user?.user_id ?? null,
                        expiresAt: new Date(Date.now() + ttlNum * 1000),
                        ipAddress: '',
                    },
                });

                // Update statistics
                await prisma.statistic.upsert({
                    where: {
                        id: 'secrets_created',
                    },
                    update: {
                        value: {
                            increment: 1,
                        },
                    },
                    create: { id: 'secrets_created' },
                });

                // Build the shareable URL
                // Use request host if SECRET_HOST is not set or is a placeholder
                const hostConfig = config.get('host');
                let baseUrl;

                if (
                    !hostConfig ||
                    hostConfig === 'localhost' ||
                    hostConfig === '!changeme!' ||
                    hostConfig.includes('changeme')
                ) {
                    // Use the request host from headers
                    // Check for protocol from forwarded headers or connection
                    const forwardedProto = request.headers['x-forwarded-proto'];
                    const isSecure =
                        request.secure ||
                        request.headers['x-forwarded-ssl'] === 'on' ||
                        forwardedProto === 'https';
                    const protocol = forwardedProto || (isSecure ? 'https' : 'http');
                    const host = request.headers.host || request.hostname || 'localhost:3000';
                    baseUrl = `${protocol}://${host}`;
                } else if (hostConfig.startsWith('http')) {
                    baseUrl = hostConfig;
                } else {
                    baseUrl = `https://${hostConfig}`;
                }

                const encryptionKeyBase64 = Buffer.from(encryptionKey).toString('base64');
                const shareableUrl = `${baseUrl}/secret/${secret.id}#${encryptionKeyBase64}`;

                const response = {
                    url: shareableUrl,
                    secretId: secret.id,
                    expiresAt: formatDateToSydney(secret.expiresAt),
                };

                return reply.code(200).send(response);
            } catch (error) {
                fastify.log.error(error);
                return reply.code(500).send({
                    error: 'Failed to encrypt secret and create shareable link',
                    message: error.message,
                });
            }
        }
    );
}

export default encryptSecret;
