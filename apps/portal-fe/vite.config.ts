import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Portal chạy sau EDGE nginx (TLS 443). Vite dev server nghe 5173 trong container;
// EDGE proxy `/` vào đây. HMR websocket đi qua EDGE TLS nên clientPort = cổng
// https public (mặc định 443), có thể đổi bằng biến VITE_PUBLIC_HTTPS_PORT.
const publicHttpsPort = Number.parseInt(
  process.env.VITE_PUBLIC_HTTPS_PORT ?? "443",
  10,
);

export default defineConfig({
  plugins: [react()],
  // @pmh/shared là workspace-link build CJS — Vite không pre-bundle linked
  // package mặc định → browser import named từ CJS sẽ crash. Ép pre-bundle:
  optimizeDeps: { include: ["@pmh/shared"] },
  build: {
    commonjsOptions: { include: [/shared/, /node_modules/] },
    // Tách vendor ổn định (react, antd) thành chunk riêng → cache lâu, đổi code app
    // KHÔNG bust cả cục. Swiper/framer-motion/scene 3D nằm trong chunk async của
    // Launcher (React.lazy) nên KHÔNG vào bundle trang login.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          antd: ["antd", "@ant-design/icons"],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // Sau Nginx: Host do proxy đặt (localhost dev / admin-de.pmh.com.vn prod)
    allowedHosts: ["localhost", "admin-de.pmh.com.vn"],
    hmr: {
      protocol: "wss",
      clientPort: publicHttpsPort,
    },
  },
});
