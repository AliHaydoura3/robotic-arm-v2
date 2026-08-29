import { useCallback } from 'react'

const MOTOR_LABELS = {
  1: 'Shoulder',
  2: 'Upper Arm',
  3: 'Elbow',
  4: 'Wrist Pitch',
  5: 'Wrist Roll',
  6: 'Gripper',
}

export default function MotorCard({ motorId, angle, onAngleChange }) {
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
        <div className="motor-card__id">M{motorId}</div>
        <div className="motor-card__title">
          <h3>Motor {motorId}</h3>
          <span className="motor-card__label">{MOTOR_LABELS[motorId]}</span>
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
