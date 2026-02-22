import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
      // Prevent bundling of Node.js-only packages in the browser
      config.resolve.alias = {
        ...config.resolve.alias,
        'sharp$': false,
        'onnxruntime-node$': false,
      };
    }

    // Support WASM and ONNX files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    return config;
  },
};

export default nextConfig;

