import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Tesseract starts its own Node worker. Keeping it external prevents Next
    // from rewriting worker-script paths into a non-existent .next route.
    serverComponentsExternalPackages: ["tesseract.js"],
  },
  webpack(config) {
    // ppu-paddle-ocr's browser entry imports `onnxruntime-web`, whose Node
    // conditional export is otherwise selected while Next builds the client
    // graph. Pin it to the WASM browser bundle so Terser never sees ort.node.
    config.resolve.alias["onnxruntime-web$"] = path.resolve(
      process.cwd(),
      "node_modules/onnxruntime-web/dist/ort.wasm.min.js",
    );
    return config;
  },
};
export default nextConfig;
