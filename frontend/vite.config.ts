import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      name: "NotificationManagerPanel",
      fileName: () => "notification-manager-panel.js",
    },
    outDir: "../custom_components/notification_manager/frontend",
    emptyOutDir: false,
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
  },
});
