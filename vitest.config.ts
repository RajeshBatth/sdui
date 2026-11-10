import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      { find: /^@react-native\/assets-registry\/registry$/, replacement: new URL('./test/assets-registry-stub.ts', import.meta.url).pathname },
      { find: /^react-native-svg$/, replacement: 'react-native-svg/lib/module/ReactNativeSVG.web.js' },
    ],
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.web.js', '.js'],
  },
  test: {
    server: { deps: { inline: ['react-native-svg', 'react-native-web'] } },
    projects: [
      { extends: true, test: { name: 'core', include: ['test/**/*.test.ts'], environment: 'node' } },
      { extends: true, test: { name: 'render', include: ['test/**/*.test.tsx'], environment: 'jsdom', setupFiles: ['test/setup.ts'] } },
    ],
  },
});
