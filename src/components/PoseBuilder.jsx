import { useState } from 'react'

const DEFAULT_ANGLES = [90, 90, 90, 90, 90, 90]

export default function PoseBuilder({ onSendPose }) {
  const [angles, setAngles] = useState(DEFAULT_ANGLES)

  const updateAngle = (index, value) => {
    const num = Math.max(0, Math.min(180, parseInt(value) || 0))
    const updated = [...angles]
    updated[index] = num
    setAngles(updated)
  }

  const handleSend = () => {
    onSendPose(angles)
  }

  const handleReset = () => {
    setAngles(DEFAULT_ANGLES)
  }

  return (
    <div className="pose-builder">
      <div className="pose-builder__header">
        <span className="pose-builder__icon">📋</span>
        <h3>Pose Builder</h3>
      </div>

      <div className="pose-builder__inputs">
        {angles.map((angle, i) => (
          <div key={i} className="pose-builder__field">
            <label>M{i + 1}</label>
            <input
              type="number"
              min="0"
              max="180"
              value={angle}
              onChange={(e) => updateAngle(i, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="pose-builder__actions">
        <button className="btn btn--primary" onClick={handleSend}>
          Send Pose
        </button>
        <button className="btn btn--secondary" onClick={handleReset}>
          Reset
        </button>
      </div>
    </div>
  )
}
