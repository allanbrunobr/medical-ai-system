/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite uso em desenvolvimento sem HTTPS
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'microphone=(self)'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig