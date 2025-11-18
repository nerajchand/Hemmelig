
<h1 align="center">Encrypted secret sharing for everyone!</h1>

<div align="center">
  Hemmelig is an encrypted sharing platform that enables secure transmission of sensitive information. All encryption occurs client-side using TweetNaCl, ensuring your data remains encrypted before it reaches our servers. The platform supports both personal and organizational use cases, with features like IP restrictions, expiration controls, and optional password protection. Whether you're sharing credentials, sensitive messages, or confidential files, Hemmelig strives to ensure your data remains private and secure.
</div>


## How it works

1. Enter your sensitive information in the application
2. Configure your secret:
   - Set expiration time
   - Add optional password
   - Set view limits or IP restrictions
3. Click "Create secret link" to generate a secure URL
4. Share the generated link with your recipient

The security model works by:

- Generating a unique encryption key for each secret
- Performing all encryption in your browser before sending to the server
- Including the decryption key only in the URL fragment (never stored on server)
- Server only stores the encrypted data, never the plain text or keys

Example encryption flow:

```javascript
encryptedData = encrypt(yourSecretData, uniqueEncryptionKey)
// Only encryptedData is sent to server
// uniqueEncryptionKey is only shared via URL as a fragment.
```

## Features

### Core Security

- Client-side encryption for all private content
- Decryption key stored only in URL fragment, never in database
- Optional password protection layer
- IP address restriction capabilities
- Rate-limited API for abuse prevention

### Secret Management

- Configurable secret lifetime
- Maximum view count limits
- Optional encrypted titles
- Base64 conversion support
- Rich text formatting with inline image support

### File Handling

- Encrypted file uploads for authenticated users
- File size and type restrictions

### Sharing Options

- Separate sharing of secret link and decryption key
- QR code generation for secret links
- Public paste option:
  - IP address logging for public pastes
  - No file upload support
  - Username-based public paste listing

### User Features

- Extended secret expiration (14 and 28 days)
- Personal file upload management
- Secret listing and deletion
- Account management

### Administrative Controls

- User registration management
- Read-only mode for non-admin users
- File upload restrictions
- User account creation controls
- Organization email domain restrictions

### Analytics Overview

When analytics are enabled (`SECRET_ANALYTICS_ENABLED=true`), administrators and creators have access to detailed visitor analytics through their account dashboard. The analytics system provides:

- Aggregated Monthly visitor analytics showing unique visitors and total visits
- Aggregated secret statistics of the current state of the instance
- Privacy-focused tracking that uses secure HMAC hashing for visitor identification
- Data caching for improved performance

All analytics data excludes bot traffic and respects user privacy by not storing raw IP addresses or personal information.

### Deployment Options

- PostgreSQL database support (production)
- SQLite database support (development/local)
- Multi-architecture Docker images (AMD64 and ARM64)
- CLI support for automation
- API for automated password generation
- Regulatory compliance support

## Docker Images

This repository automatically builds and publishes multi-architecture Docker images to GitHub Container Registry (ghcr.io) on each release.

### Image Tags

Images are automatically tagged with semantic versions:
- `ghcr.io/nerajchand/hemmelig:latest` - Latest release
- `ghcr.io/nerajchand/hemmelig:1.6.1` - Full version tag
- `ghcr.io/nerajchand/hemmelig:1.6` - Minor version tag
- `ghcr.io/nerajchand/hemmelig:1` - Major version tag

### Supported Platforms

- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64)

### Building Multi-Architecture Images

For local builds, see [MULTIARCH_BUILD.md](./MULTIARCH_BUILD.md) for detailed instructions.

Quick start:
```bash
# Build for local use (single platform)
PLATFORMS=linux/amd64 ./docker-build-multiarch.sh

# Build and push to registry (multi-arch)
PUSH=true REGISTRY=ghcr.io IMAGE_NAME=your-username/hemmelig IMAGE_TAG=v1.0.0 ./docker-build-multiarch.sh
```

## Local Development & Self-Hosting

### Using Docker Compose

The easiest way to run Hemmelig locally is using Docker Compose:

```bash
# Start the application with PostgreSQL
docker compose up -d

# View logs
docker compose logs -f

# Stop containers
docker compose down
```

The `docker-compose.yml` file includes:
- Hemmelig application
- PostgreSQL database
- Automatic database migrations

### Using Docker (SQLite)

For a minimal setup with SQLite:

```bash
mkdir -p data/hemmelig database
chown 1000:1000 data/hemmelig database

docker run -p 3000:3000 -d --name=hemmelig \
   -v ./data/hemmelig/:/var/tmp/hemmelig/upload/files \
   -v ./database/:/home/node/hemmelig/database/ \
   -e DATABASE_URL="file:./database/hemmelig.db" \
   ghcr.io/nerajchand/hemmelig:latest
```

### Environment Variables

