const video = document.getElementById('video');
const startBtn = document.getElementById('start-btn');
const emotionSpan = document.getElementById('emotion');
const playlistDiv = document.getElementById('playlist');
const genreSpan = document.getElementById('genre');
const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
const manualRefreshBtn = document.getElementById('manual-refresh-btn');

// Track current emotion and genre
let currentEmotion = 'neutral';
let selectedGenre = null;
let lastEmotionSent = null;
let emotionChangeCount = 0;
let autoRefreshEnabled = true;

// Add a message for camera status
let cameraStatusMsg = document.createElement('div');
cameraStatusMsg.id = 'camera-status';
cameraStatusMsg.style.color = 'red';
video.parentNode.insertBefore(cameraStatusMsg, video.nextSibling);

// Create canvas overlay for drawing face boxes
const canvas = document.createElement('canvas');
canvas.id = 'face-canvas';
canvas.style.position = 'absolute';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.pointerEvents = 'none';
canvas.style.zIndex = '10';
video.parentNode.style.position = 'relative';
video.parentNode.appendChild(canvas);

// Position canvas to match video exactly
function positionCanvas() {
    const videoRect = video.getBoundingClientRect();
    const containerRect = video.parentNode.getBoundingClientRect();
    
    canvas.style.top = (videoRect.top - containerRect.top) + 'px';
    canvas.style.left = (videoRect.left - containerRect.left) + 'px';
    canvas.width = video.offsetWidth;
    canvas.height = video.offsetHeight;
}

// Setup user controls
function setupControls() {
    // Auto-refresh toggle
    autoRefreshToggle.addEventListener('change', () => {
        autoRefreshEnabled = autoRefreshToggle.checked;
        console.log('Auto-refresh:', autoRefreshEnabled ? 'enabled' : 'disabled');
    });
    
    // Manual refresh button
    manualRefreshBtn.addEventListener('click', () => {
        if (currentEmotion !== 'None' && selectedGenre) {
            sendEmotionToBackend(currentEmotion, selectedGenre);
            console.log('Manual playlist refresh');
        } else {
            alert('Please select a genre and ensure emotion detection is active');
        }
    });
}

// Check if emotion has changed
function hasEmotionChanged(newEmotion) {
    return lastEmotionSent !== newEmotion;
}

// Genre selection functionality
function setupGenreButtons() {
    const genreButtons = document.querySelectorAll('.genre-btn');
    
    genreButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            genreButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Update selected genre
            selectedGenre = button.dataset.genre;
            genreSpan.textContent = selectedGenre;
            
            // Update playlist if emotion is detected and auto-refresh is enabled
            if (currentEmotion !== 'None' && autoRefreshEnabled) {
                sendEmotionToBackend(currentEmotion, selectedGenre);
            }
        });
    });
}

// Check if faceapi is loaded
function checkFaceAPI() {
    if (typeof faceapi === 'undefined') {
        cameraStatusMsg.textContent = 'Error: face-api.js library not loaded. Please refresh the page.';
        console.error('face-api.js not loaded');
        return false;
    }
    return true;
}

// Load face-api.js models from /static/models
async function loadModels() {
    if (!checkFaceAPI()) {
        throw new Error('face-api.js not available');
    }
    await faceapi.nets.tinyFaceDetector.loadFromUri('/static/models');
    await faceapi.nets.faceExpressionNet.loadFromUri('/static/models');
    console.log("Models loaded");
}

// Start webcam
async function startVideo() {
    cameraStatusMsg.textContent = '';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            // Set canvas size to match video display size (not raw video size)
            positionCanvas();
            cameraStatusMsg.textContent = '';
            console.log("Webcam stream started");
        };
        
        // Handle window resize to keep canvas in sync
        window.addEventListener('resize', () => {
            if (video.offsetWidth > 0 && video.offsetHeight > 0) {
                positionCanvas();
            }
        });
    } catch (err) {
        if (err.name === 'NotAllowedError') {
            cameraStatusMsg.textContent = 'Camera access denied. Please allow camera permissions.';
        } else if (err.name === 'NotFoundError') {
            cameraStatusMsg.textContent = 'No camera found. Please connect a camera.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            cameraStatusMsg.textContent = 'Camera is in use by another application. Please close other apps (Zoom, Teams, Camera, etc.) and try again.';
        } else {
            cameraStatusMsg.textContent = 'Could not access webcam: ' + err.message;
        }
        alert(cameraStatusMsg.textContent);
        console.error("Webcam error:", err);
    }
}

