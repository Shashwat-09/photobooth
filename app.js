/* =============================================
   SKETCH PHOTOBOOTH - Main Application
   ============================================= */

// Global State
let stream = null;
let photos = [];
let isCapturing = false;
let isColorMode = false;
const PHOTOS_TO_CAPTURE = 4;
const COUNTDOWN_SECONDS = 3;

// DOM Elements (will be initialized on page load)
let webcam, stripCanvas, countdownOverlay, countdownNumber, flashOverlay, photoCounter;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    webcam = document.getElementById('webcam');
    stripCanvas = document.getElementById('strip-canvas');
    countdownOverlay = document.getElementById('countdown-overlay');
    countdownNumber = document.getElementById('countdown-number');
    flashOverlay = document.getElementById('flash-overlay');
    photoCounter = document.getElementById('photo-counter');
    
    // Sync color toggle between pages
    const colorToggle = document.getElementById('color-toggle');
    const colorToggleCamera = document.getElementById('color-toggle-camera');
    
    if (colorToggle) {
        colorToggle.addEventListener('change', (e) => {
            isColorMode = e.target.checked;
            if (colorToggleCamera) colorToggleCamera.checked = isColorMode;
            updateWebcamFilter();
        });
    }
});

// Page Navigation
function goToPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// Start Camera
async function startCamera(mode) {
    try {
        // Request high quality camera
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
                facingMode: 'user'
            },
            audio: false
        });
        
        webcam.srcObject = stream;
        await webcam.play();
        
        // Update indicator lights
        const indicator = document.getElementById('indicator-light');
        const startBtn = document.getElementById('start-button');
        const startLabel = document.getElementById('start-label');
        
        if (indicator) {
            indicator.classList.add('green');
        }
        if (startBtn) {
            startBtn.disabled = false;
        }
        if (startLabel) {
            startLabel.textContent = 'start';
        }
        
        // Update webcam filter based on color mode
        updateWebcamFilter();
        
        // Navigate to camera page
        goToPage('camera-page');
        
    } catch (error) {
        console.error('Camera error:', error);
        alert('Could not access camera. Please allow camera permissions and try again.');
    }
}

// Update webcam filter (B&W or Color)
function updateWebcamFilter() {
    if (webcam) {
        if (isColorMode) {
            webcam.classList.remove('bw-filter');
        } else {
            webcam.classList.add('bw-filter');
        }
    }
}

// Sync color toggle between pages
function syncColorToggle(checkbox) {
    isColorMode = checkbox.checked;
    const colorToggle = document.getElementById('color-toggle');
    if (colorToggle) colorToggle.checked = isColorMode;
    updateWebcamFilter();
}

// Handle photo upload
function triggerUpload() {
    document.getElementById('photo-upload').click();
}

async function handleUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    photos = [];
    const filesToProcess = files.slice(0, 4);
    
    // Load images
    for (const file of filesToProcess) {
        const img = await loadImage(file);
        photos.push(img);
    }
    
    // Fill remaining with duplicates if less than 4
    while (photos.length < 4) {
        photos.push(photos[photos.length - 1]);
    }
    
    // Generate strip and show result
    generatePhotoStrip();
    goToPage('result-page');
}

function loadImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = URL.createObjectURL(file);
    });
}

// Start Photo Capture Sequence
async function startCapture() {
    if (isCapturing) return;
    
    isCapturing = true;
    photos = [];
    
    const captureBtn = document.getElementById('capture-button');
    captureBtn.disabled = true;
    
    for (let i = 0; i < PHOTOS_TO_CAPTURE; i++) {
        // Update counter
        photoCounter.textContent = `${i}/${PHOTOS_TO_CAPTURE}`;
        
        // Show countdown
        await showCountdown();
        
        // Capture photo
        const photo = captureFrame();
        photos.push(photo);
        
        // Flash effect
        triggerFlash();
        
        // Update counter after capture
        photoCounter.textContent = `${i + 1}/${PHOTOS_TO_CAPTURE}`;
        
        // Delay between photos
        if (i < PHOTOS_TO_CAPTURE - 1) {
            await delay(800);
        }
    }
    
    isCapturing = false;
    captureBtn.disabled = false;
    
    // Show printing page
    goToPage('printing-page');
    
    // Generate strip while showing printing animation
    await delay(500);
    generatePhotoStrip();
    
    // Wait and show result
    await delay(2500);
    goToPage('result-page');
}

