# Web-based Moonraker OBS Scene Changer

A browser-based tool to automatically switch OBS scenes based on Moonraker toolchange events.

## Features

- No Python installation required
- Real-time WebSocket connections to both Moonraker and OBS
- Configuration saved in browser localStorage
- Live activity log
- Auto-reconnect on connection loss
- Dark theme UI

## Setup

1. **Enable OBS WebSocket**:
   - Open OBS Studio
   - Go to Tools → WebSocket Server Settings
   - Enable WebSocket server
   - Set a password (optional but recommended)
   - Note the port number (default: 4455)

2. **Open the web interface**:
   - Simply open `index.html` in any modern web browser (Chrome, Firefox, Edge, etc.)
   - Or serve it with a local web server

3. **Configure settings**:
   - **Moonraker Host**: IP address or hostname of your printer (e.g., `192.168.1.100` or `mainsailos.local`)
   - **Moonraker Port**: Usually `7125`
   - **OBS Host**: Usually `localhost` if OBS is on the same machine
   - **OBS Port**: Default is `4455`
   - **OBS Password**: Enter the password you set in OBS WebSocket settings
   - **Scene Names**: Enter the exact names of your OBS scenes

4. **Click Connect**: The page will connect to both Moonraker and OBS

## Usage

Once connected, the tool will automatically:
- Listen for `echo: Toolchange Starting` messages from your printer
- Switch to the Tool Changing scene
- Listen for `echo: Toolchange Completed` messages
- Switch back to the Printing scene

Keep the browser tab open for the tool to work. The configuration is automatically saved and will be remembered next time you open the page.

## Troubleshooting

- **Can't connect to OBS**: Make sure OBS WebSocket is enabled and the password is correct
- **Can't connect to Moonraker**: Verify the host and port are correct
- **Scenes don't switch**: Check that the scene names exactly match your OBS scenes (case-sensitive)
- **Browser blocked WebSocket**: Some browsers may block insecure WebSocket connections. Try using `localhost` for local connections.

## Requirements

- Modern web browser (Chrome, Firefox, Edge, Safari)
- OBS Studio with WebSocket plugin (built-in for OBS 28+)
- Moonraker-enabled 3D printer (Klipper)

## Notes

- This replaces the Python script with a simpler browser-based solution
- No installation or dependencies required
- Works on any device with a web browser (desktop, tablet, phone)
