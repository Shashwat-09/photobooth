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

// Page Navigation - Define early so it's available for inline onclick
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

// Expose navigateTo globally immediately
window.navigateTo = navigateTo;

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
    
    // Calculate dimensions based on filter
    let stripWidth, stripHeight;
    let photoSpacing = photoHeight + gapBetween;
    
    if (currentFilter === 'polaroid') {
        const polaroidBorder = 20;
        const polaroidBottomBorder = 60;
        const polaroidWidth = photoWidth + (polaroidBorder * 2);
        const polaroidHeight = photoHeight + polaroidBorder + polaroidBottomBorder;
        stripWidth = polaroidWidth + (borderWidth * 2);
        stripHeight = (polaroidHeight * 4) + (borderWidth * 2) + (gapBetween * 3);
        photoSpacing = polaroidHeight + gapBetween;
    } else {
        stripWidth = photoWidth + (borderWidth * 2);
        stripHeight = (photoHeight * 4) + (borderWidth * 2) + (gapBetween * 3);
    }
    
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
        let x, y;
        
        if (currentFilter === 'polaroid') {
            const polaroidBorder = 20;
            const polaroidBottomBorder = 60;
            const polaroidWidth = photoWidth + (polaroidBorder * 2);
            const polaroidHeight = photoHeight + polaroidBorder + polaroidBottomBorder;
            
            x = borderWidth + polaroidBorder;
            y = borderWidth + polaroidBorder + (index * photoSpacing);
            
            // White Polaroid frame
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(borderWidth, borderWidth + (index * photoSpacing), polaroidWidth, polaroidHeight);
            
            // Black border around Polaroid
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(borderWidth, borderWidth + (index * photoSpacing), polaroidWidth, polaroidHeight);
            
            // Draw photo
            drawPhoto(ctx, photo, x, y, photoWidth, photoHeight);
        } else {
            x = borderWidth;
            y = borderWidth + (index * photoSpacing);
            
            // Regular photo frame
            ctx.fillStyle = '#000000';
            ctx.fillRect(x - 2, y - 2, photoWidth + 4, photoHeight + 4);
            
            // Photo
            drawPhoto(ctx, photo, x, y, photoWidth, photoHeight);
        }
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

