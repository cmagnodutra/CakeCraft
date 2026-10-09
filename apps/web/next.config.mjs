/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Nao anuncia "X-Powered-By: Next.js" nas respostas (OWASP: Security
  // Misconfiguration - menos informacao para quem faz reconhecimento).
  poweredByHeader: false,
};

export default nextConfig;
