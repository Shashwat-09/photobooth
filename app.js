/* =============================================
   SKETCH PHOTOBOOTH - Main Application
   ============================================= */

'use strict';

// ---------------------------------------------
// Constants & Filter Definitions
// ---------------------------------------------
const PHOTOS_TO_CAPTURE = 4;
const COUNTDOWN_SECONDS = 3;

// Strip rendering resolution (downscaled by CSS for display,
// full size is used for the downloaded PNG)
const PHOTO_W = 480;
const PHOTO_H = 360;
const STRIP_BORDER = 36;
const STRIP_GAP = 18;
const STRIP_FOOTER = 96;

const FILTER_NAMES = {
    bw: 'B&W',
    color: 'Color',
    vintage: 'Vintage',
    retro: 'Retro',
    polaroid: 'Polaroid',
    fadedfilm: 'Faded Film'
};

const ADVANCED_FILTERS = ['vintage', 'retro', 'polaroid', 'fadedfilm'];

const FILTER_TEMPLATES = {
    vintage: { sepia: 0.35, contrast: 0.90, brightness: 0.95, saturate: 0.70, hueRotate: -4 },
    retro: { sepia: 0.18, contrast: 1.25, brightness: 0.90, saturate: 1.40, hueRotate: 10 },
    polaroid: { sepia: 0.10, contrast: 0.85, brightness: 1.10, saturate: 0.90, hueRotate: -6 },
    fadedfilm: { sepia: 0.20, contrast: 0.80, brightness: 1.10, saturate: 0.60, hueRotate: 0 }
};

const COUNTDOWN_WORDS = ['get ready!', 'smile!', 'pose!', 'hold it!'];

// Whether the 2D canvas supports the CSS `filter` property. When it does,
// the exact same filter string used on the live preview is applied at
// capture time, so the strip matches what the user saw.
const CTX_FILTER_SUPPORTED = (() => {
    try {
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.filter = 'grayscale(1)';
        return ctx.filter === 'grayscale(1)';
    } catch (e) {
        return false;
    }
})();

// ---------------------------------------------
// State
// ---------------------------------------------
let stream = null;
let photos = [];
let isCapturing = false;
let isNavigating = false;
let currentFilter = 'bw';
let filterIntensity = 1.0;
let filterGrain = 0.5;
let audioContext = null;

// DOM elements (assigned on DOMContentLoaded)
let webcam, stripCanvas, countdownOverlay, countdownNumber, countdownWord,
    flashOverlay, photoCounter, currentFilterDisplay, cameraFrame;

const $ = (id) => document.getElementById(id);
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------
// Page Navigation (seamless 3D transitions)
// ---------------------------------------------
function navigateTo(pageId) {
    const target = $(pageId);
    const current = document.querySelector('.page.active');
    if (!target || target === current || isNavigating) return;

    if (!current || prefersReducedMotion()) {
        if (current) current.classList.remove('active');
        target.classList.add('active');
        return;
    }

    isNavigating = true;
    current.classList.add('page-exit');
    setTimeout(() => {
        current.classList.remove('active', 'page-exit');
        target.classList.add('active');
        isNavigating = false;
    }, 320);
}
window.navigateTo = navigateTo;

// ---------------------------------------------
// Initialization
// ---------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    webcam = $('webcam');
    stripCanvas = $('strip-canvas');
    countdownOverlay = $('countdown-overlay');
    countdownNumber = $('countdown-number');
    countdownWord = $('countdown-word');
    flashOverlay = $('flash-overlay');
    photoCounter = $('photo-counter');
    currentFilterDisplay = $('current-filter-display');
    cameraFrame = $('camera-frame');

    setupEventListeners();
    setupTilt();
    selectFilter(currentFilter);

    document.addEventListener('click', initAudio, { once: true });
});

