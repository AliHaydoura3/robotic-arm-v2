export default function StatusBar({ connected, lastCommand }) {
  return (
    <div className="status-bar">
      <div className="status-bar__connection">
        <span className={`status-dot ${connected ? 'status-dot--connected' : 'status-dot--disconnected'}`} />
        <span className={`status-text ${connected ? 'status-text--connected' : 'status-text--disconnected'}`}>
          {connected ? '✓ Connected' : '✗ Disconnected'}
        </span>
      </div>
      <div className="status-bar__command">
        {lastCommand || 'Waiting for input...'}
      </div>
    </div>
  )
}
