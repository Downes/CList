import { readFileSync } from 'node:fs'
export default {
  plugins: [{
    name: 'slide-catalog-files',
    generateBundle() {
      for (const name of ['shapes', 'layouts', 'themes']) {
        this.emitFile({ type: 'asset', fileName: 'catalogs/' + name + '.json', source: readFileSync(new URL('./catalogs/' + name + '.json', import.meta.url), 'utf8') })
      }
    },
  }],
}
