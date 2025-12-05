/* =============================================
   SKETCH PHOTOBOOTH - Main Application
   ============================================= */

// Test that script is loading
console.log('Photobooth app.js loaded');

// Global State
let stream = null;
let photos = [];
let isCapturing = false;
let currentFilter = 'bw';
let filterIntensity = 1.0;
let filterGrain = 0.5;
const PHOTOS_TO_CAPTURE = 4;
const COUNTDOWN_SECONDS = 3;

// Filter templates with exact values
const FILTER_TEMPLATES = {
    vintage: {
        sepia: 0.35,
        contrast: 0.90,
        brightness: 0.95,
        saturate: 0.70,
        hueRotate: -4
    },
    retro: {
        contrast: 1.25,
        brightness: 0.90,
        saturate: 1.40,
        sepia: 0.18,
        hueRotate: 10
    },
    polaroid: {
        brightness: 1.10,
        contrast: 0.85,
        saturate: 0.90,
        sepia: 0.10,
        hueRotate: -6
    },
    fadedfilm: {
        brightness: 1.10,
        contrast: 0.80,
        saturate: 0.60,
        sepia: 0.20,
        hueRotate: 0
    }
};

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
    // Ensure landing page is visible on initial load
    const landingPage = document.getElementById('landing-page');
    if (landingPage) {
        landingPage.classList.add('active');
    }
    
    // Hide all other pages
    document.querySelectorAll('.page').forEach(page => {
        if (page.id !== 'landing-page') {
            page.classList.remove('active');
        }
    });
    
    webcam = document.getElementById('webcam');
    stripCanvas = document.getElementById('strip-canvas');
    countdownOverlay = document.getElementById('countdown-overlay');
    countdownNumber = document.getElementById('countdown-number');
    flashOverlay = document.getElementById('flash-overlay');
    photoCounter = document.getElementById('photo-counter');
    currentFilterDisplay = document.getElementById('current-filter-display');
    
    // Set up all button event listeners
    setupEventListeners();
    
    // Initialize audio context on first user interaction
    document.addEventListener('click', initAudio, { once: true });
    
    console.log('Photobooth initialized. Landing page should be visible.');
});

// Set up all event listeners for buttons (backup if onclick doesn't work)
function setupEventListeners() {
    console.log('Setting up event listeners...');
    console.log('navigateTo available:', typeof window.navigateTo);
    
    // Enter button - add event listener as backup
    const enterBtn = document.querySelector('.enter-btn');
    if (enterBtn) {
        console.log('Enter button found, adding event listener');
        // Remove existing onclick to avoid double execution
        enterBtn.removeAttribute('onclick');
        enterBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Enter button clicked via event listener');
            if (typeof navigateTo === 'function') {
                navigateTo('select-page');
            } else {
                console.error('navigateTo not available');
            }
        });
    } else {
        console.error('Enter button not found!');
    }
    
    // Footer links - About Me and Contact Me
    const footerLinks = document.querySelectorAll('.landing-footer a');
    footerLinks.forEach(link => {
        const onclick = link.getAttribute('onclick');
        if (onclick) {
            link.removeAttribute('onclick');
            if (onclick.includes('about-page')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    navigateTo('about-page');
                });
            } else if (onclick.includes('contact-page')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    navigateTo('contact-page');
                });
            }
        }
    });
    
    // Back buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if (onclick) {
            btn.removeAttribute('onclick');
            if (onclick.includes('landing-page')) {
                btn.addEventListener('click', () => navigateTo('landing-page'));
            } else if (onclick.includes('select-page')) {
                btn.addEventListener('click', () => navigateTo('select-page'));
            } else if (onclick.includes('stopAndGoBack')) {
                btn.addEventListener('click', stopAndGoBack);
            }
        }
    });
    
    // Mode buttons (take photo, upload photo)
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if (onclick) {
            btn.removeAttribute('onclick');
            if (onclick.includes('startCamera')) {
                btn.addEventListener('click', startCamera);
            } else if (onclick.includes('triggerUpload')) {
                btn.addEventListener('click', triggerUpload);
            }
        }
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const filter = btn.getAttribute('data-filter');
        const onclick = btn.getAttribute('onclick');
        if (onclick && filter) {
            btn.removeAttribute('onclick');
            btn.addEventListener('click', () => selectFilter(filter));
        }
    });
    
    // Filter intensity and grain sliders
    const intensitySlider = document.getElementById('intensitySlider');
    const grainSlider = document.getElementById('grainSlider');
    const intensityValue = document.getElementById('intensityValue');
    const grainValue = document.getElementById('grainValue');
    
    if (intensitySlider && intensityValue) {
        intensitySlider.addEventListener('input', (e) => {
            filterIntensity = parseFloat(e.target.value);
            intensityValue.textContent = filterIntensity.toFixed(2);
            updateWebcamFilter();
        });
    }
    
    if (grainSlider && grainValue) {
        grainSlider.addEventListener('input', (e) => {
            filterGrain = parseFloat(e.target.value);
            grainValue.textContent = filterGrain.toFixed(2);
            // Grain doesn't affect preview, only final capture
        });
    }
    
    // Capture button
    const captureBtn = document.getElementById('capture-button');
    if (captureBtn) {
        const onclick = captureBtn.getAttribute('onclick');
        if (onclick) {
            captureBtn.removeAttribute('onclick');
            captureBtn.addEventListener('click', startCapture);
        }
    }
    
    // Action buttons (download, share, restart)
    document.querySelectorAll('.action-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if (onclick) {
            btn.removeAttribute('onclick');
            if (onclick.includes('downloadStrip')) {
                btn.addEventListener('click', downloadStrip);
            } else if (onclick.includes('shareStrip')) {
                btn.addEventListener('click', shareStrip);
            } else if (onclick.includes('restart')) {
                btn.addEventListener('click', restart);
            }
        }
    });
    
    console.log('Event listeners set up complete');
}

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
window.stopAndGoBack = stopAndGoBack;

