import path from "path";
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const projectRoot = typeof __dirname !== "undefined" ? __dirname : process.cwd();

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(projectRoot),
  },
  outputFileTracingRoot: path.resolve(projectRoot),
};

export default withPWA(nextConfig);