function setupEventListeners() {
    // Navigation buttons/links
    document.querySelectorAll('[data-nav]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(el.dataset.nav);
        });
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => selectFilter(btn.dataset.filter));
    });

    // Mode buttons
    $('btn-take-photo').addEventListener('click', startCamera);
    $('btn-upload-photo').addEventListener('click', () => $('photo-upload').click());
    $('photo-upload').addEventListener('change', handleUpload);

    // Camera page
    $('btn-camera-back').addEventListener('click', stopAndGoBack);
    $('capture-button').addEventListener('click', startCapture);

    // Result actions
    $('btn-download').addEventListener('click', downloadStrip);
    $('btn-share').addEventListener('click', shareStrip);
    $('btn-print').addEventListener('click', () => window.print());
    $('btn-restart').addEventListener('click', restart);

    // Filter sliders
    const intensitySlider = $('intensitySlider');
    const grainSlider = $('grainSlider');
    intensitySlider.addEventListener('input', (e) => {
        filterIntensity = parseFloat(e.target.value);
        $('intensityValue').textContent = filterIntensity.toFixed(2);
        updateWebcamFilter();
    });
    grainSlider.addEventListener('input', (e) => {
        filterGrain = parseFloat(e.target.value);
        $('grainValue').textContent = filterGrain.toFixed(2);
    });
}

// ---------------------------------------------
// 3D Tilt (pointer parallax)
// ---------------------------------------------
function setupTilt() {
    if (prefersReducedMotion()) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    document.querySelectorAll('[data-tilt]').forEach(el => {
        el.addEventListener('pointermove', (e) => {
            const rect = el.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / rect.width - 0.5;
            const ny = (e.clientY - rect.top) / rect.height - 0.5;
            el.style.setProperty('--tilt-x', (nx * 7).toFixed(2) + 'deg');
            el.style.setProperty('--tilt-y', (-ny * 7).toFixed(2) + 'deg');
        });
        el.addEventListener('pointerleave', () => {
            el.style.setProperty('--tilt-x', '0deg');
            el.style.setProperty('--tilt-y', '0deg');
        });
    });
}

// ---------------------------------------------
// Audio (Web Audio API - shutter & beep)
// ---------------------------------------------
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Audio not supported');
    }
}

function playShutterSound() {
    if (!audioContext) return;
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) { /* ignore */ }
}

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
    } catch (e) { /* ignore */ }
}

// ---------------------------------------------
// Filters
// ---------------------------------------------
function selectFilter(filter) {
    if (!FILTER_NAMES[filter]) return;
    currentFilter = filter;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    const filterControls = $('filterControls');
    if (filterControls) {
        filterControls.classList.toggle('visible', ADVANCED_FILTERS.includes(filter));
    }

    if (currentFilterDisplay) {
        currentFilterDisplay.textContent = FILTER_NAMES[filter];
    }

    updateWebcamFilter();
}
window.selectFilter = selectFilter;

// Build the CSS filter string. Intensity blends each parameter toward its
// neutral value so 0 = original image, 1 = full effect.
function getFilterCSS(filter = currentFilter, intensity = filterIntensity) {
    if (filter === 'bw') return 'grayscale(1) contrast(1.1)';
    if (filter === 'color') return 'none';

    const t = FILTER_TEMPLATES[filter];
    if (!t) return 'none';

    const blend = (value) => value * intensity + (1 - intensity);
    const parts = [
        `sepia(${(t.sepia * intensity).toFixed(3)})`,
        `contrast(${blend(t.contrast).toFixed(3)})`,
        `brightness(${blend(t.brightness).toFixed(3)})`,
        `saturate(${blend(t.saturate).toFixed(3)})`,
        `hue-rotate(${(t.hueRotate * intensity).toFixed(1)}deg)`
    ];
    return parts.join(' ');
}

function updateWebcamFilter() {
    if (!webcam) return;
    const css = getFilterCSS();
    webcam.style.filter = css === 'none' ? '' : css;
}

// ---------------------------------------------
// Camera
// ---------------------------------------------
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'user',
                aspectRatio: { ideal: 4 / 3 },
                frameRate: { ideal: 30 }
            },
            audio: false
        });

        webcam.srcObject = stream;
        await webcam.play();

        updateWebcamFilter();
        if (currentFilterDisplay) {
            currentFilterDisplay.textContent = FILTER_NAMES[currentFilter];
        }
        if (photoCounter) photoCounter.textContent = `0/${PHOTOS_TO_CAPTURE}`;

        navigateTo('camera-page');
    } catch (error) {
        console.error('Camera error:', error);
        alert('Could not access camera. Please allow camera permissions and try again.');
    }
}
window.startCamera = startCamera;

function stopStream() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

