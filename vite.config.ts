import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Small assets are inlined as data: URLs, but Spine's atlas loader picks atlases by their ".atlas" extension,
    // so an inlined atlas would never load. Returning undefined keeps Vite's default size rule for everything else.
    assetsInlineLimit: (filePath) => (filePath.endsWith('.atlas') ? false : undefined),
  },
});
