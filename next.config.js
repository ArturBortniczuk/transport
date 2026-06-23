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
  },
  async headers() {
    return [
      {
        source: "/api/spedycje/webhook",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" }
        ]
      }
    ]
  }
}

module.exports = nextConfig;
