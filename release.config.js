module.exports = {
    branches: ['main'],
    plugins: [
        [
            '@semantic-release/commit-analyzer',
            {
                // Use conventionalcommits preset but relax the header parser so
                // it tolerates leading emoji or other non-alphanumeric prefixes.
                preset: 'conventionalcommits',
                parserOpts: {
                    // Match optional non-alphanumeric characters at the start (e.g. emoji),
                    // then capture type, optional scope, and subject.
                    headerPattern: '^[^A-Za-z0-9]*([A-Za-z]+)(?:\\(([^)]+)\\))?:\\s(.*)$',
                    headerCorrespondence: ['type', 'scope', 'subject'],
                },
            },
        ],
        '@semantic-release/release-notes-generator',
        '@semantic-release/npm',
        '@semantic-release/github',
    ],
};
