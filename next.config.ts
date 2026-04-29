import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // Tree-shake unused exports from these heavy packages so the client
    // bundle ships only what we actually import. lucide-react is intentionally
    // *not* listed — Next.js auto-optimises it when this option is unset, but
    // setting it manually breaks TS resolution for icon variables in
    // pre-existing files.
    optimizePackageImports: [
      "tldraw",
      "three",
      "@react-three/fiber",
      "@react-three/drei",
    ],
  },
};

export default nextConfig;
