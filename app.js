/* =============================================
   SKETCH PHOTOBOOTH - Main Application
   ============================================= */

// Global State
let stream = null;
let photos = [];
let isCapturing = false;
let currentFilter = 'bw';
const PHOTOS_TO_CAPTURE = 4;
const COUNTDOWN_SECONDS = 3;

// Audio Context for shutter sound
let audioContext = null;

// DOM Elements
let webcam, stripCanvas, countdownOverlay, countdownNumber, flashOverlay, photoCounter, currentFilterDisplay;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    webcam = document.getElementById('webcam');
    stripCanvas = document.getElementById('strip-canvas');
    countdownOverlay = document.getElementById('countdown-overlay');
    countdownNumber = document.getElementById('countdown-number');
    flashOverlay = document.getElementById('flash-overlay');
    photoCounter = document.getElementById('photo-counter');
    currentFilterDisplay = document.getElementById('current-filter-display');
    
    // Initialize audio context on first user interaction
    document.addEventListener('click', initAudio, { once: true });
});

// Initialize Audio Context
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Audio not supported');
    }
}

// Play shutter sound
function playShutterSound() {
    if (!audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Camera shutter-like sound
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        console.log('Error playing sound:', e);
    }
}

// Play countdown beep
function playBeep() {
    if (!audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {
        console.log('Error playing beep:', e);
    }
}

// Page Navigation
function navigateTo(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    // Show target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

// Stop camera and go back
function stopAndGoBack() {
    // Stop camera stream
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Reset state
    isCapturing = false;
    photos = [];
    
    // Reset UI
    if (photoCounter) photoCounter.textContent = '0/4';
    if (countdownOverlay) countdownOverlay.classList.add('hidden');
    
    // Go back to select page
    navigateTo('select-page');
}

// Filter Selection
function selectFilter(filter) {
    currentFilter = filter;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`)?.classList.add('active');
    
    // Update webcam preview filter if camera is active
    updateWebcamFilter();
    
    // Update filter display
    const filterNames = {
        'bw': 'B&W',
        'color': 'Color',
        'retro': 'Retro',
        'polaroid': 'Polaroid',
        'vintage': 'Vintage',
        'noir': 'Noir'
    };
    if (currentFilterDisplay) {
        currentFilterDisplay.textContent = filterNames[filter] || filter;
    }
}

// Update webcam filter
function updateWebcamFilter() {
    if (!webcam) return;
    
    // Remove all filter classes
    webcam.classList.remove('filter-bw', 'filter-color', 'filter-retro', 'filter-polaroid', 'filter-vintage', 'filter-noir');
    
    // Add current filter class
    webcam.classList.add(`filter-${currentFilter}`);
}

// Start Camera
async function startCamera() {
    try {
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
        
        // Apply current filter
        updateWebcamFilter();
        
        // Update filter display
        const filterNames = {
            'bw': 'B&W',
            'color': 'Color',
            'retro': 'Retro',
            'polaroid': 'Polaroid',
            'vintage': 'Vintage',
            'noir': 'Noir'
        };
        if (currentFilterDisplay) {
            currentFilterDisplay.textContent = filterNames[currentFilter];
        }
        
        // Navigate to camera page
        navigateTo('camera-page');
        
    } catch (error) {
        console.error('Camera error:', error);
        alert('Could not access camera. Please allow camera permissions and try again.');
    }
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
    
    for (const file of filesToProcess) {
        const img = await loadImage(file);
        photos.push(img);
    }
    
    while (photos.length < 4) {
        photos.push(photos[photos.length - 1]);
    }
    
    generatePhotoStrip();
    navigateTo('result-page');
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
    if (captureBtn) captureBtn.disabled = true;
    if (photoCounter) photoCounter.textContent = '0/4';
    
    for (let i = 0; i < PHOTOS_TO_CAPTURE; i++) {
        if (!isCapturing) break;
        
        // Update counter
        if (photoCounter) photoCounter.textContent = `${i}/${PHOTOS_TO_CAPTURE}`;
        
        // Show countdown
        await showCountdown();
        
        if (!isCapturing) break;
        
        // Capture photo
        const photo = captureFrame();
        photos.push(photo);
        
        // Play shutter sound and flash
        playShutterSound();
        triggerFlash();
        
        // Update counter
        if (photoCounter) photoCounter.textContent = `${i + 1}/${PHOTOS_TO_CAPTURE}`;
        
        // Delay between photos
        if (i < PHOTOS_TO_CAPTURE - 1) {
            await delay(800);
        }
    }
    
    isCapturing = false;
    if (captureBtn) captureBtn.disabled = false;
    
    if (photos.length === PHOTOS_TO_CAPTURE) {
        // Show printing page
        navigateTo('printing-page');
        
        // Start print countdown animation
        await startPrintCountdown();
        
        // Generate strip
        generatePhotoStrip();
        
        // Show result
        navigateTo('result-page');
    }
}

// Countdown
async function showCountdown() {
    if (!countdownOverlay || !countdownNumber) return;
    
    countdownOverlay.classList.remove('hidden');
    
    for (let i = COUNTDOWN_SECONDS; i > 0; i--) {
        // Play beep sound
        playBeep();
        
        // Update number with animation
        countdownNumber.textContent = i;
        countdownNumber.style.animation = 'none';
        void countdownNumber.offsetWidth; // Force reflow
        countdownNumber.style.animation = 'countdownPop 0.9s ease-out';
        
        await delay(1000);
    }
    
    countdownOverlay.classList.add('hidden');
}

// Capture frame
function captureFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = webcam.videoWidth;
    canvas.height = webcam.videoHeight;
    
    const ctx = canvas.getContext('2d');
    
    // Mirror
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(webcam, 0, 0);
    
    return canvas;
}

// Flash effect
function triggerFlash() {
    if (!flashOverlay) return;
    
    flashOverlay.classList.add('active');
    setTimeout(() => {
        flashOverlay.classList.remove('active');
    }, 400);
}

// Print page countdown
async function startPrintCountdown() {
    const printCountdown = document.getElementById('print-countdown');
    if (!printCountdown) {
        await delay(3000);
        return;
    }
    
    for (let i = 3; i >= 1; i--) {
        printCountdown.textContent = i;
        printCountdown.style.animation = 'none';
        void printCountdown.offsetWidth;
        printCountdown.style.animation = 'countdownPop 0.9s ease-out';
        await delay(1000);
    }
    
    printCountdown.textContent = '0';
    await delay(500);
}

// Generate Photo Strip
function generatePhotoStrip() {
    if (!stripCanvas) return;
    
    const ctx = stripCanvas.getContext('2d');
    
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
    
    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, stripWidth - 3, stripHeight - 3);
    
    // Draw each photo
    photos.forEach((photo, index) => {
        const x = borderWidth;
        const y = borderWidth + (index * (photoHeight + gapBetween));
        
        // Photo frame
        ctx.fillStyle = '#000000';
        ctx.fillRect(x - 2, y - 2, photoWidth + 4, photoHeight + 4);
        
        // Photo
        drawPhoto(ctx, photo, x, y, photoWidth, photoHeight);
    });
}

function drawPhoto(ctx, source, x, y, width, height) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Calculate crop
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
    tempCtx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
    
    // Apply filter
    applyFilter(tempCtx, width, height, currentFilter);
    
    ctx.drawImage(tempCanvas, x, y);
}

function applyFilter(ctx, width, height, filter) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        
        switch (filter) {
            case 'bw':
                // Black & White with contrast
                const gray = r * 0.299 + g * 0.587 + b * 0.114;
                const adjusted = ((gray / 255 - 0.5) * 1.1 + 0.5) * 255;
                r = g = b = Math.max(0, Math.min(255, adjusted));
                break;
                
            case 'color':
                // No change
                break;
                
            case 'retro':
                // Warm sepia with saturation
                r = Math.min(255, r * 1.1 + 30);
                g = Math.min(255, g * 1.0 + 15);
                b = Math.min(255, b * 0.8);
                break;
                
            case 'polaroid':
                // Soft, slightly faded with warm tint
                r = Math.min(255, r * 1.05 + 15);
                g = Math.min(255, g * 1.02 + 10);
                b = Math.min(255, b * 0.95 + 5);
                // Reduce contrast slightly
                r = ((r / 255 - 0.5) * 0.9 + 0.5) * 255 + 10;
                g = ((g / 255 - 0.5) * 0.9 + 0.5) * 255 + 5;
                b = ((b / 255 - 0.5) * 0.9 + 0.5) * 255;
                break;
                
            case 'vintage':
                // Brown/sepia tones with fade
                const vintageGray = r * 0.3 + g * 0.59 + b * 0.11;
                r = Math.min(255, vintageGray * 1.2 + 40);
                g = Math.min(255, vintageGray * 1.0 + 20);
                b = Math.min(255, vintageGray * 0.8);
                break;
                
            case 'noir':
                // High contrast B&W
                const noirGray = r * 0.299 + g * 0.587 + b * 0.114;
                const noirAdjusted = ((noirGray / 255 - 0.5) * 1.5 + 0.5) * 255;
                r = g = b = Math.max(0, Math.min(255, noirAdjusted * 0.9));
                break;
        }
        
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// Download
function downloadStrip() {
    if (!stripCanvas) return;
    
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    link.download = `photostrip-${timestamp}.png`;
    link.href = stripCanvas.toDataURL('image/png', 1.0);
    link.click();
}

// Share
async function shareStrip() {
    if (!stripCanvas) return;
    
    if (navigator.share) {
        try {
            const blob = await new Promise(resolve => stripCanvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], 'photostrip.png', { type: 'image/png' });
            await navigator.share({ files: [file], title: 'My Photo Strip' });
        } catch (error) {
            downloadStrip();
        }
    } else {
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
    if (photoCounter) photoCounter.textContent = '0/4';
    currentFilter = 'bw';
    selectFilter('bw');
    navigateTo('landing-page');
}

// Utility
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});
