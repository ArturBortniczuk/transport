/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Wykluczamy niepotrzebne dialekty
    config.externals = [...(config.externals || []), 'better-sqlite3', 'oracledb', 'pg-query-stream'];
    
    // Dodajemy aliasy dla nieużywanych dialektów
    config.resolve.alias = {
      ...config.resolve.alias,
      'oracledb': false,
      'pg-query-stream': false,
    };
    
    return config;
  }
}

module.exports = nextConfig;