// Countdown
async function showCountdown() {
    countdownOverlay.classList.remove('hidden');
    
    for (let i = COUNTDOWN_SECONDS; i > 0; i--) {
        countdownNumber.textContent = i;
        countdownNumber.style.animation = 'none';
        countdownNumber.offsetHeight; // Trigger reflow
        countdownNumber.style.animation = 'pulse 1s ease-out';
        await delay(1000);
    }
    
    countdownOverlay.classList.add('hidden');
}

// Capture frame from webcam
function captureFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = webcam.videoWidth;
    canvas.height = webcam.videoHeight;
    
    const ctx = canvas.getContext('2d');
    
    // Mirror the image
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(webcam, 0, 0);
    
    return canvas;
}

// Flash effect
function triggerFlash() {
    flashOverlay.classList.add('active');
    setTimeout(() => {
        flashOverlay.classList.remove('active');
    }, 300);
}

// Generate Photo Strip
function generatePhotoStrip() {
    const ctx = stripCanvas.getContext('2d');
    
    // Strip dimensions (classic photo booth strip)
    const photoWidth = 300;
    const photoHeight = 225;
    const borderWidth = 15;
    const gapBetween = 5;
    
    const stripWidth = photoWidth + (borderWidth * 2);
    const stripHeight = (photoHeight * 4) + (borderWidth * 2) + (gapBetween * 3);
    
    stripCanvas.width = stripWidth;
    stripCanvas.height = stripHeight;
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, stripWidth, stripHeight);
    
    // Draw border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, stripWidth - 3, stripHeight - 3);
    
    // Draw each photo
    photos.forEach((photo, index) => {
        const x = borderWidth;
        const y = borderWidth + (index * (photoHeight + gapBetween));
        
        // Draw photo frame
        ctx.fillStyle = '#000000';
        ctx.fillRect(x - 2, y - 2, photoWidth + 4, photoHeight + 4);
        
        // Draw photo
        drawPhoto(ctx, photo, x, y, photoWidth, photoHeight);
    });
}

function drawPhoto(ctx, source, x, y, width, height) {
    // Create temp canvas for processing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Calculate crop for center-fitted image
    const sourceWidth = source.width || source.videoWidth;
    const sourceHeight = source.height || source.videoHeight;
    
    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = width / height;
    
    let cropX = 0, cropY = 0, cropWidth = sourceWidth, cropHeight = sourceHeight;
    
    if (sourceAspect > targetAspect) {
        cropWidth = sourceHeight * targetAspect;
        cropX = (sourceWidth - cropWidth) / 2;
    } else {
        cropHeight = sourceWidth / targetAspect;
        cropY = (sourceHeight - cropHeight) / 2;
    }
    
    // Draw cropped image
    tempCtx.drawImage(
        source,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, width, height
    );
    
    // Apply B&W if needed
    if (!isColorMode) {
        applyBWFilter(tempCtx, width, height);
    }
    
    // Draw to main canvas
    ctx.drawImage(tempCanvas, x, y);
}

function applyBWFilter(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        // Luminance formula
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        
        // Slight contrast boost for B&W
        const adjusted = ((gray / 255 - 0.5) * 1.1 + 0.5) * 255;
        const final = Math.max(0, Math.min(255, adjusted));
        
        data[i] = final;
        data[i + 1] = final;
        data[i + 2] = final;
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// Download strip
function downloadStrip() {
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    link.download = `photostrip-${timestamp}.png`;
    link.href = stripCanvas.toDataURL('image/png', 1.0);
    link.click();
}

// Share strip
async function shareStrip() {
    if (navigator.share) {
        try {
            const blob = await new Promise(resolve => stripCanvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], 'photostrip.png', { type: 'image/png' });
            
            await navigator.share({
                files: [file],
                title: 'My Photo Strip',
                text: 'Check out my photo strip!'
            });
        } catch (error) {
            console.log('Share failed:', error);
            // Fallback to download
            downloadStrip();
        }
    } else {
        // Fallback to download
        downloadStrip();
    }
}

// Restart
function restart() {
    photos = [];
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    photoCounter.textContent = '0/4';
    goToPage('landing-page');
}

// Utility
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});
