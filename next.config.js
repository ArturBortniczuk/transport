/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'better-sqlite3', 'sqlite3', 'oracledb', 'pg-query-stream'];
    
    config.resolve.alias = {
      ...config.resolve.alias,
      'better-sqlite3': false,
      'sqlite3': false,
      'oracledb': false,
      'pg-query-stream': false,
    };
    
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['knex'],
  }
}

module.exports = nextConfig;