See the [Environment variables](#environment-variables) section below for configuration options.

## CLI

Hemmelig can be used as a CLI to create secrets on the fly!

```bash
# Pipe data to hemmelig
cat mysecretfile | npx hemmelig

# For the documentaiton
npx hemmelig --help
```

## Password Generation API

Hemmelig provides a REST API endpoint for generating secure passwords and automatically creating shareable secret links. This is useful for automation, CI/CD pipelines, and programmatic password generation.

### Endpoints

- **POST** `/api/password/generate` - Generate password with JSON request body
- **GET** `/api/password/generate` - Generate password with query parameters

### POST Request Example

```bash
curl -X POST https://your-instance.com/api/password/generate \
  -H "Content-Type: application/json" \
  -d '{
    "length": 20,
    "numbers": true,
    "symbols": true,
    "uppercase": true,
    "lowercase": true,
    "excludeSimilarCharacters": false,
    "strict": true,
    "ttl": 3600,
    "maxViews": 1,
    "title": "API Generated Password",
    "showPassword": false
  }'
```

**Response:**
```json
{
  "url": "https://your-instance.com/secret/abc123#encryptionkey",
  "secretId": "abc123",
  "expiresAt": "2024-01-02T00:00:00.000Z"
}
```

### GET Request Example

```bash
curl "https://your-instance.com/api/password/generate?length=20&numbers=true&symbols=true&ttl=3600&maxViews=1&showPassword=false"
```

### Configuration Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `length` | integer | `16` | Password length (min: 4, max: 128) |
| `numbers` | boolean | `true` | Include numeric characters (0-9) |
| `symbols` | boolean | `true` | Include special characters (!@#$%^&*) |
| `uppercase` | boolean | `true` | Include uppercase letters (A-Z) |
| `lowercase` | boolean | `true` | Include lowercase letters (a-z) |
| `excludeSimilarCharacters` | boolean | `false` | Exclude similar characters (i, l, 1, L, o, 0, O) |
| `strict` | boolean | `false` | Ensure at least one character from each enabled set |
| `ttl` | integer | `86400` | Secret lifetime in seconds (1 day). Must be a valid TTL value |
| `maxViews` | integer | `1` | Maximum views before secret is deleted (min: 1, max: 999) |
| `title` | string | - | Optional title for the secret (max: 255 characters) |
| `showPassword` | boolean | `false` | Include the generated password in the response |

### Use Cases

- **Automated password generation** for new user accounts
- **CI/CD pipelines** that need to securely share generated credentials
- **Scripts** that generate temporary passwords for services
- **Integration** with other tools that need secure password generation

### Security Notes

- The generated password is encrypted client-side before being stored
- The decryption key is only included in the URL fragment (never sent to server)
- Secrets automatically expire based on the `ttl` parameter
- Secrets are deleted after reaching `maxViews` limit
- The password is only returned in the response if `showPassword: true` is set

## Environment variables

| ENV Variable                         | Description                                                  | Default              |
|---------------------------------------|--------------------------------------------------------------|----------------------|
| `SECRET_LOCAL_HOSTNAME`               | Local hostname for the Fastify instance                      | `0.0.0.0`            |
| `SECRET_PORT`                         | Port number for the Fastify instance                         | `3000`               |
| `SECRET_HOST`                         | Domain for CORS/cookies settings                             | `""`                 |
| `SECRET_MAX_TEXT_SIZE`                | Max secret text size in KB (e.g., 256 for 256 KB)            | `256`                |
| `SECRET_JWT_SECRET`                   | JWT signing secret for authentication                        | `good_luck_have_fun` |
| `SECRET_ROOT_USER`                    | Root account username                                        | `groot`              |
| `SECRET_ROOT_PASSWORD`                | Root account password                                        | `iamgroot`           |
| `SECRET_ROOT_EMAIL`                   | Root account email                                           | `groot@hemmelig.app` |
| `SECRET_FILE_SIZE`                    | Max upload file size (in MB)                                 | `4`                  |
| `SECRET_FORCED_LANGUAGE`              | Default language for the application                         | `en`                 |
| `SECRET_UPLOAD_RESTRICTION`           | Restrict uploads to signed-in users ("true"/"false")         | `"true"`             |
| `SECRET_RATE_LIMIT_MAX`               | Max requests per rate limit window                           | `1000`               |
| `SECRET_RATE_LIMIT_TIME_WINDOW`       | Rate limit time window (seconds)                             | `60`                 |
| `SECRET_DO_SPACES_ENDPOINT`           | DigitalOcean Spaces/S3 endpoint                              | `""`                 |
| `SECRET_DO_SPACES_KEY`                | DigitalOcean Spaces/S3 access key                            | `""`                 |
| `SECRET_DO_SPACES_SECRET`             | DigitalOcean Spaces/S3 secret key                            | `""`                 |
| `SECRET_DO_SPACES_BUCKET`             | DigitalOcean Spaces/S3 bucket name                           | `""`                 |
| `SECRET_DO_SPACES_FOLDER`             | DigitalOcean Spaces/S3 folder for uploads                    | `""`                 |
| `SECRET_AWS_S3_REGION`                | AWS S3 region                                                | `""`                 |
| `SECRET_AWS_S3_KEY`                   | AWS S3 access key                                            | `""`                 |
| `SECRET_AWS_S3_SECRET`                | AWS S3 secret key                                            | `""`                 |
| `SECRET_AWS_S3_BUCKET`                | AWS S3 bucket name                                           | `""`                 |
| `SECRET_AWS_S3_FOLDER`                | AWS S3 folder for uploads                                    | `""`                 |
| `SECRET_ANALYTICS_ENABLED`            | Enable analytics tracking ("true"/"false")                   | `"false"`            |
| `SECRET_ANALYTICS_HMAC_SECRET`        | HMAC secret for analytics tracking                           | `"1234567890"`       |
| `SECRET_READ_ONLY`                    | Read-only mode (only admin/creator can create secrets)       | `"false"`            |
| `SECRET_DISABLE_USERS`                | Disable user functionality                                   | `"false"`            |
| `SECRET_DISABLE_USER_ACCOUNT_CREATION`| Disable user account registration                            | `"false"`            |
| `SECRET_DISABLE_IP_RESTRICTION`       | Disable IP restriction feature                               | `"false"`            |
| `SECRET_DISABLE_FILE_UPLOAD`          | Disable file upload functionality                            | `"false"`            |
| `SECRET_RESTRICT_ORGANIZATION_EMAIL`  | Allowed email domains for registration (comma-separated)     | `""`                 |
| `SECRET_MAX_VIEWS_LIMIT`              | Max views per secret                                         | `"100"`              |
| `SECRET_ENABLE_BURN_AFTER_TIME`       | Enable "burn after expiration" (secrets deleted on max views only) | `"true"`             |
| `SECRET_DISABLE_PUBLIC_SECRETS`       | Disable public secrets feature                               | `"false"`            |

## Supported languages

Have a look at the `public/locales/` folder.

## Development

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- PostgreSQL (for production-like setup) or SQLite (for local development)

### Running Locally

```bash
# Install dependencies
npm install

# Set up the database (SQLite for local dev)
npm run prisma:migrate dev

# Start the development server
npm run dev
# Application will be available at http://0.0.0.0:3001
```

### Building Multi-Architecture Images

See [MULTIARCH_BUILD.md](./MULTIARCH_BUILD.md) for detailed instructions on building Docker images for multiple architectures.

### CI/CD

This repository uses GitHub Actions for automated builds and releases:
- **Automatic builds** on push to `main` branch
- **Semantic versioning** via semantic-release
- **Multi-architecture images** built automatically
- **Automatic tagging** with version numbers

See `.github/workflows/release.yml` for the CI/CD configuration.

## Database

Hemmelig uses Prisma ORM and supports both PostgreSQL (production) and SQLite (development/local).

### PostgreSQL (Production)

The production deployment uses PostgreSQL managed via Helm charts. Connection is configured via the `DATABASE_URL` environment variable.

### SQLite (Development/Local)

For local development, SQLite is used by default. The database file is located at:
- `/database/hemmelig.db` (when using Docker volumes)
- `./database/hemmelig.db` (when running locally)

See `docker-compose.yml` for an example of how to handle the database in Docker.

## Admin, roles and settings

Admins have access to adjust certain settings in Hemmelig. If you go to the account -> instance settings, you can see all the settings.

We also have different roles.

- Admin
- Creator
- User

The difference here is that if you i.e. set Hemmelig to be in read only mode, only `admin` and `creator` is allowed to create secrets, but non signed in users, and users with the role `user` can only view them.

Admins are also allowed to create new users in the settings. This is great if you want to limit who your users are by the `disable user account creation` setting.


## Building and Releasing

### Building Multi-Architecture Images

This repository includes scripts and workflows for building multi-architecture Docker images:

- **Local builds**: Use `docker-build-multiarch.sh` for local testing
- **CI/CD**: GitHub Actions automatically builds and pushes images on release
- **Documentation**: See [MULTIARCH_BUILD.md](./MULTIARCH_BUILD.md) for complete guide

### Release Process

1. Push changes to `main` branch
2. GitHub Actions workflow runs semantic-release
3. If a new version is detected, semantic-release:
   - Creates a git tag (e.g., `v1.6.1`)
   - Builds multi-architecture Docker images
   - Pushes images to GitHub Container Registry
   - Tags images with version numbers (full, minor, major, latest)

## Contribution

Feel free to contribute to this repository. Have a look at CONTRIBUTING.md for the guidelines.

## Common errors

If this error occurs on the first run of your Hemmelig instance, this means there are some issues with the ownership of the files/directory for the database.

```bash
Datasource "db": SQLite database "hemmelig.db" at "file:../database/hemmelig.db"

Error: Migration engine error:
SQLite database error
unable to open database file: ../database/hemmelig.db
```

If you have any issues with uploading files to your instance, you will need the following as well:

Here is an example of how you would solve that:

```bash
sudo chown -R username.group /home/username/data/
sudo chown -R username.group /home/username/database/
```
