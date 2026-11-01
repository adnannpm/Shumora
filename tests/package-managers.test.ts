import { expect, it } from 'vitest'
import { globalPackageArgs, managerRootArgs } from '../src/main/package-managers'
it.each([
  ['npm', ['install','--global','--ignore-scripts','--no-audit','--no-fund','pi@1.0.0']],
  ['pnpm', ['add','--global','--ignore-scripts','pi@1.0.0']],
  ['bun', ['add','--global','--ignore-scripts','pi@1.0.0']],
  ['yarn', ['global','add','--ignore-scripts','--non-interactive','pi@1.0.0']]
] as const)('uses safe global arguments for %s', (manager, args) => expect(globalPackageArgs(manager,false,'pi@1.0.0')).toEqual(args))
it('removes with the owner rather than npm and queries the manager global location',()=>{
 expect(globalPackageArgs('bun',true,'pi')).toEqual(['remove','--global','--ignore-scripts','pi'])
 expect(globalPackageArgs('yarn',true,'pi')).toEqual(['global','remove','--ignore-scripts','--non-interactive','pi'])
 expect(managerRootArgs('bun')).toEqual(['pm','bin','--global'])
 expect(managerRootArgs('pnpm')).toEqual(['root','--global'])
})
