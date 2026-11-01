import pnpmThumbnail from './assets/pnpm-thumbnail.svg?no-inline'
import bunThumbnail from './assets/bun-thumbnail.svg?no-inline'
import yarnThumbnail from './assets/yarn-thumbnail.svg?no-inline'
export const managerPluginInfo = {
  pnpm: { name: 'pnpm', thumbnail: pnpmThumbnail, repository: 'https://github.com/pnpm/pnpm', docs: 'https://pnpm.io/installation', description: 'Fast, disk space efficient package manager.' },
  bun: { name: 'Bun', thumbnail: bunThumbnail, repository: 'https://github.com/oven-sh/bun', docs: 'https://bun.sh/docs/installation', description: 'JavaScript runtime, bundler, test runner and package manager.' },
  yarn: { name: 'Yarn', thumbnail: yarnThumbnail, repository: 'https://github.com/yarnpkg/yarn', docs: 'https://yarnpkg.com/getting-started/install', description: 'Package manager for JavaScript projects. npm installs Yarn Classic.' }
} as const
