// Run with ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron scripts/native-pty-smoke.cjs
const pty = require('node-pty')
const os = require('node:os')
const path = require('node:path')
const file = process.env.PI_EXECUTABLE || (process.platform === 'win32' ? 'pi.exe' : 'pi')
const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' }
delete env.ELECTRON_RUN_AS_NODE
let bytes = 0
const proc = pty.spawn(file, [], { name: 'xterm-256color', cols: 100, rows: 30, cwd: os.homedir(), env })
proc.onData((data) => { bytes += data.length })
setTimeout(() => {
  proc.kill()
  console.log(`Native Electron PTY received ${bytes} characters from Pi (${path.basename(file)}).`)
  setTimeout(() => process.exit(bytes > 0 ? 0 : 1), 500)
}, 6000)
