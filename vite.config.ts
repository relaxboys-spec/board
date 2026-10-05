import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// The exact policy from the spec. In dev only, `ws:`/`wss:` are added so Vite's
// hot-reload socket can connect; the production build ships the policy unchanged.
const CSP =
  "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
const DEV_CSP = CSP.replace("connect-src 'self'", "connect-src 'self' ws: wss:");

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/** Injects the CSP meta tag and writes sw.js with the full precache list + a content-hash version. */
function questBoardPlugin(): Plugin {
  let isBuild = false;
  return {
    name: 'quest-board',
    configResolved(cfg) {
      isBuild = cfg.command === 'build';
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const tag = `<meta http-equiv="Content-Security-Policy" content="${isBuild ? CSP : DEV_CSP}">`;
        return html.replace('<!-- CSP -->', tag);
      },
    },
    generateBundle(_opts, bundle) {
      const publicDir = join(process.cwd(), 'public');
      const publicFiles = listFiles(publicDir).map((f) => relative(publicDir, f).split('\\').join('/'));
      const files = [...Object.keys(bundle), ...publicFiles]
        // .woff is only a fallback for browsers without .woff2 (Safari has it): don't precache it.
        .filter((f) => !f.endsWith('.map') && !f.endsWith('.woff') && f !== 'sw.js')
        .sort();
      const hash = createHash('sha256');
      for (const name of Object.keys(bundle).sort()) {
        const item = bundle[name];
        hash.update(name);
        hash.update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const f of publicFiles) hash.update(readFileSync(join(publicDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const precache = ['./', ...files.map((f) => './' + f)];
      const template = readFileSync(join(process.cwd(), 'sw/sw.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__VERSION__', version)
          .replace('__PRECACHE__', JSON.stringify(precache, null, 2)),
      });
    },
  };
}

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Relative base works on GitHub Pages at any repo path (user.github.io/<repo>/)
  // without configuration. Override with BASE_PATH=/something/ if ever needed.
  base: process.env.BASE_PATH || './',
  plugins: [questBoardPlugin()],
  build: {
    target: 'safari15',
    // Never inline assets as data: URIs — fonts must load from 'self' under the CSP.
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  server: { host: true },
});
