let obs = null;
let moonrakerWs = null;
let isConnected = false;
let cameraStream = null;
let autoSwitchEnabled = true;

function addLog(message, type = 'info') {
    const log = document.getElementById('log');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

function updateStatus(moonrakerConnected, obsConnected) {
    const moonrakerStatus = document.getElementById('status-moonraker');
    const obsStatus = document.getElementById('status-obs');
    
    if (moonrakerConnected) {
        moonrakerStatus.textContent = '✓ Moonraker: Connected';
        moonrakerStatus.className = 'status connected';
    } else {
        moonrakerStatus.textContent = '✗ Moonraker: Disconnected';
        moonrakerStatus.className = 'status disconnected';
    }
    
    if (obsConnected) {
        obsStatus.textContent = '✓ OBS: Connected';
        obsStatus.className = 'status connected';
    } else {
        obsStatus.textContent = '✗ OBS: Disconnected';
        obsStatus.className = 'status disconnected';
    }
}

async function connectOBS() {
    const host = document.getElementById('obs-host').value;
    const port = document.getElementById('obs-port').value;
    const password = document.getElementById('obs-password').value;

    try {
        obs = new OBSWebSocket();
        const connectUrl = `ws://${host}:${port}`;
        
        await obs.connect(connectUrl, password || undefined);
        addLog('Connected to OBS WebSocket', 'success');
        
        // Automatically refresh scenes after connecting
        await refreshScenes();
        
        // Update virtual camera button state
        await updateVirtualCameraButton();
        
        // Automatically start camera preview
        await autoStartCameraPreview();
        
        return true;
    } catch (error) {
        addLog(`OBS connection error: ${error.message}`, 'error');
        console.error('OBS connection error:', error);
        obs = null; // Clear the obs object on failure
        return false;
    }
}

async function updateVirtualCameraButton() {
    if (!obs) return;
    
    try {
        const vcStatus = await obs.call('GetVirtualCamStatus');
        const btn = document.getElementById('toggle-obs-camera-btn');
        
        if (vcStatus.outputActive) {
            btn.textContent = 'Stop OBS Virtual Camera';
        } else {
            btn.textContent = 'Start OBS Virtual Camera';
        }
    } catch (error) {
        console.error('Error checking virtual camera status:', error);
    }
}

async function autoStartCameraPreview() {
    // Check if virtual camera is already running
    try {
        const vcStatus = await obs.call('GetVirtualCamStatus');
        
        if (vcStatus.outputActive) {
            // Virtual camera is already on, start preview
            addLog('OBS Virtual Camera detected, starting preview...', 'info');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (!cameraStream) {
                await toggleCameraPreview();
            }
        } else {
            addLog('OBS Virtual Camera is not active. Use the "Start OBS Virtual Camera" button to enable it.', 'info');
        }
    } catch (error) {
        console.error('Error auto-starting camera preview:', error);
    }
}

async function refreshScenes() {
    if (!obs) {
        addLog('Please connect to OBS first', 'error');
        return;
    }

    try {
        const response = await obs.call('GetSceneList');
        const scenes = response.scenes;
        
        if (!scenes || scenes.length === 0) {
            addLog('No scenes found in OBS', 'warn');
            return;
        }
        
        // Get current selections
        const currentToolChanging = document.getElementById('scene-toolchanging').value;
        const currentPrinting = document.getElementById('scene-printing').value;
        
        // Update both dropdowns
        const toolChangingSelect = document.getElementById('scene-toolchanging');
        const printingSelect = document.getElementById('scene-printing');
        
        // Clear existing options except the first one
        toolChangingSelect.innerHTML = '<option value="">-- Select Scene --</option>';
        printingSelect.innerHTML = '<option value="">-- Select Scene --</option>';
        
        // Reverse the array to maintain OBS order (scenes come in reverse order from the API)
        const scenesInOrder = [...scenes].reverse();
        
        // Add scenes to dropdowns in the same order as OBS
        scenesInOrder.forEach(scene => {
            const sceneName = scene.sceneName;
            
            const option1 = document.createElement('option');
            option1.value = sceneName;
            option1.textContent = sceneName;
            if (sceneName === currentToolChanging) option1.selected = true;
            toolChangingSelect.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = sceneName;
            option2.textContent = sceneName;
            if (sceneName === currentPrinting) option2.selected = true;
            printingSelect.appendChild(option2);
        });
        
        addLog(`Loaded ${scenes.length} scenes from OBS`, 'success');
        saveConfig(); // Save after refresh
    } catch (error) {
        addLog(`Error fetching scenes: ${error.message}`, 'error');
        console.error('Error fetching scenes:', error);
    }
}

async function setCamera(sceneType) {
    const sceneInputId = `scene-${sceneType.toLowerCase()}`;
    const sceneName = document.getElementById(sceneInputId).value;

    if (!obs) {
        addLog('OBS not connected', 'error');
        return;
    }

    if (!sceneName) {
        addLog(`No scene selected for ${sceneType}`, 'error');
        return;
    }

    try {
        await obs.call('SetCurrentProgramScene', {
            sceneName: sceneName
        });
        addLog(`Switched to ${sceneType} scene: ${sceneName}`, 'success');
    } catch (error) {
        addLog(`Error setting scene: ${error.message}`, 'error');
        console.error('Error setting scene:', error);
    }
}

async function switchToScene(sceneType) {
    const sceneInputId = `scene-${sceneType}`;
    const sceneName = document.getElementById(sceneInputId).value;

    if (!obs) {
        addLog('OBS not connected', 'error');
        return;
    }

    if (!sceneName) {
        addLog(`No scene selected for ${sceneType}`, 'error');
        return;
    }

    try {
        await obs.call('SetCurrentProgramScene', {
            sceneName: sceneName
        });
        addLog(`Manually switched to ${sceneType} scene: ${sceneName}`, 'success');
    } catch (error) {
        addLog(`Error switching scene: ${error.message}`, 'error');
        console.error('Error switching scene:', error);
    }
}

async function quickSwitchScene(sceneType) {
    const sceneInputId = `scene-${sceneType}`;
    const sceneName = document.getElementById(sceneInputId).value;

    if (!obs) {
        addLog('OBS not connected', 'error');
        return;
    }

    if (!sceneName) {
        addLog(`No scene configured for ${sceneType}`, 'error');
        return;
    }

    try {
        await obs.call('SetCurrentProgramScene', {
            sceneName: sceneName
        });
        const displayName = sceneType === 'toolchanging' ? 'Tool Changing' : 'Printing';
        addLog(`Quick switch to ${displayName} scene: ${sceneName}`, 'success');
    } catch (error) {
        addLog(`Error switching scene: ${error.message}`, 'error');
        console.error('Error switching scene:', error);
    }
}

function toggleAutoSwitch() {
    autoSwitchEnabled = !autoSwitchEnabled;
    const btn = document.getElementById('toggle-auto-switch-btn');
    
    if (autoSwitchEnabled) {
        btn.textContent = '🔒 Disable Auto-Switch';
        btn.style.backgroundColor = '#0e639c';
        addLog('Auto-switch enabled', 'success');
    } else {
        btn.textContent = '🔓 Enable Auto-Switch';
        btn.style.backgroundColor = '#8b4513';
        addLog('Auto-switch disabled', 'info');
    }
}

function connectMoonraker() {
    const host = document.getElementById('moonraker-host').value;
    const port = document.getElementById('moonraker-port').value;
    const wsUrl = `ws://${host}:${port}/websocket`;
    
    moonrakerWs = new WebSocket(wsUrl);
    
    moonrakerWs.onopen = () => {
        addLog('Connected to Moonraker', 'success');
        updateStatus(true, obs !== null);
        updateButtonText();
    };
    
    moonrakerWs.onmessage = (event) => {
        try {
            const response = JSON.parse(event.data);
            
            if (response.method === 'notify_gcode_response') {
                const params = response.params || [];
                params.forEach(log => {
                    if (log.startsWith('echo: Toolchange Starting')) {
                        addLog('Tool change detected: Starting', 'info');
                        if (autoSwitchEnabled) {
                            setCamera('ToolChanging');
                        } else {
                            addLog('Auto-switch disabled - scene not changed', 'info');
                        }
                    } else if (log.startsWith('echo: Toolchange Completed')) {
                        addLog('Tool change detected: Completed', 'info');
                        if (autoSwitchEnabled) {
                            setCamera('Printing');
                        } else {
                            addLog('Auto-switch disabled - scene not changed', 'info');
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    };
    
    moonrakerWs.onerror = (error) => {
        addLog(`Moonraker error: ${error.type}`, 'error');
        console.error('Moonraker error:', error);
        updateStatus(false, obs !== null);
        updateButtonText();
    };
    
    moonrakerWs.onclose = () => {
        addLog('Moonraker disconnected', 'error');
        updateStatus(false, obs !== null);
        updateButtonText();
        
        if (isConnected) {
            addLog('Attempting to reconnect in 5 seconds...', 'info');
            setTimeout(() => {
                if (isConnected) {
                    connectMoonraker();
                }
            }, 5000);
        }
    };
}

async function toggleConnection() {
    const btn = document.getElementById('connect-btn');
    const bothConnected = obs !== null && moonrakerWs !== null && moonrakerWs.readyState === WebSocket.OPEN;
    const anyConnected = obs !== null || (moonrakerWs !== null && moonrakerWs.readyState === WebSocket.OPEN);
    
    if (!anyConnected) {
        // Connect both
        btn.disabled = true;
        btn.textContent = 'Connecting...';
        addLog('Starting connection...', 'info');
        
        const obsConnected = await connectOBS();
        updateStatus(false, obsConnected);
        connectMoonraker();
        
        isConnected = true;
        updateButtonText();
        btn.disabled = false;
        
        // Disable config inputs while connected, but keep scene selectors enabled
        document.querySelectorAll('#config-section input, #config-section select').forEach(input => {
            if (input.id !== 'scene-toolchanging' && input.id !== 'scene-printing') {
                input.disabled = true;
            }
        });
        
        // Hide configuration section on successful connect
        hideConfiguration();
    } else if (!bothConnected) {
        // Reconnect missing connection
        btn.disabled = true;
        btn.textContent = 'Connecting...';
        
        if (!obs) {
            addLog('Reconnecting to OBS...', 'info');
            const obsConnected = await connectOBS();
            updateStatus(moonrakerWs !== null && moonrakerWs.readyState === WebSocket.OPEN, obsConnected);
        }
        
        if (!moonrakerWs || moonrakerWs.readyState !== WebSocket.OPEN) {
            addLog('Reconnecting to Moonraker...', 'info');
            connectMoonraker();
        }
        
        updateButtonText();
        btn.disabled = false;
    } else {
        // Disconnect all
        isConnected = false;
        
        if (obs) {
            await obs.disconnect();
            obs = null;
            addLog('Disconnected from OBS', 'info');
        }
        
        if (moonrakerWs) {
            moonrakerWs.close();
            moonrakerWs = null;
            addLog('Disconnected from Moonraker', 'info');
        }
        
        updateStatus(false, false);
        btn.textContent = 'Connect';
        
        // Enable all config inputs
        document.querySelectorAll('#config-section input, #config-section select').forEach(input => input.disabled = false);
    }
}

function updateButtonText() {
    const btn = document.getElementById('connect-btn');
    const obsConnected = obs !== null;
    const moonrakerConnected = moonrakerWs !== null && moonrakerWs.readyState === WebSocket.OPEN;
    
    if (obsConnected && moonrakerConnected) {
        btn.textContent = 'Disconnect All';
    } else if (!obsConnected && !moonrakerConnected) {
        btn.textContent = 'Connect';
    } else if (!obsConnected) {
        btn.textContent = 'Reconnect OBS';
    } else if (!moonrakerConnected) {
        btn.textContent = 'Reconnect Moonraker';
    }
}

// Load saved configuration from localStorage
window.addEventListener('load', () => {
    const savedConfig = localStorage.getItem('obs-scene-changer-config');
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            document.getElementById('moonraker-host').value = config.moonrakerHost || 'voron.local';
            document.getElementById('moonraker-port').value = config.moonrakerPort || '7125';
            document.getElementById('obs-host').value = config.obsHost || 'localhost';
            document.getElementById('obs-port').value = config.obsPort || '4455';
            document.getElementById('obs-password').value = config.obsPassword || '';
            
            // Set scene selections (will need options to be populated first)
            if (config.sceneToolChanging) {
                const toolChangingSelect = document.getElementById('scene-toolchanging');
                const option = document.createElement('option');
                option.value = config.sceneToolChanging;
                option.textContent = config.sceneToolChanging;
                option.selected = true;
                toolChangingSelect.appendChild(option);
            }
            
            if (config.scenePrinting) {
                const printingSelect = document.getElementById('scene-printing');
                const option = document.createElement('option');
                option.value = config.scenePrinting;
                option.textContent = config.scenePrinting;
                option.selected = true;
                printingSelect.appendChild(option);
            }
            
            addLog('Loaded saved configuration', 'info');
        } catch (e) {
            console.error('Error loading config:', e);
        }
    }
});

// Save configuration before connecting
function saveConfig() {
    const config = {
        moonrakerHost: document.getElementById('moonraker-host').value,
        moonrakerPort: document.getElementById('moonraker-port').value,
        obsHost: document.getElementById('obs-host').value,
        obsPort: document.getElementById('obs-port').value,
        obsPassword: document.getElementById('obs-password').value,
        sceneToolChanging: document.getElementById('scene-toolchanging').value,
        scenePrinting: document.getElementById('scene-printing').value
    };
    localStorage.setItem('obs-scene-changer-config', JSON.stringify(config));
}

// Save config when inputs or selects change
document.querySelectorAll('input, select').forEach(element => {
    element.addEventListener('change', saveConfig);
});

async function toggleOBSVirtualCamera() {
    const btn = document.getElementById('toggle-obs-camera-btn');
    
    if (!obs) {
        addLog('Please connect to OBS first', 'error');
        return;
    }
    
    try {
        // Check current virtual camera status
        const vcStatus = await obs.call('GetVirtualCamStatus');
        
        if (!vcStatus.outputActive) {
            // Start OBS Virtual Camera
            await obs.call('StartVirtualCam');
            btn.textContent = 'Stop OBS Virtual Camera';
            addLog('OBS Virtual Camera started', 'success');
        } else {
            // Stop OBS Virtual Camera
            await obs.call('StopVirtualCam');
            btn.textContent = 'Start OBS Virtual Camera';
            addLog('OBS Virtual Camera stopped', 'success');
        }
    } catch (error) {
        addLog(`Virtual camera error: ${error.message}`, 'error');
        console.error('Virtual camera error:', error);
    }
}

async function toggleCameraPreview() {
    const btn = document.getElementById('toggle-preview-btn');
    const video = document.getElementById('camera-preview');
    const status = document.getElementById('camera-status');
    
    if (!cameraStream) {
        try {
            // Connect to the camera feed
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });
            
            cameraStream = stream;
            video.srcObject = stream;
            video.classList.add('active');
            status.classList.add('hidden');
            btn.textContent = 'Hide Preview';
            addLog('Camera preview started', 'success');
        } catch (error) {
            addLog(`Camera preview error: ${error.message}. Make sure OBS Virtual Camera is enabled.`, 'error');
            console.error('Camera error:', error);
            
            // Show available devices for debugging
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                console.log('Available video devices:', videoDevices);
                addLog(`Found ${videoDevices.length} video device(s). Check console for details.`, 'info');
            } catch (e) {
                console.error('Error enumerating devices:', e);
            }
        }
    } else {
        // Stop preview
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        video.srcObject = null;
        video.classList.remove('active');
        status.classList.remove('hidden');
        status.textContent = 'Enable OBS Virtual Camera and click "Show Preview"';
        btn.textContent = 'Show Preview';
        addLog('Camera preview stopped', 'info');
    }
}

// Show device selector if OBS Virtual Camera is not found
async function selectCamera() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
            addLog('No video devices found. Make sure OBS Virtual Camera is enabled.', 'error');
            return null;
        }
        
        // Try to find OBS Virtual Camera
        const obsCamera = videoDevices.find(d => 
            d.label.toLowerCase().includes('obs') || 
            d.label.toLowerCase().includes('virtual')
        );
        
        return obsCamera ? obsCamera.deviceId : videoDevices[0].deviceId;
    } catch (error) {
        console.error('Error selecting camera:', error);
        return null;
    }
}

function toggleConfig() {
    const configSection = document.getElementById('config-section');
    const btn = document.getElementById('toggle-config-btn');
    
    if (configSection.classList.contains('hidden')) {
        configSection.classList.remove('hidden');
        btn.textContent = '⚙️ Hide Configuration';
    } else {
        configSection.classList.add('hidden');
        btn.textContent = '⚙️ Show Configuration';
    }
}

function hideConfiguration() {
    const configSection = document.getElementById('config-section');
    const btn = document.getElementById('toggle-config-btn');
    
    configSection.classList.add('hidden');
    btn.textContent = '⚙️ Show Configuration';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const savedConfig = localStorage.getItem('obs-scene-changer-config');
    
    if (savedConfig) {
        // Hide config section initially if we have saved settings
        hideConfiguration();
        
        addLog('Found saved configuration. Attempting to connect...', 'info');
        
        // Wait a moment for the UI to settle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Attempt to auto-connect
        await toggleConnection();
    } else {
        addLog('Application ready. Configure settings and click Connect.', 'info');
    }
});
