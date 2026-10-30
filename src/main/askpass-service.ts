import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import type { GitAskPassRequest, GitAskPassResponse } from '../shared/types'

export type AskPassHandler = (request: GitAskPassRequest) => Promise<GitAskPassResponse>

export class AskPassService {
  private server?: Server
  private port = 0
  private token = randomUUID()
  private cache = new Map<string, string>()
  private pending = new Map<string, (res: GitAskPassResponse) => void>()
  private scriptPath = ''
  private jsPath = ''
  private handler?: AskPassHandler

  constructor(private appDataDir: string = path.join(tmpdir(), 'shumora-askpass')) {}

  setHandler(handler: AskPassHandler) {
    this.handler = handler
  }

  async start(): Promise<void> {
    if (this.server) return

    this.ensureScripts()

    await new Promise<void>((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res))
      this.server.on('error', reject)
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server?.address()
        if (addr && typeof addr === 'object') {
          this.port = addr.port
          resolve()
        } else {
          reject(new Error('Failed to bind askpass server port'))
        }
      })
    })
  }

  getEnv(): Record<string, string> {
    if (!this.port || !this.scriptPath) return {}
    return {
      GIT_ASKPASS: this.scriptPath,
      SSH_ASKPASS: this.scriptPath,
      SSH_ASKPASS_REQUIRE: 'force',
      SHUMORA_ASKPASS_PORT: String(this.port),
      SHUMORA_ASKPASS_TOKEN: this.token,
      SHUMORA_EXECPATH: process.execPath,
      SHUMORA_ASKPASS_JS: this.jsPath,
      DISPLAY: process.env.DISPLAY || ':0'
    }
  }

  submitReply(response: GitAskPassResponse): void {
    const resolver = this.pending.get(response.requestId)
    if (resolver) {
      this.pending.delete(response.requestId)
      resolver(response)
    }
  }

  clearCache(): void {
    this.cache.clear()
  }

  dispose(): void {
    if (this.server) {
      this.server.close()
      this.server = undefined
    }
    for (const [, resolver] of this.pending) {
      resolver({ requestId: '', canceled: true })
    }
    this.pending.clear()
  }

  private extractKey(prompt: string): string {
    const sshMatch = /passphrase for (?:key )?['"]?([^'":]+)['"]?/i.exec(prompt)
    if (sshMatch && sshMatch[1]) return sshMatch[1].trim()
    const httpMatch = /(?:Password|Username) for ['"]?([^'":]+)['"]?/i.exec(prompt)
    if (httpMatch && httpMatch[1]) return httpMatch[1].trim()
    return prompt.trim()
  }

  private ensureScripts() {
    if (!existsSync(this.appDataDir)) {
      mkdirSync(this.appDataDir, { recursive: true })
    }

    this.jsPath = path.join(this.appDataDir, 'askpass.cjs')
    const jsContent = `'use strict';
const http = require('node:http');
const prompt = process.argv[2] || '';
const port = process.env.SHUMORA_ASKPASS_PORT;
const token = process.env.SHUMORA_ASKPASS_TOKEN;

if (!port || !token) process.exit(1);

const body = JSON.stringify({ prompt });
const req = http.request({
  hostname: '127.0.0.1',
  port: Number(port),
  path: '/askpass',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let responseData = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(responseData);
        if (typeof json.passphrase === 'string') {
          process.stdout.write(json.passphrase + '\\n');
          process.exit(0);
        }
      } catch {}
    }
    process.exit(1);
  });
});

req.on('error', () => process.exit(1));
req.setTimeout(120000, () => { req.destroy(); process.exit(1); });
req.write(body);
req.end();
`
    writeFileSync(this.jsPath, jsContent, 'utf8')

    if (process.platform === 'win32') {
      this.scriptPath = path.join(this.appDataDir, 'askpass.bat')
      const batContent = `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"%SHUMORA_EXECPATH%" "%SHUMORA_ASKPASS_JS%" %*\r\n`
      writeFileSync(this.scriptPath, batContent, 'utf8')
    } else {
      this.scriptPath = path.join(this.appDataDir, 'askpass.sh')
      const shContent = `#!/bin/sh\nexport ELECTRON_RUN_AS_NODE=1\nexec "$SHUMORA_EXECPATH" "$SHUMORA_ASKPASS_JS" "$@"\n`
      writeFileSync(this.scriptPath, shContent, 'utf8')
      try {
        chmodSync(this.scriptPath, 0o755)
      } catch {}
    }
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'POST' || req.url !== '/askpass') {
      res.writeHead(404)
      res.end()
      return
    }

    const auth = req.headers['authorization']
    if (auth !== `Bearer ${this.token}`) {
      res.writeHead(401)
      res.end()
      return
    }

    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => { body += chunk })
    req.on('end', async () => {
      try {
        const { prompt = '' } = JSON.parse(body)
        const key = this.extractKey(prompt)

        // If SSH reports bad passphrase, invalidate cached entry for this key
        if (/bad passphrase|try again/i.test(prompt) && key && this.cache.has(key)) {
          this.cache.delete(key)
        }

        // Return cached passphrase if available
        if (key && this.cache.has(key)) {
          const passphrase = this.cache.get(key)!
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ passphrase }))
          return
        }

        // If no handler is registered, cancel
        if (!this.handler) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'No askpass handler registered' }))
          return
        }

        const requestId = randomUUID()
        const isUsername = /username/i.test(prompt)
        const promise = new Promise<GitAskPassResponse>((resolve) => {
          this.pending.set(requestId, resolve)
        })

        void this.handler({ requestId, prompt, key, isUsername })

        const reply = await promise
        if (reply.canceled || reply.passphrase === undefined) {
          res.writeHead(403)
          res.end(JSON.stringify({ error: 'Canceled' }))
          return
        }

        if (reply.remember && key) {
          this.cache.set(key, reply.passphrase)
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ passphrase: reply.passphrase }))
      } catch {
        res.writeHead(500)
        res.end()
      }
    })
  }
}
