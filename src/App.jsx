import { useState, useCallback } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import MotorCard from './components/MotorCard'
import PoseBuilder from './components/PoseBuilder'
import StatusBar from './components/StatusBar'
import './App.css'

const DEFAULT_ANGLES = [90, 90, 90, 90, 90, 90]

function getWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
}

function App() {
  const [angles, setAngles] = useState(DEFAULT_ANGLES)
  const [lastCommand, setLastCommand] = useState('')

  // Handle incoming motor state from ESP32 (source of truth)
  const handleMotorUpdate = useCallback((motorId, angleOrAngles) => {
    if (motorId === 'stateSync') {
      // Full state snapshot from ESP32
      setAngles(angleOrAngles)
      setLastCommand(`Synced from ESP32`)
    } else {
      // Single motor update from ESP32
      setAngles((prev) => {
        const updated = [...prev]
        updated[motorId - 1] = angleOrAngles
        return updated
      })
      setLastCommand(`ESP32 → M${motorId}: ${angleOrAngles}°`)
    }
  }, [])

  const { connected, sendMotorCommand, sendPose } = useWebSocket(
    getWsUrl(),
    handleMotorUpdate
  )

  // User changes a motor via slider
  const handleAngleChange = useCallback(
    (motorId, angle) => {
      setAngles((prev) => {
        const updated = [...prev]
        updated[motorId - 1] = angle
        return updated
      })
      sendMotorCommand(motorId, angle)
      setLastCommand(`You → M${motorId}: ${angle}°`)
    },
    [sendMotorCommand]
  )

  // User sends a full pose
  const handleSendPose = useCallback(
    (poseAngles) => {
      setAngles(poseAngles)
      sendPose(poseAngles)
      setLastCommand(`Pose sent → [${poseAngles.join(', ')}]`)
    },
    [sendPose]
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 Robotic Arm Controller</h1>
        <p>Professional 6-Motor Servo Control System</p>
      </header>

      <StatusBar connected={connected} lastCommand={lastCommand} />

      <main className="motors-grid">
        {[1, 2, 3, 4, 5, 6].map((id) => (
          <MotorCard
            key={id}
            motorId={id}
            angle={angles[id - 1]}
            onAngleChange={handleAngleChange}
          />
        ))}
      </main>

      <PoseBuilder onSendPose={handleSendPose} />

      <footer className="app-footer">
        <p>Real-time 6-Motor Control System &bull; ESP32 is source of truth &bull; Throttle: 100ms</p>
      </footer>
    </div>
  )
}

export default App
