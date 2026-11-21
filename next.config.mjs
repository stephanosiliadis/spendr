/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Only pull in the modules actually used from these barrel-heavy packages.
    optimizePackageImports: ["recharts", "lucide-react", "date-fns", "react-day-picker"],
  },
};

export default nextConfig;