// Add film grain
function addGrain(ctx, width, height, intensity = 0.15) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const grain = (Math.random() - 0.5) * intensity * 255;
        data[i] = Math.max(0, Math.min(255, data[i] + grain));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain));
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// Add scratches and dust (for vintage effect)
function addScratchesAndDust(ctx, width, height) {
    const numScratches = Math.floor(width * height / 8000);
    const numDust = Math.floor(width * height / 5000);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 0.5;
    
    // Add scratches
    for (let i = 0; i < numScratches; i++) {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const x2 = x1 + (Math.random() - 0.5) * 20;
        const y2 = y1 + (Math.random() - 0.5) * 20;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    
    // Add dark scratches
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    for (let i = 0; i < numScratches / 2; i++) {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const x2 = x1 + (Math.random() - 0.5) * 15;
        const y2 = y1 + (Math.random() - 0.5) * 15;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    
    // Add dust particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < numDust; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 1.5;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let i = 0; i < numDust / 2; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 1;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Add vignette effect
function addVignette(ctx, width, height, intensity = 0.4) {
    const gradient = ctx.createRadialGradient(
        width / 2, height / 2, height * 0.3,
        width / 2, height / 2, height * 0.8
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

// Add light leaks (for polaroid - VSCO M3 style)
function addLightLeaks(ctx, width, height) {
    // Top left corner warm yellow-orange light leak (VSCO M3 signature)
    const leak1 = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.45);
    leak1.addColorStop(0, 'rgba(255, 220, 140, 0.18)');  // Warm yellow-orange
    leak1.addColorStop(0.5, 'rgba(255, 200, 120, 0.08)');
    leak1.addColorStop(1, 'rgba(255, 200, 120, 0)');
    ctx.fillStyle = leak1;
    ctx.fillRect(0, 0, width * 0.55, height * 0.35);
    
    // Top right corner subtle warm light leak
    const leak2 = ctx.createRadialGradient(width, 0, 0, width, 0, width * 0.35);
    leak2.addColorStop(0, 'rgba(255, 210, 130, 0.12)');  // Warm yellow
    leak2.addColorStop(1, 'rgba(255, 210, 130, 0)');
    ctx.fillStyle = leak2;
    ctx.fillRect(width * 0.45, 0, width * 0.55, height * 0.28);
    
    // Bottom subtle warm glow
    const leak3 = ctx.createRadialGradient(width / 2, height, 0, width / 2, height, height * 0.4);
    leak3.addColorStop(0, 'rgba(255, 200, 110, 0.08)');
    leak3.addColorStop(1, 'rgba(255, 200, 110, 0)');
    ctx.fillStyle = leak3;
    ctx.fillRect(0, height * 0.6, width, height * 0.4);
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
                // Cool-toned retro with greenish-blue tint and desaturation
                // Desaturate first
                const retroGray = r * 0.3 + g * 0.59 + b * 0.11;
                // Apply cool greenish-blue tint
                r = retroGray * 0.85 + 20;  // Reduced red
                g = retroGray * 0.95 + 15;  // Slight green tint
                b = retroGray * 1.05 + 25;  // Increased blue
                // Add slight desaturation
                r = r * 0.7 + retroGray * 0.3;
                g = g * 0.7 + retroGray * 0.3;
                b = b * 0.7 + retroGray * 0.3;
                break;
                
            case 'polaroid':
                // VSCO M3 Polaroid Effect - Warm, faded, lifted shadows
                // Step 1: Lift shadows significantly (brighten dark areas)
                const shadowLift = 0.15;
                r = r + (255 - r) * shadowLift;
                g = g + (255 - g) * shadowLift;
                b = b + (255 - b) * shadowLift;
                
                // Step 2: Apply warm yellow-orange tone shift (VSCO M3 signature)
                r = Math.min(255, r * 1.12 + 25);  // Strong warm red/yellow
                g = Math.min(255, g * 1.08 + 18);  // Warm yellow
                b = Math.min(255, b * 0.88 - 5);   // Reduce blue for warmth
                
                // Step 3: Soft contrast curve (faded look)
                r = ((r / 255 - 0.5) * 0.75 + 0.5) * 255;
                g = ((g / 255 - 0.5) * 0.75 + 0.5) * 255;
                b = ((b / 255 - 0.5) * 0.75 + 0.5) * 255;
                
                // Step 4: Slight desaturation for faded aesthetic
                const gray = r * 0.299 + g * 0.587 + b * 0.114;
                r = r * 0.85 + gray * 0.15;
                g = g * 0.85 + gray * 0.15;
                b = b * 0.85 + gray * 0.15;
                
                // Step 5: Add slight brightness boost
                r = Math.min(255, r * 1.05);
                g = Math.min(255, g * 1.05);
                b = Math.min(255, b * 1.03);
                break;
                
            case 'vintage':
                // Heavy sepia/brown-grey with strong desaturation
                const vintageGray = r * 0.3 + g * 0.59 + b * 0.11;
                // Sepia brown tones
                r = Math.min(255, vintageGray * 1.3 + 35);
                g = Math.min(255, vintageGray * 1.1 + 20);
                b = Math.min(255, vintageGray * 0.85);
                // Darken slightly for aged look
                r *= 0.92;
                g *= 0.92;
                b *= 0.92;
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
    
    // Apply texture effects based on filter
    switch (filter) {
        case 'retro':
            // Heavy film grain for retro
            addGrain(ctx, width, height, 0.25);
            addVignette(ctx, width, height, 0.2);
            break;
            
        case 'polaroid':
            // VSCO M3 style - very subtle grain, soft light leaks, minimal vignette
            addGrain(ctx, width, height, 0.08);  // Very subtle grain
            addLightLeaks(ctx, width, height);  // Soft warm light leaks
            addVignette(ctx, width, height, 0.1);  // Minimal vignette for softness
            break;
            
        case 'vintage':
            // Heavy grain, scratches, dust, and vignette for vintage
            addGrain(ctx, width, height, 0.3);
            addScratchesAndDust(ctx, width, height);
            addVignette(ctx, width, height, 0.5);
            break;
            
        case 'noir':
            // Subtle grain for noir
            addGrain(ctx, width, height, 0.12);
            addVignette(ctx, width, height, 0.3);
            break;
    }
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

// Expose all functions globally for inline onclick handlers
window.navigateTo = navigateTo;
window.startCamera = startCamera;
window.triggerUpload = triggerUpload;
window.selectFilter = selectFilter;
window.stopAndGoBack = stopAndGoBack;
window.startCapture = startCapture;
window.downloadStrip = downloadStrip;
window.shareStrip = shareStrip;
window.restart = restart;

// Cleanup
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});