// Filter Selection
function selectFilter(filter) {
    currentFilter = filter;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`)?.classList.add('active');
    
    // Show/hide filter controls for advanced filters
    const filterControls = document.getElementById('filterControls');
    const advancedFilters = ['vintage', 'retro', 'polaroid', 'fadedfilm'];
    if (filterControls) {
        if (advancedFilters.includes(filter)) {
            filterControls.style.display = 'block';
        } else {
            filterControls.style.display = 'none';
        }
    }
    
    // Update webcam preview filter if camera is active
    updateWebcamFilter();
    
    // Update filter display
    const filterNames = {
        'bw': 'B&W',
        'color': 'Color',
        'vintage': 'Vintage',
        'retro': 'Retro',
        'polaroid': 'Polaroid',
        'fadedfilm': 'Faded Film'
    };
    if (currentFilterDisplay) {
        currentFilterDisplay.textContent = filterNames[filter] || filter;
    }
}
window.selectFilter = selectFilter;

// Convert filter template to CSS filter string
function cssFromTemplate(template, intensity) {
    const parts = [];
    
    if (template.sepia !== undefined) {
        parts.push(`sepia(${template.sepia * intensity})`);
    }
    if (template.contrast !== undefined) {
        parts.push(`contrast(${template.contrast * intensity + (1 - intensity)})`);
    }
    if (template.brightness !== undefined) {
        parts.push(`brightness(${template.brightness * intensity + (1 - intensity)})`);
    }
    if (template.saturate !== undefined) {
        parts.push(`saturate(${template.saturate * intensity + (1 - intensity)})`);
    }
    if (template.hueRotate !== undefined) {
        parts.push(`hue-rotate(${template.hueRotate * intensity}deg)`);
    }
    
    return parts.join(' ');
}

// Update webcam filter
function updateWebcamFilter() {
    if (!webcam) return;
    
    // Remove all filter classes
    webcam.classList.remove('filter-bw', 'filter-color', 'filter-vintage', 'filter-retro', 'filter-polaroid', 'filter-fadedfilm');
    
    // Apply filter based on type
    if (currentFilter === 'bw' || currentFilter === 'color') {
        webcam.classList.add(`filter-${currentFilter}`);
        webcam.style.filter = '';
    } else if (FILTER_TEMPLATES[currentFilter]) {
        // Use template-based filter for advanced filters
        const template = FILTER_TEMPLATES[currentFilter];
        const cssFilter = cssFromTemplate(template, filterIntensity);
        webcam.style.filter = cssFilter;
    } else {
        webcam.style.filter = '';
    }
}

// Start Camera - Maximum Quality Settings
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 3840, min: 1920 },  // 4K if available
                height: { ideal: 2160, min: 1080 }, // 4K if available
                facingMode: 'user',
                aspectRatio: { ideal: 16/9 },
                frameRate: { ideal: 30 },
                // Request highest quality
                advanced: [
                    { width: { ideal: 3840 } },
                    { height: { ideal: 2160 } },
                    { frameRate: { ideal: 30 } }
                ]
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
            'color': 'Color'
        };
        if (currentFilterDisplay) {
            currentFilterDisplay.textContent = filterNames[currentFilter] || 'Color';
        }
        
        // Navigate to camera page
        navigateTo('camera-page');
        
    } catch (error) {
        console.error('Camera error:', error);
        alert('Could not access camera. Please allow camera permissions and try again.');
    }
}
window.startCamera = startCamera;

// Handle photo upload
function triggerUpload() {
    document.getElementById('photo-upload').click();
}
window.triggerUpload = triggerUpload;

async function handleUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    photos = [];
    const filesToProcess = files.slice(0, 4);
    
    // Load images with error handling
    for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        try {
            const img = await loadImage(file);
            photos.push(img);
        } catch (error) {
            console.error(`Error loading image ${i + 1}:`, error);
            // Show user-friendly error message
            alert(`Error loading image "${file.name}": ${error.message}\n\nPlease try a different image file.`);
            // Use a placeholder or skip this image
            // For now, we'll skip it and continue with remaining images
            continue;
        }
    }
    
    // If no images loaded successfully, show error and return
    if (photos.length === 0) {
        alert('No images could be loaded. Please try uploading valid image files (JPG, PNG, GIF, or WebP).');
        return;
    }
    
    // Fill remaining slots with duplicates of the last successfully loaded image
    while (photos.length < 4) {
        photos.push(photos[photos.length - 1]);
    }
    
    generatePhotoStrip();
    navigateTo('result-page');
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            reject(new Error('File is not an image'));
            return;
        }
        
        const img = new Image();
        let objectUrl = null;
        let timeoutId = null;
        
        // Cleanup function
        const cleanup = () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
                objectUrl = null;
            }
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };
        
        // Success handler
        img.onload = () => {
            cleanup();
            resolve(img);
        };
        
        // Error handler
        img.onerror = () => {
            cleanup();
            reject(new Error('Failed to load image. The file may be corrupted or unsupported.'));
        };
        
        // Timeout safety (10 seconds)
        timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('Image loading timed out. The file may be too large or corrupted.'));
        }, 10000);
        
        // Create object URL and start loading
        try {
            objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;
        } catch (error) {
            cleanup();
            reject(new Error('Failed to create image from file: ' + error.message));
        }
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
window.startCapture = startCapture;

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
    
    // Calculate dimensions
    const stripWidth = photoWidth + (borderWidth * 2);
    const stripHeight = (photoHeight * 4) + (borderWidth * 2) + (gapBetween * 3);
    const photoSpacing = photoHeight + gapBetween;
    
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
        const y = borderWidth + (index * photoSpacing);
        
        // Regular photo frame
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
            case 'bw': {
                // Black & White with contrast
                const gray = r * 0.299 + g * 0.587 + b * 0.114;
                const adjusted = ((gray / 255 - 0.5) * 1.1 + 0.5) * 255;
                r = g = b = Math.max(0, Math.min(255, adjusted));
                break;
            }
                
            case 'color':
                // No change - keep original colors
                break;
                
            case 'vintage':
            case 'retro':
            case 'polaroid':
            case 'fadedfilm': {
                // Use template-based filter processing
                const template = FILTER_TEMPLATES[filter];
                if (!template) break;
                
                // Apply sepia
                if (template.sepia !== undefined) {
                    const sepiaAmount = template.sepia * filterIntensity;
                    const gray = r * 0.299 + g * 0.587 + b * 0.114;
                    r = Math.min(255, gray * (1 - sepiaAmount * 0.5) + (gray * 1.2 + 20) * sepiaAmount);
                    g = Math.min(255, gray * (1 - sepiaAmount * 0.5) + (gray * 1.0 + 10) * sepiaAmount);
                    b = Math.min(255, gray * (1 - sepiaAmount * 0.5) + (gray * 0.8) * sepiaAmount);
                }
                
                // Apply brightness
                if (template.brightness !== undefined) {
                    const brightness = template.brightness * filterIntensity + (1 - filterIntensity);
                    r = Math.min(255, r * brightness);
                    g = Math.min(255, g * brightness);
                    b = Math.min(255, b * brightness);
                }
                
                // Apply contrast
                if (template.contrast !== undefined) {
                    const contrast = template.contrast * filterIntensity + (1 - filterIntensity);
                    r = Math.max(0, Math.min(255, ((r / 255 - 0.5) * contrast + 0.5) * 255));
                    g = Math.max(0, Math.min(255, ((g / 255 - 0.5) * contrast + 0.5) * 255));
                    b = Math.max(0, Math.min(255, ((b / 255 - 0.5) * contrast + 0.5) * 255));
                }
                
                // Apply saturation
                if (template.saturate !== undefined) {
                    const saturate = template.saturate * filterIntensity + (1 - filterIntensity);
                    const gray = r * 0.299 + g * 0.587 + b * 0.114;
                    r = Math.max(0, Math.min(255, gray + (r - gray) * saturate));
                    g = Math.max(0, Math.min(255, gray + (g - gray) * saturate));
                    b = Math.max(0, Math.min(255, gray + (b - gray) * saturate));
                }
                
                // Apply hue rotation (simplified)
                if (template.hueRotate !== undefined) {
                    const hueRotate = template.hueRotate * filterIntensity;
                    // Simplified hue rotation approximation
                    const cos = Math.cos(hueRotate * Math.PI / 180);
                    const sin = Math.sin(hueRotate * Math.PI / 180);
                    const newR = r * (0.299 + 0.701 * cos + 0.168 * sin) + g * (0.587 - 0.587 * cos + 0.330 * sin) + b * (0.114 - 0.114 * cos - 0.497 * sin);
                    const newG = r * (0.299 - 0.299 * cos - 0.328 * sin) + g * (0.587 + 0.413 * cos + 0.035 * sin) + b * (0.114 - 0.114 * cos + 0.292 * sin);
                    const newB = r * (0.299 - 0.299 * cos + 1.25 * sin) + g * (0.587 - 0.587 * cos - 1.05 * sin) + b * (0.114 + 0.886 * cos - 0.203 * sin);
                    r = Math.max(0, Math.min(255, newR));
                    g = Math.max(0, Math.min(255, newG));
                    b = Math.max(0, Math.min(255, newB));
                }
                break;
            }
        }
        
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Apply texture effects based on filter
    if (filter === 'bw') {
        // Subtle grain for B&W
        addGrain(ctx, width, height, 0.08);
        addVignette(ctx, width, height, 0.15);
    } else if (filter === 'vintage') {
        // Heavy grain, scratches, dust, and vignette for vintage
        addGrain(ctx, width, height, 0.3 * filterGrain);
        addScratchesAndDust(ctx, width, height);
        addVignette(ctx, width, height, 0.5 * filterIntensity);
    } else if (filter === 'retro') {
        // Heavy film grain for retro
        addGrain(ctx, width, height, 0.25 * filterGrain);
        addVignette(ctx, width, height, 0.2 * filterIntensity);
    } else if (filter === 'polaroid') {
        // VSCO M3 style - very subtle grain, soft light leaks, minimal vignette
        addGrain(ctx, width, height, 0.08 * filterGrain);
        addLightLeaks(ctx, width, height);
        addVignette(ctx, width, height, 0.1 * filterIntensity);
    } else if (filter === 'fadedfilm') {
        // Low contrast faded film look
        addGrain(ctx, width, height, 0.2 * filterGrain);
        addVignette(ctx, width, height, 0.3 * filterIntensity);
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
window.downloadStrip = downloadStrip;

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
window.shareStrip = shareStrip;

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
window.restart = restart;

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