// Draw face box and emotion label
function drawFaceBox(detection, emotion) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (detection) {
        const box = detection.detection.box;
        
        // Get the actual display dimensions of the video
        const displayWidth = video.offsetWidth;
        const displayHeight = video.offsetHeight;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        
        // Calculate scale factors
        const scaleX = displayWidth / videoWidth;
        const scaleY = displayHeight / videoHeight;
        
        // Scale the bounding box coordinates
        const scaledBox = {
            x: Math.round(box.x * scaleX),
            y: Math.round(box.y * scaleY),
            width: Math.round(box.width * scaleX),
            height: Math.round(box.height * scaleY)
        };
        
        // Draw the box
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(scaledBox.x, scaledBox.y, scaledBox.width, scaledBox.height);
        
        // Draw the emotion label
        ctx.fillStyle = '#00ff00';
        ctx.font = '16px Arial';
        ctx.fillText(emotion, scaledBox.x, scaledBox.y - 5);
    }
}

// Detect emotion and update UI
async function detectEmotion() {
    if (!checkFaceAPI()) {
        return;
    }
    if (video.readyState !== 4) {
        // Video not ready
        return;
    }
    
    try {
        // Detect face on the video element but draw on canvas
        const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
        if (detections && detections.expressions) {
            // Get the emotion with the highest probability
            const expressions = detections.expressions;
            const emotion = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
            emotionSpan.textContent = emotion;
            currentEmotion = emotion;
            
            // Draw face box with emotion label
            drawFaceBox(detections, emotion);
            
            // Only send to backend if emotion has changed and auto-refresh is enabled
            if (emotion !== 'surprised' && hasEmotionChanged(emotion) && autoRefreshEnabled && selectedGenre) {
                sendEmotionToBackend(emotion, selectedGenre);
                console.log('Emotion changed to:', emotion, '- updating playlist');
            }
        } else {
            emotionSpan.textContent = 'None';
            currentEmotion = 'None';
            // Clear canvas when no face detected
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    } catch (error) {
        console.error('Face detection error:', error);
    }
}

// Send detected emotion to backend and get playlist
async function sendEmotionToBackend(emotion, genre) {
    const res = await fetch('/get_playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotion, genre })
    });
    const data = await res.json();
    displayPlaylist(data.playlist);
    lastEmotionSent = emotion; // Track the last emotion sent
}

// Display playlist (Spotify embeds)
function displayPlaylist(playlist) {
    playlistDiv.innerHTML = '';
    if (playlist.length > 0) {
        const iframe = document.createElement('iframe');
        // Use Spotify embed URL with autoplay
        iframe.src = playlist[0];
        iframe.style.width = '100%';
        iframe.style.height = '352px';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '12px';
        iframe.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        iframe.allow = 'encrypted-media';
        
        // Add error handling for unavailable tracks
        iframe.onerror = () => {
            playlistDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">Track unavailable. Please try a different emotion or genre.</div>';
        };
        
        playlistDiv.appendChild(iframe);
        
        // Force autoplay by reloading the iframe after a short delay
        setTimeout(() => {
            iframe.src = iframe.src;
        }, 100);
    }
}

// Main logic
startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    try {
        await loadModels();
        await startVideo();
        // Position canvas after video starts
        setTimeout(positionCanvas, 100);
        // Detect emotion every 100ms for smooth face tracking
        setInterval(detectEmotion, 100);
        setupGenreButtons(); // Setup genre buttons after video starts
        setupControls(); // Setup user controls after video starts
    } catch (err) {
        cameraStatusMsg.textContent = 'Error: ' + err.message;
        console.error('Startup error:', err);
        startBtn.disabled = false;
    }
}); 