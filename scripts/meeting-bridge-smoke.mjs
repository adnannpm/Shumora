// Loads the real installed Pi extension in RPC mode without issuing a model prompt.
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
const token = 'smoke-' + crypto.randomUUID()
let child, socket, timer
const server = createServer(client => {
  socket = client
  let buffer = ''
  client.on('data', chunk => {
    buffer += chunk.toString()
    const i = buffer.indexOf('\n')
    if (i < 0) return
    const record = JSON.parse(buffer.slice(0, i))
    if (record.type !== 'hello' || record.token !== token || record.version !== 1) return
    console.log('PASS: real Pi loaded the meeting extension and authenticated its idle runtime. No model prompt sent.')
    clearTimeout(timer); child.stdin.end(); client.destroy(); server.close()
  })
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
child = spawn(process.env.PI_SMOKE_BIN || 'pi', ['--mode', 'rpc', '--no-session', '--no-extensions', '--no-skills', '--no-prompt-templates', '--extension', resolve('resources/meeting-extension.mjs')], {
  cwd: '/tmp', env: { ...process.env, SHUMORA_MEETING_PORT: String(server.address().port), SHUMORA_MEETING_TOKEN: token }, stdio: ['pipe', 'pipe', 'pipe']
})
let stderr = ''
child.stdout.resume(); child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000) })
child.on('error', error => { console.error(error.message); process.exitCode = 1; clearTimeout(timer); socket?.destroy(); server.close() })
timer = setTimeout(() => { console.error('FAIL: Pi bridge did not connect. ' + stderr); process.exitCode = 1; child.kill(); socket?.destroy(); server.close() }, 20000)
