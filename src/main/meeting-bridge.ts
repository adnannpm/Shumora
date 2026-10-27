import { randomUUID } from 'node:crypto'
import { createServer, type Server, type Socket } from 'node:net'
export type AgentStatus = 'ready' | 'busy' | 'disconnected'
type Pending = { id: string; finish: (error?: Error, text?: string) => void }
type Peer = { token: string; generation: number; socket?: Socket; idle: boolean; pending?: Pending }
export class MeetingBridge {
  private server: Server
  private peers = new Map<string, Peer>()
  private sockets = new Set<Socket>()
  port = 0
  constructor(private changed: () => void, private timeout = 180000) {
    this.server = createServer(socket => this.accept(socket))
  }
  async listen() {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(0, '127.0.0.1', () => { this.server.removeListener('error', reject); resolve() })
    })
    this.port = (this.server.address() as { port: number }).port
  }
  register(id: string, generation: number) {
    this.remove(id)
    const token = randomUUID()
    this.peers.set(id, { token, generation, idle: false })
    return token
  }
  remove(id: string) {
    const peer = this.peers.get(id)
    if (!peer) return
    peer.pending?.finish(new Error('Meeting agent disconnected'))
    peer.socket?.destroy(); this.peers.delete(id); this.changed()
  }
  status(id: string): AgentStatus {
    const peer = this.peers.get(id)
    return !peer?.socket ? 'disconnected' : peer.idle && !peer.pending ? 'ready' : 'busy'
  }
  async prompt(id: string, text: string, signal: AbortSignal): Promise<string> {
    const peer = this.peers.get(id)
    if (!peer?.socket || this.status(id) !== 'ready') throw new Error('Meeting agent is not ready')
    if (typeof text !== 'string' || text.length > 100000) throw new Error('Meeting prompt is too long')
    if (signal.aborted) throw new Error('Meeting turn cancelled')
    const socket = peer.socket
    return new Promise((resolve, reject) => {
      const request = randomUUID()
      const cancel = () => { socket.write(JSON.stringify({ type: 'cancel', id: request }) + '\n'); finish(new Error('Meeting turn cancelled')) }
      const timer = setTimeout(() => { socket.write(JSON.stringify({ type: 'cancel', id: request }) + '\n'); finish(new Error('Meeting agent timed out')) }, this.timeout)
      const finish = (error?: Error, reply?: string) => {
        if (peer.pending?.id !== request) return
        clearTimeout(timer); signal.removeEventListener('abort', cancel); peer.pending = undefined
        this.changed()
        if (error) reject(error); else resolve(reply!)
      }
      peer.idle = false; peer.pending = { id: request, finish }
      signal.addEventListener('abort', cancel, { once: true })
      socket.write(JSON.stringify({ type: 'prompt', id: request, text }) + '\n')
      this.changed()
    })
  }
  private accept(socket: Socket) {
    this.sockets.add(socket)
    let peer: Peer | undefined, buffer = ''
    const authTimer = setTimeout(() => { if (!peer) socket.destroy() }, 5000)
    socket.setEncoding('utf8')
    socket.on('error', () => {})
    socket.on('data', chunk => {
      buffer += chunk
      if (Buffer.byteLength(buffer) > 262144) { socket.destroy(); return }
      while (buffer.includes('\n')) {
        const index = buffer.indexOf('\n'), line = buffer.slice(0, index); buffer = buffer.slice(index + 1)
        try {
          const record = JSON.parse(line)
          if (!peer) {
            if (record.type !== 'hello' || record.version !== 1 || typeof record.token !== 'string' || typeof record.idle !== 'boolean') throw new Error()
            peer = [...this.peers.values()].find(p => p.token === record.token)
            if (!peer || peer.socket) throw new Error()
            peer.socket = socket; peer.idle = record.idle; clearTimeout(authTimer); this.changed()
          } else if (record.type === 'state' && typeof record.idle === 'boolean') {
            peer.idle = record.idle; this.changed()
          } else if (record.type === 'result' && record.id === peer.pending?.id) {
            if (typeof record.error === 'string') peer.pending?.finish(new Error(record.error.slice(0, 1000)))
            else if (typeof record.text === 'string' && record.text.trim() && record.text.length <= 20000) peer.pending?.finish(undefined, record.text)
            else peer.pending?.finish(new Error('Meeting agent returned no usable reply'))
          }
        } catch { socket.destroy(); return }
      }
    })
    socket.on('close', () => {
      clearTimeout(authTimer); this.sockets.delete(socket)
      if (peer?.socket === socket) { peer.socket = undefined; peer.idle = false; peer.pending?.finish(new Error('Meeting agent disconnected')); this.changed() }
    })
  }
  dispose() {
    for (const id of this.peers.keys()) this.remove(id)
    for (const socket of this.sockets) socket.destroy()
    this.server.close()
  }
}
