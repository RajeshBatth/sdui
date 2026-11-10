import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  define: { __DEV__: true, 'process.env.NODE_ENV': '"development"' },
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: new URL('./rn-shim.ts', import.meta.url).pathname },
      { find: /^@react-native\/assets-registry\/registry$/, replacement: new URL('./assets-registry-stub.ts', import.meta.url).pathname },
      { find: /^react-native-svg$/, replacement: 'react-native-svg/lib/module/ReactNativeSVG.web.js' },
    ],
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
  },
  optimizeDeps: { esbuildOptions: { resolveExtensions: ['.web.js', '.js', '.ts', '.tsx'] } },
  server: { port: 5199, strictPort: true },
});