function stopAndGoBack() {
    stopStream();
    isCapturing = false;
    photos = [];
    if (photoCounter) photoCounter.textContent = `0/${PHOTOS_TO_CAPTURE}`;
    if (countdownOverlay) countdownOverlay.classList.add('hidden');
    navigateTo('select-page');
}
window.stopAndGoBack = stopAndGoBack;

// ---------------------------------------------
// Upload flow
// ---------------------------------------------
async function handleUpload(event) {
    const files = Array.from(event.target.files);
    event.target.value = ''; // allow re-selecting the same files
    if (files.length === 0) return;

    photos = [];
    for (const file of files.slice(0, PHOTOS_TO_CAPTURE)) {
        try {
            photos.push(await loadImage(file));
        } catch (error) {
            console.error('Error loading image:', error);
            alert(`Error loading image "${file.name}": ${error.message}\n\nPlease try a different image file.`);
        }
    }

    if (photos.length === 0) {
        alert('No images could be loaded. Please try uploading valid image files (JPG, PNG, GIF, or WebP).');
        return;
    }

    // Fill remaining slots with duplicates of the last loaded image
    while (photos.length < PHOTOS_TO_CAPTURE) {
        photos.push(photos[photos.length - 1]);
    }

    await finishAndPrint();
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('File is not an image'));
            return;
        }

        const img = new Image();
        let objectUrl = null;
        let timeoutId = null;

        const cleanup = () => {
            if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
            if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        };

        img.onload = () => { cleanup(); resolve(img); };
        img.onerror = () => {
            cleanup();
            reject(new Error('Failed to load image. The file may be corrupted or unsupported.'));
        };
        timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('Image loading timed out. The file may be too large or corrupted.'));
        }, 10000);

        try {
            objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;
        } catch (error) {
            cleanup();
            reject(new Error('Failed to create image from file: ' + error.message));
        }
    });
}

// ---------------------------------------------
// Capture sequence
// ---------------------------------------------
async function startCapture() {
    if (isCapturing || !stream) return;

    isCapturing = true;
    photos = [];

    const captureBtn = $('capture-button');
    if (captureBtn) captureBtn.disabled = true;
    if (photoCounter) photoCounter.textContent = `0/${PHOTOS_TO_CAPTURE}`;

    for (let i = 0; i < PHOTOS_TO_CAPTURE; i++) {
        if (!isCapturing) break;

        await showCountdown(i);
        if (!isCapturing) break;

        photos.push(captureFrame());
        playShutterSound();
        triggerFlash();

        if (photoCounter) photoCounter.textContent = `${i + 1}/${PHOTOS_TO_CAPTURE}`;

        if (i < PHOTOS_TO_CAPTURE - 1) {
            await delay(800);
        }
    }

    const completed = isCapturing && photos.length === PHOTOS_TO_CAPTURE;
    isCapturing = false;
    if (captureBtn) captureBtn.disabled = false;

    if (completed) {
        stopStream();
        await finishAndPrint();
    }
}
window.startCapture = startCapture;

// Shared "printing..." sequence for both camera and upload flows
async function finishAndPrint() {
    navigateTo('printing-page');
    await startPrintCountdown();
    generatePhotoStrip();
    navigateTo('result-page');
}

async function showCountdown(shotIndex) {
    if (!countdownOverlay || !countdownNumber) return;

    countdownOverlay.classList.remove('hidden');
    if (countdownWord) {
        countdownWord.textContent = COUNTDOWN_WORDS[shotIndex % COUNTDOWN_WORDS.length];
    }

    for (let i = COUNTDOWN_SECONDS; i > 0; i--) {
        playBeep();
        countdownNumber.textContent = i;
        countdownNumber.style.animation = 'none';
        void countdownNumber.offsetWidth; // force reflow to restart animation
        countdownNumber.style.animation = 'countdownPop 0.9s ease-out';
        await delay(1000);
    }

    countdownOverlay.classList.add('hidden');
}

function captureFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = webcam.videoWidth || 640;
    canvas.height = webcam.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    // Mirror to match the on-screen preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(webcam, 0, 0);

    return canvas;
}

function triggerFlash() {
    if (flashOverlay) {
        flashOverlay.classList.add('active');
        setTimeout(() => flashOverlay.classList.remove('active'), 400);
    }
    if (cameraFrame && !prefersReducedMotion()) {
        cameraFrame.classList.add('shake');
        setTimeout(() => cameraFrame.classList.remove('shake'), 450);
    }
}

