import { useCallback } from 'react'

const MOTOR_LABELS = {
  1: { name: 'Shoulder', icon: '🦾' },
  2: { name: 'Upper Arm', icon: '💪' },
  3: { name: 'Elbow', icon: '🦿' },
  4: { name: 'Wrist Pitch', icon: '🤲' },
  5: { name: 'Wrist Roll', icon: '🔄' },
  6: { name: 'Gripper', icon: '✊' },
}

export default function MotorCard({ motorId, angle, onAngleChange }) {
  const info = MOTOR_LABELS[motorId]

  const handleChange = useCallback(
    (e) => {
      const value = parseInt(e.target.value)
      onAngleChange(motorId, value)
    },
    [motorId, onAngleChange]
  )

  return (
    <div className="motor-card">
      <div className="motor-card__header">
        <span className="motor-card__icon">{info.icon}</span>
        <div className="motor-card__title">
          <h3>Motor {motorId}</h3>
          <span className="motor-card__label">{info.name}</span>
        </div>
      </div>

      <div className="motor-card__angle">
        <span className="motor-card__angle-value">{angle}</span>
        <span className="motor-card__angle-unit">degrees</span>
      </div>

      <div className="motor-card__slider">
        <input
          type="range"
          min="0"
          max="180"
          value={angle}
          onChange={handleChange}
          className="slider"
        />
        <div className="slider-labels">
          <span>0°</span>
          <span>90°</span>
          <span>180°</span>
        </div>
      </div>
    </div>
  )
}
