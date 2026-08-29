import { useState, useRef, useCallback, useEffect } from 'react'

const API_BASE = '/api/recordings'

async function fetchRecordings() {
  const res = await fetch(API_BASE)
  if (!res.ok) throw new Error('Failed to load recordings')
  return res.json()
}

async function saveRecording(rec) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rec),
  })
  if (!res.ok) throw new Error('Failed to save recording')
  return res.json()
}

async function deleteRecording(id) {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete recording')
}

export default function RecordingControls({ angles, onSendPose }) {
  const [recordings, setRecordings] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playingName, setPlayingName] = useState('')
  const [playingProgress, setPlayingProgress] = useState('')
  const [recordingFrameCount, setRecordingFrameCount] = useState(0)
  const [recordingName, setRecordingName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [selectedRec, setSelectedRec] = useState(null)

  const framesRef = useRef([])
  const intervalRef = useRef(null)
  const playTimeoutsRef = useRef([])
  const playIndexRef = useRef(0)
  const anglesRef = useRef(angles)
  const recordingsRef = useRef(recordings)

  // Keep refs in sync
  useEffect(() => {
    anglesRef.current = angles
  }, [angles])

  useEffect(() => {
    recordingsRef.current = recordings
  }, [recordings])

  // Load recordings from server on mount
  useEffect(() => {
    fetchRecordings()
      .then(setRecordings)
      .catch((e) => console.error('Failed to load recordings:', e))
  }, [])

  // ── Recording ──
  const startRecording = useCallback(() => {
    framesRef.current = []
    setIsRecording(true)
    setRecordingFrameCount(0)
    setRecordingName(`Recording ${new Date().toLocaleTimeString()}`)

    framesRef.current.push([...anglesRef.current])
    setRecordingFrameCount(1)

    intervalRef.current = setInterval(() => {
      framesRef.current.push([...anglesRef.current])
      setRecordingFrameCount(framesRef.current.length)
    }, 200)
  }, [])

  const stopRecording = useCallback(() => {
    clearInterval(intervalRef.current)
    intervalRef.current = null
    setIsRecording(false)
    setShowSaveInput(true)
  }, [])

  // ── Save to server ──
  const handleSave = async () => {
    const name = recordingName.trim() || `Recording ${new Date().toLocaleTimeString()}`
    const rec = {
      id: Date.now().toString(),
      name,
      frames: framesRef.current,
      createdAt: new Date().toISOString(),
    }

    try {
      const saved = await saveRecording(rec)
      setRecordings((prev) => [...prev, saved])
      setShowSaveInput(false)
      setRecordingName('')
      framesRef.current = []
    } catch (e) {
      console.error('Save failed:', e)
      alert('Failed to save recording. Is the server running?')
    }
  }

  // ── Delete from server ──
  const handleDelete = async (id) => {
    try {
      await deleteRecording(id)
      setRecordings((prev) => prev.filter((r) => r.id !== id))
      if (selectedRec === id) setSelectedRec(null)
    } catch (e) {
      console.error('Delete failed:', e)
    }
  }

  // ── Playback ──
  const startPlayback = useCallback(() => {
    const rec = recordingsRef.current.find((r) => r.id === selectedRec)
    if (!rec || rec.frames.length === 0) return

    setIsPlaying(true)
    setPlayingName(rec.name)
    setPlayingProgress(`1 / ${rec.frames.length}`)
    playIndexRef.current = 0

    rec.frames.forEach((frame, i) => {
      const timeout = setTimeout(() => {
        playIndexRef.current = i
        onSendPose(frame)
        setPlayingProgress(`${i + 1} / ${rec.frames.length}`)

        if (i === rec.frames.length - 1) {
          setTimeout(() => {
            setIsPlaying(false)
            setPlayingName('')
            setPlayingProgress('')
          }, 300)
        }
      }, i * 200)
      playTimeoutsRef.current.push(timeout)
    })
  }, [selectedRec, onSendPose])

  const stopPlayback = useCallback(() => {
    playTimeoutsRef.current.forEach(clearTimeout)
    playTimeoutsRef.current = []
    setIsPlaying(false)
    setPlayingName('')
    setPlayingProgress('')
  }, [])

  return (
    <div className="recording">
      <div className="recording__header">
        <h3>🎬 Record & Play</h3>
      </div>

      <div className="recording__controls">
        {!isRecording ? (
          <button className="btn btn--record" onClick={startRecording}>
            ⏺ Start Recording
          </button>
        ) : (
          <button className="btn btn--stop" onClick={stopRecording}>
            ⏹ Stop Recording
          </button>
        )}

        {isRecording && (
          <span className="recording__status recording__status--recording">
            <span className="recording__dot recording__dot--red" />
            Recording… {recordingFrameCount} frames
          </span>
        )}
      </div>

      {showSaveInput && (
        <div className="recording__save">
          <input
            type="text"
            className="recording__save-input"
            placeholder="Recording name"
            value={recordingName}
            onChange={(e) => setRecordingName(e.target.value)}
            autoFocus
          />
          <button className="btn btn--primary btn--sm" onClick={handleSave}>
            Save
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => { setShowSaveInput(false); framesRef.current = [] }}>
            Discard
          </button>
        </div>
      )}

      {recordings.length > 0 && (
        <div className="recording__list">
          <span className="recording__list-label">Saved Recordings</span>
          {recordings.map((rec) => (
            <div
              key={rec.id}
              className={`recording__item ${selectedRec === rec.id ? 'recording__item--selected' : ''}`}
              onClick={() => setSelectedRec(rec.id)}
            >
              <div className="recording__item-info">
                <span className="recording__item-name">{rec.name}</span>
                <span className="recording__item-meta">{rec.frames.length} frames · {new Date(rec.createdAt).toLocaleDateString()}</span>
              </div>
              <button
                className="recording__item-delete"
                onClick={(e) => { e.stopPropagation(); handleDelete(rec.id) }}
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedRec && !isRecording && (
        <div className="recording__playback">
          {!isPlaying ? (
            <button className="btn btn--primary" onClick={startPlayback}>
              ▶ Play
            </button>
          ) : (
            <button className="btn btn--stop" onClick={stopPlayback}>
              ⏹ Stop
            </button>
          )}
          {isPlaying && (
            <span className="recording__status">
              Playing: {playingName} ({playingProgress})
            </span>
          )}
        </div>
      )}
    </div>
  )
}
