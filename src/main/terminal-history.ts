// Keep incoming chunks without copying the entire scrollback on each PTY event.
// Offsets and lengths use UTF-16 units, matching the previous string.slice tail.
export class TerminalHistory {
  private chunks: string[] = []
  private head = 0
  private offset = 0
  private length = 0
  private cached: string | undefined = ''
  constructor(private limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid history limit')
  }

  append(data: string) {
    if (!data.length) return
    if (data.length >= this.limit) {
      this.clear()
      data = data.slice(-this.limit)
    }
    const last = this.chunks.length - 1
    // Bound metadata for keystroke-sized writes without copying full history.
    if (last >= this.head && this.chunks[last].length + data.length <= 4096) this.chunks[last] += data
    else this.chunks.push(data)
    this.length += data.length
    this.cached = undefined
    let excess = this.length - this.limit
    while (excess > 0) {
      const available = this.chunks[this.head].length - this.offset
      if (excess < available) {
        this.offset += excess
        this.length -= excess
        break
      }
      this.chunks[this.head++] = ''
      this.offset = 0
      this.length -= available
      excess -= available
    }
    if (this.head > 1024 && this.head * 2 >= this.chunks.length) {
      this.chunks = this.chunks.slice(this.head)
      this.head = 0
    }
  }

  text(): string {
    if (this.cached === undefined) {
      this.cached = this.chunks[this.head].slice(this.offset) + this.chunks.slice(this.head + 1).join('')
    }
    return this.cached
  }

  clear() {
    this.chunks = []; this.head = 0; this.offset = 0; this.length = 0; this.cached = ''
  }
}
