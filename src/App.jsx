import { useState, useCallback } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import MotorCard from './components/MotorCard'
import BatchCommand from './components/BatchCommand'
import RecordingControls from './components/RecordingControls'
import StatusBar from './components/StatusBar'
import Login from './components/Login'
import './App.css'

const DEFAULT_ANGLES = [90, 90, 90, 90, 90, 90]

function getWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
}

function App() {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem('arm_auth') === '1')
  const [angles, setAngles] = useState(DEFAULT_ANGLES)
  const [lastCommand, setLastCommand] = useState('')
  const [batchPanelOpen, setBatchPanelOpen] = useState(false)
  const [recordingPanelOpen, setRecordingPanelOpen] = useState(false)

  // Handle incoming motor state from ESP32 (source of truth)
  const handleMotorUpdate = useCallback((motorId, angleOrAngles) => {
    if (motorId === 'stateSync') {
      setAngles(angleOrAngles)
      setLastCommand(`Synced from ESP32`)
    } else {
      setAngles((prev) => {
        const updated = [...prev]
        updated[motorId - 1] = angleOrAngles
        return updated
      })
      setLastCommand(`ESP32 -> M${motorId}: ${angleOrAngles}`)
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
      setLastCommand(`You -> M${motorId}: ${angle}`)
    },
    [sendMotorCommand]
  )

  // User sends a full pose
  const handleSendPose = useCallback(
    (poseAngles) => {
      setAngles(poseAngles)
      sendPose(poseAngles)
      setLastCommand(`Pose sent -> [${poseAngles.join(', ')}]`)
    },
    [sendPose]
  )

  const handleLogout = () => {
    sessionStorage.removeItem('arm_auth')
    setLoggedIn(false)
  }

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__top">
          <div>
            <h1>Robotic Arm Controller</h1>
            <p>Professional 6-Motor Servo Control System</p>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
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

      <div className="bottom-panels">
        {/* Batch Command Panel */}
        <div className="bottom-panel">
          <button
            className="bottom-panel__toggle"
            onClick={() => { setBatchPanelOpen(!batchPanelOpen); setRecordingPanelOpen(false) }}
          >
            ⚙ Batch Command
            <span className={`bottom-panel__arrow ${batchPanelOpen ? 'bottom-panel__arrow--open' : ''}`}>^</span>
          </button>
          <div className={`bottom-panel__content ${batchPanelOpen ? 'bottom-panel__content--open' : ''}`}>
            <BatchCommand angles={angles} onSendPose={handleSendPose} />
          </div>
        </div>

        {/* Recording Panel */}
        <div className="bottom-panel">
          <button
            className="bottom-panel__toggle"
            onClick={() => { setRecordingPanelOpen(!recordingPanelOpen); setBatchPanelOpen(false) }}
          >
            🎬 Record & Play
            <span className={`bottom-panel__arrow ${recordingPanelOpen ? 'bottom-panel__arrow--open' : ''}`}>^</span>
          </button>
          <div className={`bottom-panel__content ${recordingPanelOpen ? 'bottom-panel__content--open' : ''}`}>
            <RecordingControls angles={angles} onSendPose={handleSendPose} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
