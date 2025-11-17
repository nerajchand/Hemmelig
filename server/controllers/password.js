import config from 'config';
import { generate } from 'generate-password';
import { encrypt, generateKey } from '../../shared/helpers/crypto.js';
import VALID_TTL from '../helpers/validate-ttl.js';
import prisma from '../services/prisma.js';

const DEFAULT_EXPIRATION = 60 * 60 * 24 * 1000; // 1 day in milliseconds

/**
 * Password Generation API Controller
 *
 * Provides endpoints for generating secure passwords and creating shareable secret links
 * for automation purposes. Similar to the web UI workflow.
 */
async function password(fastify) {
    /**
     * POST /api/password/generate
     *
     * Generate a secure password, create a secret, and return a shareable URL
     *
     * Request body (all fields optional):
     * {
     *   "length": 16,              // Password length (default: 16, min: 4, max: 128)
     *   "numbers": true,            // Include numbers (default: true)
     *   "symbols": true,            // Include symbols (default: true)
     *   "uppercase": true,          // Include uppercase letters (default: true)
     *   "lowercase": true,          // Include lowercase letters (default: true)
     *   "excludeSimilarCharacters": false, // Exclude similar characters (default: false)
     *   "strict": false,           // Ensure at least one character from each set (default: false)
     *   "ttl": 86400,              // Secret lifetime in seconds (default: 86400 = 1 day)
     *   "maxViews": 1,             // Maximum views before secret is deleted (default: 1)
     *   "title": "Generated Password" // Optional title for the secret
     * }
     *
     * Response:
     * {
     *   "url": "https://hemmelig.app/secret/abc123#encryptionkey",
     *   "secretId": "abc123",
     *   "password": "generated-password", // Only returned for convenience, also in URL
     *   "expiresAt": "2024-01-02T00:00:00.000Z"
     * }
     */
    fastify.post(
        '/generate',
        {
            schema: {
                body: {
                    type: 'object',
                    properties: {
                        length: {
                            type: 'integer',
                            minimum: 4,
                            maximum: 128,
                            default: 16,
                        },
                        numbers: {
                            type: 'boolean',
                            default: true,
                        },
                        symbols: {
                            type: 'boolean',
                            default: true,
                        },
                        uppercase: {
                            type: 'boolean',
                            default: true,
                        },
                        lowercase: {
                            type: 'boolean',
                            default: true,
                        },
                        excludeSimilarCharacters: {
                            type: 'boolean',
                            default: false,
                        },
                        strict: {
                            type: 'boolean',
                            default: false,
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
                            maximum: 999,
                            default: 1,
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
                length = 16,
                numbers = true,
                symbols = true,
                uppercase = true,
                lowercase = true,
                excludeSimilarCharacters = false,
                strict = false,
                ttl = 86400,
                maxViews = 1,
                title,
            } = request.body;

            // Validate that at least one character set is enabled
            if (!numbers && !symbols && !uppercase && !lowercase) {
                return reply.code(400).send({
                    error: 'At least one character set must be enabled (numbers, symbols, uppercase, or lowercase)',
                });
            }

            // Validate length
            if (length < 4 || length > 128) {
                return reply.code(400).send({
                    error: 'Password length must be between 4 and 128 characters',
                });
            }

            try {
                // Generate the password
                const generatedPassword = generate({
                    length,
                    numbers,
                    symbols,
                    uppercase,
                    lowercase,
                    excludeSimilarCharacters,
                    strict,
                });

                // Generate encryption key
                const encryptionKey = generateKey();

                // Encrypt the password
                const encryptedPassword = encrypt(generatedPassword, encryptionKey);

                // Encrypt the title if provided
                const encryptedTitle = title ? encrypt(title, encryptionKey) : undefined;

                // Create the secret
                const secret = await prisma.secret.create({
                    data: {
                        title: encryptedTitle,
                        maxViews,
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

                return reply.code(200).send({
                    url: shareableUrl,
                    secretId: secret.id,
                    password: generatedPassword, // Return for convenience
                    expiresAt: secret.expiresAt,
                });
            } catch (error) {
                fastify.log.error(error);
                return reply.code(500).send({
                    error: 'Failed to generate password and create secret',
                    message: error.message,
                });
            }
        }
    );

    /**
     * GET /api/password/generate
     *
     * Generate a password and create a secret with query parameters
     *
     * Query parameters:
     * - length: Password length (default: 16)
     * - numbers: Include numbers (default: true)
     * - symbols: Include symbols (default: true)
     * - uppercase: Include uppercase (default: true)
     * - lowercase: Include lowercase (default: true)
     * - ttl: Secret lifetime in seconds (default: 86400)
     * - maxViews: Maximum views (default: 1)
     */
    fastify.get(
        '/generate',
        {
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        length: {
                            type: 'string',
                            pattern: '^\\d+$',
                        },
                        numbers: {
                            type: 'string',
                            enum: ['true', 'false'],
                        },
                        symbols: {
                            type: 'string',
                            enum: ['true', 'false'],
                        },
                        uppercase: {
                            type: 'string',
                            enum: ['true', 'false'],
                        },
                        lowercase: {
                            type: 'string',
                            enum: ['true', 'false'],
                        },
                        excludeSimilarCharacters: {
                            type: 'string',
                            enum: ['true', 'false'],
                        },
                        strict: {
                            type: 'string',
                            enum: ['true', 'false'],
                        },
                        ttl: {
                            type: 'string',
                            pattern: '^\\d+$',
                        },
                        maxViews: {
                            type: 'string',
                            pattern: '^\\d+$',
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const {
                length = '16',
                numbers = 'true',
                symbols = 'true',
                uppercase = 'true',
                lowercase = 'true',
                excludeSimilarCharacters = 'false',
                strict = 'false',
                ttl = '86400',
                maxViews = '1',
            } = request.query;

            const lengthNum = parseInt(length, 10);
            if (isNaN(lengthNum) || lengthNum < 4 || lengthNum > 128) {
                return reply.code(400).send({
                    error: 'Password length must be a number between 4 and 128',
                });
            }

            const ttlNum = parseInt(ttl, 10);
            if (!VALID_TTL.includes(ttlNum)) {
                return reply.code(400).send({
                    error: `TTL must be one of: ${VALID_TTL.join(', ')}`,
                });
            }

            const maxViewsNum = parseInt(maxViews, 10);
            if (isNaN(maxViewsNum) || maxViewsNum < 1 || maxViewsNum > 999) {
                return reply.code(400).send({
                    error: 'maxViews must be a number between 1 and 999',
                });
            }

            const options = {
                numbers: numbers === 'true',
                symbols: symbols === 'true',
                uppercase: uppercase === 'true',
                lowercase: lowercase === 'true',
                excludeSimilarCharacters: excludeSimilarCharacters === 'true',
                strict: strict === 'true',
            };

            // Validate that at least one character set is enabled
            if (!options.numbers && !options.symbols && !options.uppercase && !options.lowercase) {
                return reply.code(400).send({
                    error: 'At least one character set must be enabled (numbers, symbols, uppercase, or lowercase)',
                });
            }

            try {
                // Generate the password
                const generatedPassword = generate({
                    length: lengthNum,
                    ...options,
                });

                // Generate encryption key
                const encryptionKey = generateKey();

                // Encrypt the password
                const encryptedPassword = encrypt(generatedPassword, encryptionKey);

                // Create the secret
                const secret = await prisma.secret.create({
                    data: {
                        maxViews: maxViewsNum,
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

                return reply.code(200).send({
                    url: shareableUrl,
                    secretId: secret.id,
                    password: generatedPassword, // Return for convenience
                    expiresAt: secret.expiresAt,
                });
            } catch (error) {
                fastify.log.error(error);
                return reply.code(500).send({
                    error: 'Failed to generate password and create secret',
                    message: error.message,
                });
            }
        }
    );
}

export default password;
