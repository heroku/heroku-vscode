import { defineConfig } from '@vscode/test-cli';
export default defineConfig({
  files: 'out/**/*.spec.js',
  mocha: {
    ui: 'tdd',
    timeout: 20000,
  }
});
