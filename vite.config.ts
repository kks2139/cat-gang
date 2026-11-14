import aitDevtools from "@apps-in-toss/devtools/unplugin";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import path from "path"; // 1. path 모듈 임포트
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // 로컬 브라우저에서 실제 내 위치(navigator.geolocation)를 쓰도록 location 모드를 web으로
    aitDevtools.vite({ initialState: { deviceModes: { location: "web" } } }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    alias: {
      // 2. '@' 경로를 실제 './src' 폴더 주소와 연결
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