async function startPrintCountdown() {
    const printCountdown = $('print-countdown');
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
    await delay(600);
}

// ---------------------------------------------
// Photo strip generation
// ---------------------------------------------
function generatePhotoStrip() {
    if (!stripCanvas) return;

    const stripWidth = PHOTO_W + STRIP_BORDER * 2;
    const stripHeight = STRIP_BORDER + (PHOTO_H * PHOTOS_TO_CAPTURE)
        + (STRIP_GAP * (PHOTOS_TO_CAPTURE - 1)) + STRIP_FOOTER;

    stripCanvas.width = stripWidth;
    stripCanvas.height = stripHeight;

    const ctx = stripCanvas.getContext('2d');

    // Paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, stripWidth, stripHeight);

    // Outer border
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, stripWidth - 4, stripHeight - 4);

    // Photos
    photos.forEach((photo, index) => {
        const x = STRIP_BORDER;
        const y = STRIP_BORDER + index * (PHOTO_H + STRIP_GAP);

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x - 3, y - 3, PHOTO_W + 6, PHOTO_H + 6);

        drawPhoto(ctx, photo, x, y, PHOTO_W, PHOTO_H);
    });

    // Footer
    const footerY = STRIP_BORDER + PHOTO_H * PHOTOS_TO_CAPTURE
        + STRIP_GAP * (PHOTOS_TO_CAPTURE - 1);

    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.font = '28px "Architects Daughter", cursive';
    ctx.fillText('P H O T O B O O T H', stripWidth / 2, footerY + 44);

    const dateStr = new Date().toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
    });
    ctx.font = '24px "Caveat", cursive';
    ctx.fillStyle = '#666666';
    ctx.fillText(dateStr, stripWidth / 2, footerY + 74);
}

function drawPhoto(ctx, source, x, y, width, height) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    const sourceWidth = source.width || source.videoWidth;
    const sourceHeight = source.height || source.videoHeight;

    // Center-crop to target aspect ratio
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

    const filterCSS = getFilterCSS();
    if (CTX_FILTER_SUPPORTED) {
        // Same filter string as the live preview -> WYSIWYG output
        tempCtx.filter = filterCSS;
        tempCtx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
        tempCtx.filter = 'none';
    } else {
        tempCtx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
        applyFilterPixels(tempCtx, width, height, currentFilter);
    }

    applyTextureEffects(tempCtx, width, height, currentFilter);

    ctx.drawImage(tempCanvas, x, y);
}

// ---------------------------------------------
// Pixel-level filter fallback (browsers without ctx.filter)
// ---------------------------------------------
function applyFilterPixels(ctx, width, height, filter) {
    if (filter === 'color') return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const template = FILTER_TEMPLATES[filter];
    const blend = (value) => value * filterIntensity + (1 - filterIntensity);

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];

        if (filter === 'bw') {
            const gray = r * 0.299 + g * 0.587 + b * 0.114;
            const adjusted = ((gray / 255 - 0.5) * 1.1 + 0.5) * 255;
            r = g = b = adjusted;
        } else if (template) {
            // sepia
            const sepiaAmount = template.sepia * filterIntensity;
            if (sepiaAmount > 0) {
                const sr = r * 0.393 + g * 0.769 + b * 0.189;
                const sg = r * 0.349 + g * 0.686 + b * 0.168;
                const sb = r * 0.272 + g * 0.534 + b * 0.131;
                r = r + (sr - r) * sepiaAmount;
                g = g + (sg - g) * sepiaAmount;
                b = b + (sb - b) * sepiaAmount;
            }
            // contrast
            const contrast = blend(template.contrast);
            r = ((r / 255 - 0.5) * contrast + 0.5) * 255;
            g = ((g / 255 - 0.5) * contrast + 0.5) * 255;
            b = ((b / 255 - 0.5) * contrast + 0.5) * 255;
            // brightness
            const brightness = blend(template.brightness);
            r *= brightness;
            g *= brightness;
            b *= brightness;
            // saturation
            const saturate = blend(template.saturate);
            const gray = r * 0.299 + g * 0.587 + b * 0.114;
            r = gray + (r - gray) * saturate;
            g = gray + (g - gray) * saturate;
            b = gray + (b - gray) * saturate;
        }

        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imageData, 0, 0);
}

