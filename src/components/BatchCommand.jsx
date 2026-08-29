import { useState } from 'react'

export default function BatchCommand({ angles, onSendPose }) {
  const [tab, setTab] = useState('angles')
  const [batchAngles, setBatchAngles] = useState(angles)
  const [edited, setEdited] = useState(false)
  const [coordX, setCoordX] = useState('150')
  const [coordY, setCoordY] = useState('0')
  const [coordZ, setCoordZ] = useState('200')
  const [coordRot, setCoordRot] = useState('0')

  // Determine the display angles: use local state if user edited, otherwise current angles
  const displayAngles = edited ? batchAngles : angles

  const updateAngle = (index, value) => {
    const num = Math.max(0, Math.min(180, parseInt(value) || 0))
    const updated = [...displayAngles]
    updated[index] = num
    setBatchAngles(updated)
    setEdited(true)
  }

  const handleSendAngles = () => {
    onSendPose(displayAngles)
    setEdited(false)
  }

  const handleReset = () => {
    setBatchAngles(angles)
    setEdited(false)
  }

  const handleApplyIK = () => {
    alert(`Inverse Kinematics:\nTarget: X=${coordX}, Y=${coordY}, Z=${coordZ}, Rot=${coordRot}°\n\nIK solver not yet implemented.`)
  }

  return (
    <div className="batch-command">
      <div className="batch-command__tabs">
        <button
          className={`batch-command__tab ${tab === 'angles' ? 'batch-command__tab--active' : ''}`}
          onClick={() => setTab('angles')}
        >
          ⚙ Batch Angles
        </button>
        <button
          className={`batch-command__tab ${tab === 'ik' ? 'batch-command__tab--active' : ''}`}
          onClick={() => setTab('ik')}
        >
          📍 Inverse Kinematics
        </button>
      </div>

      {tab === 'angles' && (
        <div className="batch-angle-panel">
          <div className="batch-angle-panel__inputs">
            {displayAngles.map((angle, i) => (
              <div key={i} className="batch-angle-panel__field">
                <label className="batch-angle-panel__label">
                  M{i + 1} <span className="batch-angle-panel__name">{['Shoulder', 'Upper Arm', 'Elbow', 'Wrist Pitch', 'Wrist Roll', 'Gripper'][i]}</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={angle}
                  onChange={(e) => updateAngle(i, e.target.value)}
                  className="batch-angle-panel__input"
                />
                <input
                  type="range"
                  min="0"
                  max="180"
                  value={angle}
                  onChange={(e) => updateAngle(i, parseInt(e.target.value))}
                  className="slider"
                />
              </div>
            ))}
          </div>
          <div className="batch-angle-panel__actions">
            <button className="btn btn--primary" onClick={handleSendAngles}>
              Send All Angles
            </button>
            <button className="btn btn--secondary" onClick={handleReset}>
              Reset to Current
            </button>
          </div>
        </div>
      )}

      {tab === 'ik' && (
        <div className="ik-panel">
          <p className="ik-panel__desc">Enter target coordinates in the arm's local frame. The system will compute joint angles via inverse kinematics.</p>
          <div className="ik-panel__grid">
            <div className="ik-panel__field">
              <label>X (mm)</label>
              <input
                type="number"
                value={coordX}
                onChange={(e) => setCoordX(e.target.value)}
                className="ik-panel__input"
              />
            </div>
            <div className="ik-panel__field">
              <label>Y (mm)</label>
              <input
                type="number"
                value={coordY}
                onChange={(e) => setCoordY(e.target.value)}
                className="ik-panel__input"
              />
            </div>
            <div className="ik-panel__field">
              <label>Z (mm)</label>
              <input
                type="number"
                value={coordZ}
                onChange={(e) => setCoordZ(e.target.value)}
                className="ik-panel__input"
              />
            </div>
            <div className="ik-panel__field">
              <label>Rotation (°)</label>
              <input
                type="number"
                min="0"
                max="360"
                value={coordRot}
                onChange={(e) => setCoordRot(e.target.value)}
                className="ik-panel__input"
              />
            </div>
          </div>
          <div className="ik-panel__actions">
            <button className="btn btn--primary" onClick={handleApplyIK}>
              Compute & Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
