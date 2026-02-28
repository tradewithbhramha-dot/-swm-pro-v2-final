import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = process.cwd();

esbuild.build({
  entryPoints: [path.resolve(PROJECT_ROOT, 'server/_core/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  packages: 'external',
  bundle: true,
  alias: {
    '@shared': path.resolve(PROJECT_ROOT, 'shared'),
  },
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  sourcemap: true,
  minify: false,
}).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
