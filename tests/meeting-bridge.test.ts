import { afterEach, expect, it } from 'vitest'
import { connect, type Socket } from 'node:net'
import { MeetingBridge } from '../src/main/meeting-bridge'
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).forEach(fn => fn()) })
async function fixture(timeout = 500) {
  const bridge = new MeetingBridge(() => {}, timeout)
  await bridge.listen()
  cleanup.push(() => bridge.dispose())
  const credential = bridge.register('a', 1)
  const socket = connect(bridge.port, '127.0.0.1')
  socket.on('error', () => {})
  cleanup.push(() => socket.destroy())
  const records: any[] = []
  let buffer = ''
  socket.on('data', data => { buffer += data.toString(); while (buffer.includes('\n')) { const i = buffer.indexOf('\n'); records.push(JSON.parse(buffer.slice(0, i))); buffer = buffer.slice(i + 1) } })
  await new Promise<void>(resolve => socket.once('connect', resolve))
  return { bridge, socket, records, credential }
}
const send = (socket: Socket, record: unknown) => socket.write(JSON.stringify(record) + '\n')
async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await new Promise(resolve => setTimeout(resolve, 5))
  expect(check()).toBe(true)
}
it('authenticates split records and correlates only the matching completed reply', async () => {
  const { bridge, socket, records, credential } = await fixture()
  const hello = JSON.stringify({ type: 'hello', token: credential, version: 1, idle: true }) + '\n'
  socket.write(hello.slice(0, 8)); socket.write(hello.slice(8))
  await until(() => bridge.status('a') === 'ready')
  const reply = bridge.prompt('a', 'Discuss', new AbortController().signal)
  await until(() => records.some(r => r.type === 'prompt'))
  const command = records.find(r => r.type === 'prompt')
  send(socket, { type: 'result', id: 'stale', text: 'wrong' })
  send(socket, { type: 'result', id: command.id, text: 'Actual reply' })
  expect(await reply).toBe('Actual reply')
})
it('rejects unauthorized peers and invalidates previous generations', async () => {
  const { bridge, socket } = await fixture()
  send(socket, { type: 'hello', token: 'wrong', version: 1, idle: true })
  await until(() => socket.destroyed)
  expect(bridge.status('a')).toBe('disconnected')
  bridge.register('a', 2)
  await expect(bridge.prompt('a', 'Discuss', new AbortController().signal)).rejects.toThrow('not ready')
})
it('rejects busy agents, aborts owned turns and rejects disconnects', async () => {
  const { bridge, socket, records, credential } = await fixture()
  send(socket, { type: 'hello', token: credential, version: 1, idle: false })
  await until(() => bridge.status('a') === 'busy')
  await expect(bridge.prompt('a', 'Discuss', new AbortController().signal)).rejects.toThrow('not ready')
  send(socket, { type: 'state', idle: true })
  await until(() => bridge.status('a') === 'ready')
  const abort = new AbortController()
  const reply = bridge.prompt('a', 'Discuss', abort.signal)
  const rejection = expect(reply).rejects.toThrow('cancelled')
  abort.abort(); await rejection
  await until(() => records.some(r => r.type === 'cancel'))
  send(socket, { type: 'state', idle: true })
  await until(() => bridge.status('a') === 'ready')
  const disconnected = bridge.prompt('a', 'Discuss', new AbortController().signal)
  const failed = expect(disconnected).rejects.toThrow('disconnected')
  socket.destroy(); await failed
})
it('rejects the active turn when its session generation is replaced', async () => {
  const { bridge, socket, credential } = await fixture()
  send(socket, { type: 'hello', token: credential, version: 1, idle: true })
  await until(() => bridge.status('a') === 'ready')
  const pending = bridge.prompt('a', 'Discuss', new AbortController().signal)
  const failed = expect(pending).rejects.toThrow('disconnected')
  bridge.register('a', 2)
  await failed
  expect(bridge.status('a')).toBe('disconnected')
})
it('bounds protocol records and times out without leaving a ready agent', async () => {
  const { bridge, socket, credential } = await fixture(30)
  send(socket, { type: 'hello', token: credential, version: 1, idle: true })
  await until(() => bridge.status('a') === 'ready')
  await expect(bridge.prompt('a', 'Discuss', new AbortController().signal)).rejects.toThrow('timed out')
  expect(bridge.status('a')).not.toBe('ready')
  socket.write('x'.repeat(300000))
  await until(() => socket.destroyed)
})
