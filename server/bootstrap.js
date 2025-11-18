import config from 'config';
import getEmailDomain from '../shared/helpers/get-email-domain.js';
import adminSettings from './adminSettings.js';
import { hash } from './helpers/password.js';
import prisma from './services/prisma.js';

const username = config.get('account.root.user');
const email = config.get('account.root.email');
const password = config.get('account.root.password');

export function updateAdminSettings(settings = {}) {
    Object.keys(settings).forEach((key) => {
        adminSettings.set(key, settings[key]);
    });
}

// Create admin settings we can use by the server
async function createAdminSettings() {
    // Get default values from environment variables
    const instanceConfig = config.get('instance');

    // Process restrict_organization_email: support comma-separated list
    // Convert to comma-separated domains (extract domain from emails if needed)
    let restrictEmailDomains = '';
    if (instanceConfig.restrictOrganizationEmail) {
        const domains = instanceConfig.restrictOrganizationEmail
            .split(',')
            .map((email) => email.trim())
            .filter((email) => email.length > 0)
            .map((email) => getEmailDomain(email));
        restrictEmailDomains = domains.join(',');
    }

    const settings = await prisma.settings.upsert({
        where: { id: 'admin_settings' },
        update: {
            // Update from environment variables if they're set
            disable_users: instanceConfig.disableUsers,
            disable_user_account_creation: instanceConfig.disableUserAccountCreation,
            read_only: instanceConfig.readOnly,
            disable_file_upload: instanceConfig.disableFileUpload,
            hide_allowed_ip_input: instanceConfig.disableIpRestriction,
            restrict_organization_email: restrictEmailDomains,
        },
        create: {
            id: 'admin_settings',
            disable_users: instanceConfig.disableUsers,
            disable_user_account_creation: instanceConfig.disableUserAccountCreation,
            read_only: instanceConfig.readOnly,
            disable_file_upload: instanceConfig.disableFileUpload,
            hide_allowed_ip_input: instanceConfig.disableIpRestriction,
            restrict_organization_email: restrictEmailDomains,
        },
    });

    updateAdminSettings(settings);
}

// Remove expired secrets
async function dbCleaner() {
    try {
        await prisma.secret.deleteMany({
            where: {
                expiresAt: {
                    lte: new Date(),
                },
            },
        });
    } catch (err) {
        console.error(err, 'Nothing to delete from the database');
    }
}

// Create a root user the first time the server is running
async function createRootUser() {
    const rootUser = await prisma.user.findFirst({
        where: { username, email },
    });

    if (rootUser) {
        return;
    }

    await prisma.user.create({
        data: {
            username,
            email,
            password: await hash(password),
            generated: true,
            role: 'admin',
        },
    });
}

// Initialize the application
(async function main() {
    try {
        await createAdminSettings();
        await createRootUser();

        setInterval(() => {
            dbCleaner();
        }, 20 * 1000);
    } catch (error) {
        console.error('Failed to initialize application:', error);
    }
})();
