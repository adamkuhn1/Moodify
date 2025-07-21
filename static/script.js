const video = document.getElementById('video');
const startBtn = document.getElementById('start-btn');
const emotionSpan = document.getElementById('emotion');
const playlistDiv = document.getElementById('playlist');
const genreSpan = document.getElementById('genre');
const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
const manualRefreshBtn = document.getElementById('manual-refresh-btn');

let currentEmotion = 'neutral';
let selectedGenre = null;
let lastEmotionSent = null;
let emotionChangeCount = 0;
let autoRefreshEnabled = true;

// Camera status message element
let cameraStatusMsg = document.createElement('div');
cameraStatusMsg.id = 'camera-status';
cameraStatusMsg.style.color = 'red';
video.parentNode.insertBefore(cameraStatusMsg, video.nextSibling);

// Overlay canvas for face bounding box
const canvas = document.createElement('canvas');
canvas.id = 'face-canvas';
canvas.style.position = 'absolute';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.pointerEvents = 'none';
canvas.style.zIndex = '10';
video.parentNode.style.position = 'relative';
video.parentNode.appendChild(canvas);

function positionCanvas() {
    // Align canvas with video element
    const videoRect = video.getBoundingClientRect();
    const containerRect = video.parentNode.getBoundingClientRect();
    canvas.style.top = (videoRect.top - containerRect.top) + 'px';
    canvas.style.left = (videoRect.left - containerRect.left) + 'px';
    canvas.width = video.offsetWidth;
    canvas.height = video.offsetHeight;
}

function setupControls() {
    autoRefreshToggle.addEventListener('change', () => {
        autoRefreshEnabled = autoRefreshToggle.checked;
        console.log('Auto-refresh:', autoRefreshEnabled ? 'enabled' : 'disabled');
    });
    manualRefreshBtn.addEventListener('click', () => {
        if (currentEmotion !== 'None' && selectedGenre) {
            sendEmotionToBackend(currentEmotion, selectedGenre);
            console.log('Manual playlist refresh');
        } else {
            alert('Please select a genre and ensure emotion detection is active');
        }
    });
}

function hasEmotionChanged(newEmotion) {
    return lastEmotionSent !== newEmotion;
}

function setupGenreButtons() {
    const genreButtons = document.querySelectorAll('.genre-btn');
    genreButtons.forEach(button => {
        button.addEventListener('click', () => {
            genreButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedGenre = button.dataset.genre;
            genreSpan.textContent = selectedGenre;
            if (currentEmotion !== 'None' && autoRefreshEnabled) {
                sendEmotionToBackend(currentEmotion, selectedGenre);
            }
        });
    });
}

function checkFaceAPI() {
    if (typeof faceapi === 'undefined') {
        cameraStatusMsg.textContent = 'Error: face-api.js library not loaded. Please refresh the page.';
        console.error('face-api.js not loaded');
        return false;
    }
    return true;
}

// Load required face-api.js models
async function loadModels() {
    if (!checkFaceAPI()) {
        throw new Error('face-api.js not available');
    }
    await faceapi.nets.tinyFaceDetector.loadFromUri('/static/models');
    await faceapi.nets.faceExpressionNet.loadFromUri('/static/models');
    console.log("Models loaded");
}

async function startVideo() {
    cameraStatusMsg.textContent = '';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            positionCanvas();
            cameraStatusMsg.textContent = '';
            console.log("Webcam stream started");
        };
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

function drawFaceBox(detection, emotion) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (detection) {
        const box = detection.detection.box;
        // Scale bounding box to match display size
        const displayWidth = video.offsetWidth;
        const displayHeight = video.offsetHeight;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const scaleX = displayWidth / videoWidth;
        const scaleY = displayHeight / videoHeight;
        const scaledBox = {
            x: Math.round(box.x * scaleX),
            y: Math.round(box.y * scaleY),
            width: Math.round(box.width * scaleX),
            height: Math.round(box.height * scaleY)
        };
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(scaledBox.x, scaledBox.y, scaledBox.width, scaledBox.height);
        ctx.fillStyle = '#00ff00';
        ctx.font = '16px Arial';
        ctx.fillText(emotion, scaledBox.x, scaledBox.y - 5);
    }
}

async function detectEmotion() {
    if (!checkFaceAPI()) return;
    if (video.readyState !== 4) return;
    try {
        const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
        if (detections && detections.expressions) {
            // Pick the most likely emotion
            const expressions = detections.expressions;
            const emotion = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
            emotionSpan.textContent = emotion;
            currentEmotion = emotion;
            drawFaceBox(detections, emotion);
            // Only update playlist if emotion changed and auto-refresh is enabled
            if (emotion !== 'surprised' && hasEmotionChanged(emotion) && autoRefreshEnabled && selectedGenre) {
                sendEmotionToBackend(emotion, selectedGenre);
                console.log('Emotion changed to:', emotion, '- updating playlist');
            }
        } else {
            emotionSpan.textContent = 'None';
            currentEmotion = 'None';
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    } catch (error) {
        console.error('Face detection error:', error);
    }
}

async function sendEmotionToBackend(emotion, genre) {
    const res = await fetch('/get_playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotion, genre })
    });
    const data = await res.json();
    displayPlaylist(data.playlist);
    lastEmotionSent = emotion;
}

function displayPlaylist(playlist) {
    playlistDiv.innerHTML = '';
    if (playlist.length > 0) {
        const iframe = document.createElement('iframe');
        iframe.src = playlist[0];
        iframe.style.width = '100%';
        iframe.style.height = '352px';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '12px';
        iframe.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        iframe.allow = 'encrypted-media';
        iframe.onerror = () => {
            playlistDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">Track unavailable. Please try a different emotion or genre.</div>';
        };
        playlistDiv.appendChild(iframe);
        setTimeout(() => {
            iframe.src = iframe.src;
        }, 100);
    }
}

// App entry point
startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    try {
        await loadModels();
        await startVideo();
        setTimeout(positionCanvas, 100);
        setInterval(detectEmotion, 100);
        setupGenreButtons();
        setupControls();
    } catch (err) {
        cameraStatusMsg.textContent = 'Error: ' + err.message;
        console.error('Startup error:', err);
        startBtn.disabled = false;
    }
}); 