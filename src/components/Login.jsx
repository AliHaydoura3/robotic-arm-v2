import { useState } from 'react'

const PASSCODE = 'Pass123!'

export default function Login({ onLogin }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (code === PASSCODE) {
      sessionStorage.setItem('arm_auth', '1')
      onLogin()
    } else {
      setError('Invalid passcode')
      setCode('')
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__icon">🔐</div>
        <h1 className="login__title">Robotic Arm Controller</h1>
        <p className="login__subtitle">Enter passcode to access dashboard</p>
        <form onSubmit={handleSubmit} className="login__form">
          <input
            type="password"
            className={`login__input ${error ? 'login__input--error' : ''}`}
            placeholder="Enter passcode"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError('') }}
            autoFocus
          />
          {error && <span className="login__error">{error}</span>}
          <button type="submit" className="btn btn--primary login__btn">
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  )
}
