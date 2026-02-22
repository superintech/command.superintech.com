/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sit-pms/shared'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
