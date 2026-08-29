# 🤖 Robotic Arm Controller

A modern web interface for controlling a 6-motor robotic arm via WebSocket. This is a React-based migration of the original single-file controller, with a dark theme UI.

## Architecture

```
Browser  ←→  Node.js Server (WebSocket)  ←→  ESP32 (servos)
```

- **Frontend**: React 19 + Vite — component-based UI with real-time motor control
- **Backend**: Node.js WebSocket server — bridges browser ↔ ESP32
- **ESP32**: The source of truth for all motor states
- **Two-way sync**: Browser reflects ESP32 state in real-time

## Motor Mapping

| Motor | Label       |
|-------|-------------|
| M1    | Shoulder    |
| M2    | Upper Arm   |
| M3    | Elbow       |
| M4    | Wrist Pitch |
| M5    | Wrist Roll  |
| M6    | Gripper     |

Each motor accepts angles **0°–180°**. Commands are throttled at 100ms intervals.

## Features

- Real-time slider control for all 6 motors
- **Two-way sync** — ESP32 is source of truth, UI reflects real servo positions
- Pose Builder — set all 6 angles at once and send sequentially
- WebSocket auto-reconnect
- Connection status indicator
- PM2-ready for VM deployment

## Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173` (Vite dev server). Note: the WebSocket server is only available in production mode.

## Production

```bash
npm run serve
```

This builds the React app and starts the Node.js server at `http://localhost:8080`.

## Deploy to Azure VM

### 1. SSH into your VM

```bash
ssh <your-username>@<your-vm-ip>
```

### 2. Install Node.js and PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 3. Clone and start the app

```bash
git clone https://github.com/<your-username>/<your-repo>.git ~/robotic-arm
cd ~/robotic-arm
npm install
pm2 start server/index.js --name robotic-arm
pm2 save
pm2 startup  # Run the command it outputs
```

### 4. Configure GitHub Actions

Add these secrets in **Settings → Secrets and variables → Actions**:

| Secret Name | Value |
|-------------|-------|
| `VM_HOST` | Your VM's public IP address |
| `VM_USER` | Your VM username (e.g., `azureuser`) |
| `VM_SSH_KEY` | SSH private key |

Now every push to `main` will automatically deploy to your VM.

## ESP32 Protocol

### Registration

1. Connect to `ws://<server-ip>:8080`
2. Send `"ESP32"` as your first message
3. Receive `{"type": "ack", "status": "registered"}`

### Receiving commands from the browser

Listen for JSON messages:
```json
{"motorId": 1, "angle": 90}
```

### Sending state back to the browser (two-way)

The ESP32 is the **source of truth**. Send state updates so the UI stays in sync:

**Single motor update** — send when a servo moves:
```json
{"type": "motorUpdate", "motorId": 1, "angle": 90}
```

**Full state sync** — send on connect or periodically:
```json
{"type": "stateSync", "angles": [90, 45, 120, 90, 90, 0]}
```

The server broadcasts these to all connected browser clients automatically.

## Project Structure

```
├── .github/workflows/
│   └── deploy.yml             # CI/CD pipeline for Azure VM
├── src/
│   ├── hooks/
│   │   └── useWebSocket.js    # WebSocket connection hook
│   ├── components/
│   │   ├── MotorCard.jsx      # Individual motor control card
│   │   ├── PoseBuilder.jsx    # Multi-motor pose sender
│   │   └── StatusBar.jsx      # Connection status display
│   ├── App.jsx                # Main application layout
│   ├── App.css                # Component styles
│   ├── index.css              # Global theme variables
│   └── main.jsx               # React entry point
├── server/
│   └── index.js               # Node.js + WebSocket server
└── package.json
```
