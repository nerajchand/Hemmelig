import getEmailDomain from '../../shared/helpers/get-email-domain.js';
import adminSettings from '../adminSettings.js';

const authenticationRegex = /^\/api\/authentication\/signup.*$/i;
const errorMessage = 'Access denied. You are not allowed create a user. 🥲';

export default async function restrictOrganizationEmailHandler(request, reply) {
    const email = request?.body?.email ?? '';
    const { url } = request;
    const restrict = adminSettings.get('restrict_organization_email');

    if (!restrict || !authenticationRegex.test(url)) {
        return;
    }

    // Support comma-separated list of domains
    const allowedDomains = restrict
        .split(',')
        .map((domain) => domain.trim())
        .filter((domain) => domain.length > 0);

    const userDomain = getEmailDomain(email);
    const isAllowed = allowedDomains.some((domain) => getEmailDomain(domain) === userDomain);

    if (!isAllowed) {
        return reply.code(403).send({ message: errorMessage });
    }
}
