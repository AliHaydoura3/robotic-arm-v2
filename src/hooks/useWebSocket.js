import { useEffect, useRef, useState, useCallback } from 'react'

const RECONNECT_DELAY = 3000
const THROTTLE_INTERVAL = 100

function log(tag, level, msg) {
  const ts = new Date().toISOString().slice(11, 19)
  const prefix = `[${ts}] [${level}] [${tag}]`
  if (level === 'ERROR') console.error(prefix, msg)
  else if (level === 'WARN') console.warn(prefix, msg)
  else if (level === 'DEBUG') console.debug(prefix, msg)
  else console.log(prefix, msg)
}

export function useWebSocket(url, onMotorUpdate) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)
  const lastSendTimeRef = useRef({})
  const reconnectTimerRef = useRef(null)
  const onMotorUpdateRef = useRef(onMotorUpdate)

  // Keep callback ref fresh without reconnecting
  useEffect(() => {
    onMotorUpdateRef.current = onMotorUpdate
  }, [onMotorUpdate])

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return

    log('WS', 'INFO', `Connecting to ${url}`)

    const ws = new WebSocket(url)

    ws.onopen = () => {
      log('WS', 'INFO', 'Connected')
      setConnected(true)
    }

    ws.onclose = () => {
      log('WS', 'WARN', `Disconnected — retrying in ${RECONNECT_DELAY / 1000}s`)
      setConnected(false)
      reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY)
    }

    ws.onerror = () => {
      log('WS', 'ERROR', 'Connection failed')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // ESP32 motor state update (single)
        if (data.type === 'motorUpdate') {
          log('WS', 'INFO', `← M${data.motorId}=${data.angle}° (from ESP32)`)
          onMotorUpdateRef.current?.(data.motorId, data.angle)
          return
        }

        // ESP32 full state snapshot
        if (data.type === 'stateSync') {
          log('WS', 'INFO', `← Full state sync from ESP32: [${data.angles.join(', ')}]`)
          onMotorUpdateRef.current?.('stateSync', data.angles)
          return
        }

        // Server acks / info
        if (data.type) {
          log('WS', 'INFO', `Server: ${event.data}`)
        }
      } catch {
        // Raw text — ignore
      }
    }

    socketRef.current = ws
  }, [url])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimerRef.current)
      if (socketRef.current) {
        log('WS', 'INFO', 'Closing connection')
        socketRef.current.close()
      }
    }
  }, [connect])

  const sendMotorCommand = useCallback((motorId, angle) => {
    const now = Date.now()
    const lastSent = lastSendTimeRef.current[motorId] || 0

    if (
      now - lastSent >= THROTTLE_INTERVAL &&
      socketRef.current?.readyState === WebSocket.OPEN
    ) {
      const command = JSON.stringify({ motorId, angle: parseInt(angle) })
      socketRef.current.send(command)
      lastSendTimeRef.current[motorId] = now
      log('WS', 'DEBUG', `→ M${motorId}=${angle}°`)
      return true
    }
    return false
  }, [])

  const sendPose = useCallback((angles) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      log('WS', 'WARN', 'Cannot send pose — not connected')
      return
    }

    log('WS', 'INFO', `Sending pose [${angles.join(', ')}]`)

    angles.forEach((angle, index) => {
      setTimeout(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({ motorId: index + 1, angle: parseInt(angle) })
          )
        }
      }, index * 100)
    })
  }, [])

  return { connected, sendMotorCommand, sendPose }
}
