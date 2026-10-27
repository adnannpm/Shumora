import { connect } from 'node:net'

// Loaded explicitly into each Shumora-created Pi runtime; no global install required.
export default function meetingExtension(pi, dependencies = {}) {
  const env = dependencies.env || process.env
  const port = Number(env.SHUMORA_MEETING_PORT), token = env.SHUMORA_MEETING_TOKEN
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !token) return
  let socket, context, pending, buffer = '', closed = false
  const send = record => { if (socket && !closed) socket.write(JSON.stringify(record) + '\n') }
  const state = () => send({ type: 'state', idle: !pending && !!context?.isIdle() })
  const restore = () => { if (pending) pi.setActiveTools(pending.tools); pending = undefined }
  pi.on('session_start', (_event, ctx) => {
    context = ctx; closed = false; buffer = ''
    socket = (dependencies.connect || connect)({ port, host: '127.0.0.1' })
    socket.setEncoding('utf8')
    socket.on('connect', () => send({ type: 'hello', version: 1, token, idle: ctx.isIdle() }))
    socket.on('error', () => {})
    socket.on('close', () => { closed = true; if (pending) context.abort() })
    socket.on('data', chunk => {
      buffer += chunk
      if (Buffer.byteLength(buffer) > 262144) { socket.destroy(); return }
      while (buffer.includes('\n')) {
        const index = buffer.indexOf('\n'), line = buffer.slice(0, index); buffer = buffer.slice(index + 1)
        try {
          const record = JSON.parse(line)
          if (record.type === 'cancel' && record.id === pending?.id) { context.abort(); continue }
          if (record.type !== 'prompt' || typeof record.id !== 'string' || typeof record.text !== 'string' || record.text.length > 100000) continue
          if (pending || !context.isIdle()) { send({ type: 'result', id: record.id, error: 'Meeting agent is busy' }); state(); continue }
          pending = { id: record.id, prompt: record.text, accepting: true, text: '', error: '', tools: pi.getActiveTools() }
          pi.setActiveTools([])
          state()
          Promise.resolve(pi.sendUserMessage(record.text)).catch(error => {
            if (pending?.id !== record.id) return
            send({ type: 'result', id: record.id, error: String(error).slice(0, 1000) }); restore(); state()
          })
        } catch { socket.destroy(); return }
      }
    })
  })
  pi.on('agent_start', (_event, ctx) => { context = ctx; state() })
  pi.on('input', event => {
    if (!pending) return
    if (pending.accepting && event.source === 'extension' && event.text === pending.prompt) { pending.accepting = false; return }
    return { action: 'handled' }
  })
  pi.on('user_bash', () => pending ? { operations: [] } : undefined)
  pi.on('tool_call', () => pending ? { block: true, reason: 'Meeting discussion does not allow tools' } : undefined)
  pi.on('message_end', event => {
    if (!pending || event.message.role !== 'assistant') return
    const message = event.message
    if (message.stopReason === 'error' || message.stopReason === 'aborted') pending.error = message.errorMessage || 'Meeting agent failed'
    else {
      pending.error = ''
      pending.text = message.content.filter(c => c.type === 'text').map(c => c.text).join('\n').slice(0, 20000)
    }
  })
  pi.on('agent_settled', (event, ctx) => {
    context = ctx
    if (pending) {
      send({ type: 'result', id: pending.id, ...(event.aborted || pending.error || !pending.text.trim() ? { error: pending.error || (event.aborted ? 'Meeting turn cancelled' : 'Meeting agent returned no usable reply') } : { text: pending.text }) })
      restore()
    }
    state()
  })
  pi.on('session_shutdown', () => {
    if (pending) context.abort()
    restore(); closed = true; socket?.destroy(); socket = undefined
  })
}
