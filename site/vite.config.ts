import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Served by GitHub Pages under the repository name.
  base: "/minix-er937-nixos/",
  plugins: [react(), tailwindcss()],
  // The page charts results/ from the repository root, one level up.
  server: { fs: { allow: [".."] } },
});