// ---------------------------------------------
// Texture effects (grain, vignette, scratches, light leaks)
// ---------------------------------------------
function applyTextureEffects(ctx, width, height, filter) {
    switch (filter) {
        case 'bw':
            addGrain(ctx, width, height, 0.08);
            addVignette(ctx, width, height, 0.15);
            break;
        case 'vintage':
            addGrain(ctx, width, height, 0.3 * filterGrain);
            addScratchesAndDust(ctx, width, height);
            addVignette(ctx, width, height, 0.5 * filterIntensity);
            break;
        case 'retro':
            addGrain(ctx, width, height, 0.25 * filterGrain);
            addVignette(ctx, width, height, 0.2 * filterIntensity);
            break;
        case 'polaroid':
            addGrain(ctx, width, height, 0.08 * filterGrain);
            addLightLeaks(ctx, width, height);
            addVignette(ctx, width, height, 0.1 * filterIntensity);
            break;
        case 'fadedfilm':
            addGrain(ctx, width, height, 0.2 * filterGrain);
            addVignette(ctx, width, height, 0.3 * filterIntensity);
            break;
    }
}

function addGrain(ctx, width, height, intensity = 0.15) {
    if (intensity <= 0) return;
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

function addScratchesAndDust(ctx, width, height) {
    const numScratches = Math.floor(width * height / 8000);
    const numDust = Math.floor(width * height / 5000);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < numScratches; i++) {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + (Math.random() - 0.5) * 20, y1 + (Math.random() - 0.5) * 20);
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    for (let i = 0; i < numScratches / 2; i++) {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + (Math.random() - 0.5) * 15, y1 + (Math.random() - 0.5) * 15);
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < numDust; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let i = 0; i < numDust / 2; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random(), 0, Math.PI * 2);
        ctx.fill();
    }
}

function addVignette(ctx, width, height, intensity = 0.4) {
    if (intensity <= 0) return;
    const gradient = ctx.createRadialGradient(
        width / 2, height / 2, height * 0.3,
        width / 2, height / 2, height * 0.8
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

function addLightLeaks(ctx, width, height) {
    const leak1 = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.45);
    leak1.addColorStop(0, 'rgba(255, 220, 140, 0.18)');
    leak1.addColorStop(0.5, 'rgba(255, 200, 120, 0.08)');
    leak1.addColorStop(1, 'rgba(255, 200, 120, 0)');
    ctx.fillStyle = leak1;
    ctx.fillRect(0, 0, width * 0.55, height * 0.35);

    const leak2 = ctx.createRadialGradient(width, 0, 0, width, 0, width * 0.35);
    leak2.addColorStop(0, 'rgba(255, 210, 130, 0.12)');
    leak2.addColorStop(1, 'rgba(255, 210, 130, 0)');
    ctx.fillStyle = leak2;
    ctx.fillRect(width * 0.45, 0, width * 0.55, height * 0.28);

    const leak3 = ctx.createRadialGradient(width / 2, height, 0, width / 2, height, height * 0.4);
    leak3.addColorStop(0, 'rgba(255, 200, 110, 0.08)');
    leak3.addColorStop(1, 'rgba(255, 200, 110, 0)');
    ctx.fillStyle = leak3;
    ctx.fillRect(0, height * 0.6, width, height * 0.4);
}

// ---------------------------------------------
// Result actions
// ---------------------------------------------
function downloadStrip() {
    if (!stripCanvas) return;
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    link.download = `photostrip-${timestamp}.png`;
    link.href = stripCanvas.toDataURL('image/png');
    link.click();
}
window.downloadStrip = downloadStrip;

async function shareStrip() {
    if (!stripCanvas) return;
    if (navigator.share) {
        try {
            const blob = await new Promise(resolve => stripCanvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], 'photostrip.png', { type: 'image/png' });
            await navigator.share({ files: [file], title: 'My Photo Strip' });
            return;
        } catch (error) {
            if (error.name === 'AbortError') return; // user cancelled the share sheet
        }
    }
    downloadStrip();
}
window.shareStrip = shareStrip;

function restart() {
    photos = [];
    stopStream();
    if (photoCounter) photoCounter.textContent = `0/${PHOTOS_TO_CAPTURE}`;
    selectFilter('bw');
    navigateTo('landing-page');
}
window.restart = restart;

// ---------------------------------------------
// Cleanup
// ---------------------------------------------
window.addEventListener('beforeunload', stopStream);
