import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { readFileSync, existsSync, statSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// ─── Logging ────────────────────────────────────────────────────────
function timestamp() {
  return new Date().toISOString()
}

const log = {
  info:  (tag, msg) => console.log(`[${timestamp()}] [INFO]  [${tag}] ${msg}`),
  warn:  (tag, msg) => console.warn(`[${timestamp()}] [WARN]  [${tag}] ${msg}`),
  error: (tag, msg) => console.error(`[${timestamp()}] [ERROR] [${tag}] ${msg}`),
  debug: (tag, msg) => console.debug(`[${timestamp()}] [DEBUG] [${tag}] ${msg}`),
}

// ─── Static file server ─────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DIST_DIR = join(__dirname, '..', 'dist')

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function serveStatic(req, res) {
  let filePath = join(DIST_DIR, req.url === '/' ? 'index.html' : req.url)

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST_DIR, 'index.html')
  }

  try {
    const content = readFileSync(filePath)
    const ext = extname(filePath)
    const mime = MIME_TYPES[ext] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': mime })
    res.end(content)
  } catch {
    log.warn('HTTP', `404 Not Found: ${req.url}`)
    res.writeHead(404)
    res.end('Not Found')
  }
}

// ─── HTTP + WebSocket server ────────────────────────────────────────
const server = createServer(serveStatic)
const wss = new WebSocketServer({ server })

let esp32 = null
const clients = new Set() // browser WebSocket connections

wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).slice(2, 8)
  ws._clientId = clientId
  clients.add(clientId)
  log.info('WS', `Client connected [${clientId}] — total: ${clients.size}`)

  ws.on('message', (message) => {
    const msg = message.toString()

    // ESP32 self-registers by sending "ESP32"
    if (msg === 'ESP32') {
      esp32 = ws
      esp32._clientId = clientId
      log.info('WS', `ESP32 registered [${clientId}]`)
      ws.send(JSON.stringify({ type: 'ack', status: 'registered' }))
      return
    }

    // Parse all messages as JSON
    try {
      const data = JSON.parse(msg)

      // ── ESP32 → Server → Browser: state updates ──
      if (ws === esp32) {
        if (data.type === 'motorUpdate' && data.motorId && data.angle !== undefined) {
          // Single motor changed — broadcast to all browsers
          const payload = JSON.stringify({ type: 'motorUpdate', motorId: data.motorId, angle: data.angle })
          for (const client of wss.clients) {
            if (client !== esp32 && client.readyState === 1) {
              client.send(payload)
            }
          }
          log.debug('WS', `Broadcast M${data.motorId}=${data.angle}° from ESP32 [${clientId}]`)
        } else if (data.type === 'stateSync' && Array.isArray(data.angles)) {
          // Full state snapshot — broadcast to all browsers
          const payload = JSON.stringify({ type: 'stateSync', angles: data.angles })
          for (const client of wss.clients) {
            if (client !== esp32 && client.readyState === 1) {
              client.send(payload)
            }
          }
          log.info('WS', `Full state sync from ESP32 [${clientId}]: [${data.angles.join(', ')}]`)
        } else {
          log.debug('WS', `Unknown ESP32 message [${clientId}]: ${msg}`)
        }
        return
      }

      // ── Browser → Server → ESP32: motor commands ──
      if (data.motorId && data.angle !== undefined) {
        if (esp32 && esp32.readyState === 1) {
          esp32.send(msg)
          log.debug('WS', `Forwarded M${data.motorId} → ${data.angle}° [${clientId}] → [${esp32._clientId}]`)
        } else {
          log.warn('WS', `ESP32 not connected, dropped command M${data.motorId}=${data.angle}° [${clientId}]`)
        }
      } else {
        log.debug('WS', `Ignored unknown payload [${clientId}]: ${msg}`)
      }
    } catch (e) {
      log.error('WS', `Invalid message from [${clientId}]: ${e.message}`)
    }
  })

  ws.on('close', () => {
    clients.delete(clientId)
    if (ws === esp32) {
      esp32 = null
      log.info('WS', `ESP32 disconnected [${clientId}]`)
    } else {
      log.info('WS', `Client disconnected [${clientId}] — remaining: ${clients.size}`)
    }
  })

  ws.on('error', (error) => {
    log.error('WS', `Socket error [${clientId}]: ${error.message}`)
  })
})

// ─── Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080

server.listen(PORT, () => {
  log.info('SERVER', `Robotic Arm Controller listening on http://0.0.0.0:${PORT}`)
})

process.on('SIGTERM', () => {
  log.info('SERVER', 'Shutting down...')
  wss.close()
  server.close(() => process.exit(0))
})
