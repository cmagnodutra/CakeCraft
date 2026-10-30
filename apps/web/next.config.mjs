/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Nao anuncia "X-Powered-By: Next.js" nas respostas (OWASP: Security
  // Misconfiguration - menos informacao para quem faz reconhecimento).
  poweredByHeader: false,
  // Gera bundle autonomo (.next/standalone) no build de container Linux/Azure,
  // evitando symlinks que exigem Developer Mode no Windows local.
  ...(process.env.NEXT_OUTPUT_STANDALONE === 'true' ? { output: 'standalone' } : {}),
};

export default nextConfig;
