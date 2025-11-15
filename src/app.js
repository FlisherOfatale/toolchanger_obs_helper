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
        moonrakerStatus.innerHTML = '✓ Moonraker: Connected';
        moonrakerStatus.className = 'status connected';
    } else {
        moonrakerStatus.className = 'status disconnected';
        moonrakerStatus.innerHTML = '✗ Moonraker: Disconnected<br><button class="status-action" onclick="toggleMoonrakerConnection()">Connect</button>';
    }
    
    if (obsConnected) {
        obsStatus.innerHTML = '✓ OBS: Connected';
        obsStatus.className = 'status connected';
    } else {
        obsStatus.className = 'status disconnected';
        obsStatus.innerHTML = '✗ OBS: Disconnected<br><button class="status-action" onclick="toggleOBSConnection()">Connect</button>';
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

        // Ensure OBS Virtual Camera is running. If not active, start it.
        try {
            const vcStatus = await obs.call('GetVirtualCamStatus');
            if (!vcStatus || !vcStatus.outputActive) {
                addLog('OBS Virtual Camera is not active. Starting it now...', 'info');
                try {
                    await obs.call('StartVirtualCam');
                    addLog('OBS Virtual Camera started', 'success');
                } catch (e) {
                    addLog(`Failed to start OBS Virtual Camera: ${e.message}`, 'error');
                    console.error('StartVirtualCam error:', e);
                }
            }
        } catch (e) {
            console.error('Error checking virtual camera status:', e);
        }

        // Automatically start camera preview if virtual camera active
        await autoStartCameraPreview();
        
        return true;
    } catch (error) {
        addLog(`OBS connection error: ${error.message}`, 'error');
        console.error('OBS connection error:', error);
        obs = null; // Clear the obs object on failure
        return false;
    }
}

