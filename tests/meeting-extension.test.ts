import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
// @ts-expect-error Bundled JavaScript extension is loaded by the external Pi runtime.
import extension from '../resources/meeting-extension.mjs'
function fixture() {
  const handlers: Record<string, Function> = {}
  const socket = Object.assign(new EventEmitter(), { write: vi.fn(), destroy: vi.fn(), setEncoding() {} })
  const pi = { on: (name: string, fn: Function) => { handlers[name] = fn }, sendUserMessage: vi.fn(), getActiveTools: () => ['read', 'bash'], setActiveTools: vi.fn() }
  const ctx = { isIdle: () => true, abort: vi.fn() }
  extension(pi, { connect: () => socket, env: { SHUMORA_MEETING_PORT: '1234', SHUMORA_MEETING_TOKEN: 'secret' } })
  handlers.session_start({}, ctx); socket.emit('connect')
  const send = (r: unknown) => socket.emit('data', JSON.stringify(r) + '\n')
  return { handlers, socket, pi, ctx, send }
}
it('uses structured assistant replies and waits for final settlement, blocking tools meanwhile', async () => {
  const { handlers, socket, pi, ctx, send } = fixture()
  send({ type: 'prompt', id: 'turn', text: 'Discuss' })
  expect(pi.sendUserMessage).toHaveBeenCalledWith('Discuss')
  expect(handlers.input({ source: 'extension', text: 'Discuss' }, ctx)).toBeUndefined()
  expect(handlers.input({ source: 'interactive', text: 'Other task' }, ctx)).toEqual({ action: 'handled' })
  expect(handlers.tool_call({}, ctx)).toEqual({ block: true, reason: 'Meeting discussion does not allow tools' })
  handlers.message_end({ message: { role: 'assistant', content: [{ type: 'text', text: 'My view' }], stopReason: 'stop' } }, ctx)
  handlers.agent_end?.({}, ctx)
  expect(socket.write.mock.calls.some(([s]) => JSON.parse(s).type === 'result')).toBe(false)
  handlers.agent_settled({ aborted: false }, ctx)
  const result = socket.write.mock.calls.map(([s]) => JSON.parse(s)).find(r => r.type === 'result')
  expect(result).toMatchObject({ id: 'turn', text: 'My view' })
  expect(pi.setActiveTools).toHaveBeenLastCalledWith(['read', 'bash'])
})
it('rejects busy prompts and reports cancellation and provider failures', () => {
  const { handlers, ctx, pi, send, socket } = fixture()
  ctx.isIdle = () => false
  send({ type: 'prompt', id: 'busy', text: 'Discuss' })
  expect(pi.sendUserMessage).not.toHaveBeenCalled()
  ctx.isIdle = () => true
  send({ type: 'prompt', id: 'cancel', text: 'Discuss' })
  send({ type: 'cancel', id: 'cancel' })
  expect(ctx.abort).toHaveBeenCalled()
  handlers.agent_settled({ aborted: true }, ctx)
  send({ type: 'prompt', id: 'error', text: 'Discuss' })
  handlers.message_end({ message: { role: 'assistant', content: [], stopReason: 'error', errorMessage: 'Provider failed' } }, ctx)
  handlers.agent_settled({ aborted: false }, ctx)
  expect(socket.write.mock.calls.map(([s]) => JSON.parse(s)).find(r => r.id === 'error')).toMatchObject({ error: 'Provider failed' })
})
it('keeps tools blocked until settlement when the bridge disconnects during a turn', () => {
  const { handlers, ctx, send, socket, pi } = fixture()
  send({ type: 'prompt', id: 'turn', text: 'Discuss' })
  socket.emit('close')
  expect(ctx.abort).toHaveBeenCalled()
  expect(handlers.tool_call({}, ctx)).toEqual({ block: true, reason: 'Meeting discussion does not allow tools' })
  handlers.agent_settled({ aborted: true }, ctx)
  expect(pi.setActiveTools).toHaveBeenLastCalledWith(['read', 'bash'])
})
it('aborts owned work and closes its socket on runtime shutdown', () => {
  const { handlers, ctx, send, socket } = fixture()
  send({ type: 'prompt', id: 'turn', text: 'Discuss' })
  handlers.session_shutdown({}, ctx)
  expect(ctx.abort).toHaveBeenCalled()
  expect(socket.destroy).toHaveBeenCalled()
})
