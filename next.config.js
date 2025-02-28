/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '8080',
                pathname: '/api/**',
            },
            {
                protocol: 'https',
                hostname: 'localhost',
                port: '8081',
                pathname: '/api/**',
            }
        ],
    },
    eslint: {
        // Only run ESLint on local development
        ignoreDuringBuilds: true,
    },
    // Add other Next.js config options here
    output: 'standalone',
};

module.exports = nextConfig; 