// virtual camera is now managed automatically on connect; remove manual UI update helper

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
                // Get configured trigger variants (plain and prefixed with 'echo: ')
                const triggers = getToolchangeTriggers();
                params.forEach(log => {
                    const responseLog = String(log || '');
                    if (triggers.startVariants.some(v => responseLog.startsWith(v))) {
                        addLog('Tool change detected: Starting', 'info');
                        if (autoSwitchEnabled) {
                            setCamera('ToolChanging');
                        } else {
                            addLog('Auto-switch disabled - scene not changed', 'info');
                        }
                    } else if (triggers.completeVariants.some(v => responseLog.startsWith(v))) {
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

async function toggleOBSConnection() {
    const btn = document.getElementById('connect-obs-btn');
    
    if (obs !== null) {
        // Disconnect OBS
        btn.disabled = true;
        await obs.disconnect();
        obs = null;
        addLog('Disconnected from OBS', 'info');
        btn.textContent = 'Connect OBS';
        updateStatus(moonrakerWs !== null && moonrakerWs.readyState === WebSocket.OPEN, false);
        btn.disabled = false;
        
        // Re-enable OBS config inputs
        document.getElementById('obs-host').disabled = false;
        document.getElementById('obs-port').disabled = false;
        document.getElementById('obs-password').disabled = false;
    } else {
        // Connect OBS
        btn.disabled = true;
        btn.textContent = 'Connecting...';
        addLog('Connecting to OBS...', 'info');
        
        const obsConnected = await connectOBS();
        updateStatus(moonrakerWs !== null && moonrakerWs.readyState === WebSocket.OPEN, obsConnected);
        
        if (obsConnected) {
            btn.textContent = 'Disconnect OBS';
            // Disable OBS config inputs while connected
            document.getElementById('obs-host').disabled = true;
            document.getElementById('obs-port').disabled = true;
            document.getElementById('obs-password').disabled = true;
        } else {
            btn.textContent = 'Connect OBS';
        }
        btn.disabled = false;
    }
}

async function toggleMoonrakerConnection() {
    const btn = document.getElementById('connect-moonraker-btn');
    
    if (moonrakerWs !== null && moonrakerWs.readyState === WebSocket.OPEN) {
        // Disconnect Moonraker
        btn.disabled = true;
        moonrakerWs.close();
        moonrakerWs = null;
        addLog('Disconnected from Moonraker', 'info');
        btn.textContent = 'Connect Moonraker';
        updateStatus(false, obs !== null);
        btn.disabled = false;
        
        // Re-enable Moonraker config inputs
        document.getElementById('moonraker-host').disabled = false;
        document.getElementById('moonraker-port').disabled = false;
    } else {
        // Connect Moonraker
        btn.disabled = true;
        btn.textContent = 'Connecting...';
        addLog('Connecting to Moonraker...', 'info');
        
        connectMoonraker();
        
        // Disable Moonraker config inputs while connecting
        document.getElementById('moonraker-host').disabled = true;
        document.getElementById('moonraker-port').disabled = true;
        btn.textContent = 'Disconnect Moonraker';
        btn.disabled = false;
    }
}

function updateButtonText() {
    const obsBtn = document.getElementById('connect-obs-btn');
    const moonrakerBtn = document.getElementById('connect-moonraker-btn');
    
    if (obs !== null) {
        obsBtn.textContent = 'Disconnect OBS';
    } else {
        obsBtn.textContent = 'Connect OBS';
    }
    
    if (moonrakerWs !== null && moonrakerWs.readyState === WebSocket.OPEN) {
        moonrakerBtn.textContent = 'Disconnect Moonraker';
    } else {
        moonrakerBtn.textContent = 'Connect Moonraker';
    }
}

// Load saved configuration from localStorage and attempt auto-connect when present
window.addEventListener('load', async () => {
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

            // Load saved trigger texts if present
            if (config.triggerToolChanging && document.getElementById('trigger-toolchanging')) {
                document.getElementById('trigger-toolchanging').value = config.triggerToolChanging;
            }
            if (config.triggerPrinting && document.getElementById('trigger-printing')) {
                document.getElementById('trigger-printing').value = config.triggerPrinting;
            }

            addLog('Loaded saved configuration', 'info');

            // Keep configuration visible so trigger inputs are accessible by default
            const toggleBtn = document.getElementById('toggle-config-btn');
            if (toggleBtn) toggleBtn.textContent = '⚙️ Hide Configuration';
            addLog('Attempting to auto-connect to OBS and Moonraker...', 'info');

            // Try connecting to OBS first
            try {
                const obsConnected = await connectOBS();
                if (obsConnected) {
                    // Update OBS connect button and disable OBS inputs
                    const obsBtn = document.getElementById('connect-obs-btn');
                    if (obsBtn) obsBtn.textContent = 'Disconnect OBS';
                    document.getElementById('obs-host').disabled = true;
                    document.getElementById('obs-port').disabled = true;
                    document.getElementById('obs-password').disabled = true;
                }
            } catch (e) {
                console.error('Auto-connect OBS failed:', e);
            }

            // Then connect to Moonraker
            try {
                connectMoonraker();
                // disable moonraker inputs while connecting
                document.getElementById('moonraker-host').disabled = true;
                document.getElementById('moonraker-port').disabled = true;
            } catch (e) {
                console.error('Auto-connect Moonraker failed:', e);
            }

            // Refresh button labels
            updateButtonText();

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
    // Include tool-change trigger texts if present
    const triggerToolChangingEl = document.getElementById('trigger-toolchanging');
    const triggerPrintingEl = document.getElementById('trigger-printing');
    if (triggerToolChangingEl) config.triggerToolChanging = triggerToolChangingEl.value;
    if (triggerPrintingEl) config.triggerPrinting = triggerPrintingEl.value;

    localStorage.setItem('obs-scene-changer-config', JSON.stringify(config));
    document.cookie = `obsSceneChanger=${encodeURIComponent(JSON.stringify(config))};max-age=${60*60*24*365};path=/`;
}

// Helper: get the configured trigger strings and return arrays of strings to match against logs
function getToolchangeTriggers() {
    const prefix = 'echo: ';
    const startTrigger = (document.getElementById('trigger-toolchanging') && document.getElementById('trigger-toolchanging').value) || 'Toolchange Starting';
    const completeTrigger = (document.getElementById('trigger-printing') && document.getElementById('trigger-printing').value) || 'Toolchange Completed';

    // Accept both the plain trigger and the prefixed version
    const startVariants = [startTrigger, prefix + startTrigger];
    const completeVariants = [completeTrigger, prefix + completeTrigger];

    return {
        startVariants,
        completeVariants
    };
}

// Save config when inputs or selects change
document.querySelectorAll('input, select').forEach(element => {
    element.addEventListener('change', saveConfig);
});

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

function resetConfig() {
    if (!confirm('Reset saved configuration? This will clear stored values.')) {
        return;
    }
    // Remove stored config from localStorage and cookie
    try {
        localStorage.removeItem('obs-scene-changer-config');
        document.cookie = 'obsSceneChanger=; max-age=0; path=/';
    } catch (e) {
        console.error('Error clearing stored config:', e);
    }

    // Re-enable config inputs in case they were disabled
    document.querySelectorAll('#config-section input, #config-section select').forEach(el => {
        el.disabled = false;
    });

    // Reload to reset UI state
    location.reload();
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
document.addEventListener('DOMContentLoaded', () => {
    const savedConfig = localStorage.getItem('obs-scene-changer-config');
    let config = null;
    if (savedConfig) {
        try {
            config = JSON.parse(savedConfig);
        } catch (e) {
            console.error('Error parsing saved config:', e);
            config = null;
        }
    }

    // If we have saved trigger texts, populate the inputs
    if (config) {
        if (config.triggerToolChanging && document.getElementById('trigger-toolchanging')) {
            document.getElementById('trigger-toolchanging').value = config.triggerToolChanging;
        }
        if (config.triggerPrinting && document.getElementById('trigger-printing')) {
            document.getElementById('trigger-printing').value = config.triggerPrinting;
        }
        addLog('Loaded saved configuration.', 'info');
    } else {
        addLog('Application ready. Configure settings and click Connect.', 'info');
    }

    // Ensure the toggle button reflects current visibility
    const toggleBtn = document.getElementById('toggle-config-btn');
    const configSection = document.getElementById('config-section');
    if (toggleBtn && configSection) {
        if (configSection.classList.contains('hidden')) {
            toggleBtn.textContent = '⚙️ Show Configuration';
        } else {
            toggleBtn.textContent = '⚙️ Hide Configuration';
        }
    }
});
