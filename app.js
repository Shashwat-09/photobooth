/* =============================================
   SKETCH PHOTOBOOTH - Main Application
   ============================================= */

'use strict';

// ---------------------------------------------
// Constants
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
const SPROCKET_MARGIN = 44;

const COUNTDOWN_WORDS = ['get ready!', 'smile!', 'pose!', 'hold it!'];

// ---------------------------------------------
// Filters
// `css` feeds both the live preview (element style) and the capture
// (ctx.filter / pixel fallback), so the strip matches what you see.
// `fx` are canvas-only texture passes baked into the final strip
// (the preview approximates cast + vignette with an overlay).
// ---------------------------------------------
const FILTERS = {
    color:     { name: 'Original',  css: {}, fx: {} },
    golden:    { name: 'Golden Hr', css: { sepia: 0.25, contrast: 1.05, brightness: 1.08, saturate: 1.30, hue: -8 },
                 fx: { grain: 0.05, leaks: true, vignette: 0.18, cast: 'rgba(255, 190, 110, 0.10)' } },
    dispo:     { name: 'Dispo 35',  css: { sepia: 0.08, contrast: 1.18, brightness: 1.05, saturate: 1.25 },
                 fx: { grain: 0.14, vignette: 0.45, halation: true, stamp: true } },
    peachy:    { name: 'Peachy',    css: { sepia: 0.10, contrast: 0.92, brightness: 1.12, saturate: 1.15, hue: -10 },
                 fx: { grain: 0.05, vignette: 0.08, cast: 'rgba(255, 150, 160, 0.12)' } },
    frosty:    { name: 'Frosty',    css: { contrast: 1.05, brightness: 1.06, saturate: 0.85, hue: 8 },
                 fx: { grain: 0.06, vignette: 0.12, cast: 'rgba(120, 170, 255, 0.10)' } },
    y2k:       { name: 'Y2K Cam',   css: { contrast: 1.20, brightness: 1.05, saturate: 1.50, hue: 4 },
                 fx: { grain: 0.12, vignette: 0.20, stamp: true } },
    polaroid:  { name: 'Polaroid',  css: { sepia: 0.10, contrast: 0.85, brightness: 1.10, saturate: 0.90, hue: -6 },
                 fx: { grain: 0.05, leaks: true, vignette: 0.10 } },
    vintage:   { name: 'Vintage',   css: { sepia: 0.35, contrast: 0.90, brightness: 0.95, saturate: 0.70, hue: -4 },
                 fx: { grain: 0.16, scratches: true, vignette: 0.40 } },
    retro:     { name: 'Retro',     css: { sepia: 0.18, contrast: 1.25, brightness: 0.90, saturate: 1.40, hue: 10 },
                 fx: { grain: 0.13, vignette: 0.20 } },
    fadedfilm: { name: 'Faded',     css: { sepia: 0.20, contrast: 0.80, brightness: 1.10, saturate: 0.60 },
                 fx: { grain: 0.10, vignette: 0.30 } },
    bw:        { name: 'B&W',       css: { grayscale: 1, contrast: 1.10 },
                 fx: { grain: 0.08, vignette: 0.15 } },
    noir:      { name: 'Noir',      css: { grayscale: 1, contrast: 1.35, brightness: 0.95 },
                 fx: { grain: 0.18, vignette: 0.55 } }
};

// ---------------------------------------------
// Strip layouts & designs
// ---------------------------------------------
const LAYOUTS = {
    strip4: { cols: 1, rows: 4, count: 4 },
    strip3: { cols: 1, rows: 3, count: 3 },
    grid4:  { cols: 2, rows: 2, count: 4 }
};

const DESIGNS = {
    white:  { bg: '#ffffff', border: '#1a1a1a', frame: '#1a1a1a', text: '#1a1a1a', sub: '#666666' },
    black:  { bg: '#141414', border: '#f5f2ea', frame: '#f5f2ea', text: '#f5f2ea', sub: '#9b968a' },
    cream:  { bg: '#f4ead2', border: '#7a5c3e', frame: '#7a5c3e', text: '#5b4632', sub: '#8a7358' },
    kraft:  { bg: '#d9b98c', border: '#6f4f28', frame: '#6f4f28', text: '#5a3f1e', sub: '#85653f' },
    gold:   { bg: '#fdf8ee', border: '#c8a24b', frame: '#c8a24b', text: '#8a6d2f', sub: '#b3945a', doubleBorder: true },
    pink:   { bg: '#ffd9e6', border: '#c2447a', frame: '#c2447a', text: '#b03a6e', sub: '#cf7ba0' },
    hearts: { bg: '#fff1f5', border: '#e0527a', frame: '#e0527a', text: '#d63d6d', sub: '#ef8fae', hearts: true },
    film:   { bg: '#101010', border: '#101010', frame: '#2b2b2b', text: '#f2ede2', sub: '#8f8a7e', sprockets: true, hole: '#f2ede2' }
};

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
let photoThumbs = [];
let isCapturing = false;
let isNavigating = false;
let isStartingCamera = false;
let isProcessingUpload = false;
let currentFilter = 'color';
let currentLayout = 'strip4';
let currentDesign = 'white';
let photoSource = 'camera'; // 'camera' picks the filter live; 'upload' picks it on the edit page
let filterIntensity = 1.0;
let audioContext = null;

// DOM elements (assigned on DOMContentLoaded)
let webcam, stripCanvas, countdownOverlay, countdownNumber, countdownWord,
    flashOverlay, photoCounter, cameraFrame, stripPreview, filterRow;

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
    cameraFrame = $('camera-frame');
    stripPreview = $('strip-preview');
    filterRow = $('filter-row');

    setupEventListeners();
    setupTilt();
    buildCameraFilterChips();

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

    // Mode buttons
    $('btn-take-photo').addEventListener('click', startCamera);
    $('btn-upload-photo').addEventListener('click', () => $('photo-upload').click());
    $('photo-upload').addEventListener('change', handleUpload);

    // Camera page
    $('btn-camera-back').addEventListener('click', stopAndGoBack);
    $('capture-button').addEventListener('click', startCapture);

    // Edit page
    $('btn-edit-back').addEventListener('click', () => {
        photos = [];
        photoThumbs = [];
        navigateTo('select-page');
    });
    $('btn-print-strip').addEventListener('click', finishAndPrint);

    document.querySelectorAll('.layout-chip').forEach(chip => {
        chip.addEventListener('click', () => selectLayout(chip.dataset.layout));
    });
    document.querySelectorAll('.design-chip').forEach(chip => {
        chip.addEventListener('click', () => selectDesign(chip.dataset.design));
    });

    const intensitySlider = $('intensitySlider');
    intensitySlider.addEventListener('input', (e) => {
        filterIntensity = parseFloat(e.target.value);
        $('intensityValue').textContent = filterIntensity.toFixed(2);
        applyPreviewFilter();
    });

    // Result actions
    $('btn-download').addEventListener('click', downloadStrip);
    $('btn-share').addEventListener('click', shareStrip);
    $('btn-print').addEventListener('click', () => window.print());
    $('btn-restart').addEventListener('click', restart);

    // Social links are placeholders until the accounts exist
    document.querySelectorAll('[data-social]').forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.getAttribute('href') === '#') e.preventDefault();
        });
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
// Filter CSS
// ---------------------------------------------
// Build the CSS filter string. Intensity blends each parameter toward its
// neutral value so 0 = original image, 1 = full effect.
function getFilterCSS(filter = currentFilter, intensity = filterIntensity) {
    const t = FILTERS[filter]?.css;
    if (!t) return 'none';

    const blend = (value) => value * intensity + (1 - intensity);
    const parts = [];
    if (t.grayscale) parts.push(`grayscale(${(t.grayscale * intensity).toFixed(3)})`);
    if (t.sepia) parts.push(`sepia(${(t.sepia * intensity).toFixed(3)})`);
    if (t.contrast !== undefined) parts.push(`contrast(${blend(t.contrast).toFixed(3)})`);
    if (t.brightness !== undefined) parts.push(`brightness(${blend(t.brightness).toFixed(3)})`);
    if (t.saturate !== undefined) parts.push(`saturate(${blend(t.saturate).toFixed(3)})`);
    if (t.hue) parts.push(`hue-rotate(${(t.hue * intensity).toFixed(1)}deg)`);
    return parts.length ? parts.join(' ') : 'none';
}

// ---------------------------------------------
// Camera
// ---------------------------------------------
async function startCamera() {
    if (isStartingCamera || stream) return;
    isStartingCamera = true;
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

        updateCameraFilter();
        if (photoCounter) photoCounter.textContent = `0/${PHOTOS_TO_CAPTURE}`;
        navigateTo('camera-page');
    } catch (error) {
        stopStream();
        console.error('Camera error:', error);
        alert('Could not access camera. Please allow camera permissions and try again.');
    } finally {
        isStartingCamera = false;
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
    if (isProcessingUpload) return;
    const files = Array.from(event.target.files);
    event.target.value = ''; // allow re-selecting the same files
    if (files.length === 0) return;

    isProcessingUpload = true;
    const modeButtons = [$('btn-take-photo'), $('btn-upload-photo')];
    modeButtons.forEach(btn => { if (btn) btn.disabled = true; });

    try {
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

        photoSource = 'upload';
        openEditPage();
    } finally {
        isProcessingUpload = false;
        modeButtons.forEach(btn => { if (btn) btn.disabled = false; });
    }
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

    let completed = false;
    try {
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

        completed = isCapturing && photos.length === PHOTOS_TO_CAPTURE;
    } catch (error) {
        console.error('Capture error:', error);
    } finally {
        isCapturing = false;
        if (captureBtn) captureBtn.disabled = false;
        if (countdownOverlay) countdownOverlay.classList.add('hidden');
    }

    if (completed) {
        stopStream();
        photoSource = 'camera';
        openEditPage();
    }
}
window.startCapture = startCapture;

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
        countdownNumber.style.animation = 'countdown-pop 0.9s ease-out';
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

// ---------------------------------------------
// Edit page (live preview: filter / layout / design)
// ---------------------------------------------
function openEditPage() {
    buildThumbnails();

    // The camera flow already picked its filter live, so don't show the
    // picker twice; uploads never saw the camera, so they pick it here.
    const filterSection = $('filter-section');
    const showFilterPicker = photoSource === 'upload';
    if (filterSection) filterSection.style.display = showFilterPicker ? '' : 'none';
    if (showFilterPicker) buildFilterChips();

    renderPreviewStrip();
    navigateTo('edit-page');
}

// Small center-cropped 4:3 thumbnails of the user's own photos,
// used for both the preview strip and the filter swatches.
function buildThumbnails() {
    const THUMB_W = 260;
    const THUMB_H = 195;
    photoThumbs = photos.map(photo => {
        const canvas = document.createElement('canvas');
        canvas.width = THUMB_W;
        canvas.height = THUMB_H;
        drawCoverImage(canvas.getContext('2d'), photo, THUMB_W, THUMB_H);
        return canvas.toDataURL('image/jpeg', 0.85);
    });
}

function buildFilterChips() {
    if (!filterRow) return;
    filterRow.innerHTML = '';
    Object.entries(FILTERS).forEach(([id, def]) => {
        const btn = document.createElement('button');
        btn.className = 'chip filter-chip' + (id === currentFilter ? ' active' : '');
        btn.dataset.filter = id;
        btn.setAttribute('aria-label', `${def.name} filter`);

        const img = document.createElement('img');
        img.src = photoThumbs[0] || '';
        img.alt = '';
        img.style.filter = getFilterCSS(id, 1);

        const label = document.createElement('span');
        label.textContent = def.name;

        btn.appendChild(img);
        btn.appendChild(label);
        btn.addEventListener('click', () => selectFilter(id));
        filterRow.appendChild(btn);
    });
}

function selectFilter(filter) {
    if (!FILTERS[filter]) return;
    currentFilter = filter;
    document.querySelectorAll('.filter-chip, .cam-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.filter === filter);
    });
    updateCameraFilter();
    applyPreviewFilter();
}
window.selectFilter = selectFilter;

// Live filter on the webcam preview (capture stays raw; the same filter
// string is baked in at strip render time, so what you see is what you get)
function updateCameraFilter() {
    if (!webcam) return;
    const css = getFilterCSS();
    webcam.style.filter = css === 'none' ? '' : css;
}

// Filter picker shown on the camera page (Snapchat/Dazz-style live preview)
function buildCameraFilterChips() {
    const row = $('camera-filter-row');
    if (!row) return;
    Object.entries(FILTERS).forEach(([id, def]) => {
        const btn = document.createElement('button');
        btn.className = 'chip cam-chip' + (id === currentFilter ? ' active' : '');
        btn.dataset.filter = id;
        btn.setAttribute('aria-label', `${def.name} filter`);

        const swatch = document.createElement('span');
        swatch.className = 'filter-swatch';
        swatch.style.filter = getFilterCSS(id, 1);

        const label = document.createElement('span');
        label.textContent = def.name;

        btn.appendChild(swatch);
        btn.appendChild(label);
        btn.addEventListener('click', () => selectFilter(id));
        row.appendChild(btn);
    });
}

function selectLayout(layout) {
    if (!LAYOUTS[layout]) return;
    currentLayout = layout;
    document.querySelectorAll('.layout-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.layout === layout);
    });
    renderPreviewStrip();
}

function selectDesign(design) {
    if (!DESIGNS[design]) return;
    currentDesign = design;
    document.querySelectorAll('.design-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.design === design);
    });
    renderPreviewStrip();
}

// Rebuild the mini strip preview (layout + design), then apply the filter
function renderPreviewStrip() {
    if (!stripPreview) return;
    const layout = LAYOUTS[currentLayout];

    stripPreview.className = `strip-preview layout-${currentLayout} design-${currentDesign}`;
    stripPreview.innerHTML = '';

    const cells = document.createElement('div');
    cells.className = 'pv-cells';
    for (let i = 0; i < layout.count; i++) {
        const cell = document.createElement('div');
        cell.className = 'pv-cell';
        const img = document.createElement('img');
        img.src = photoThumbs[i % Math.max(photoThumbs.length, 1)] || '';
        img.alt = `photo ${i + 1}`;
        const tint = document.createElement('div');
        tint.className = 'pv-tint';
        cell.appendChild(img);
        cell.appendChild(tint);
        cells.appendChild(cell);
    }
    stripPreview.appendChild(cells);

    const footer = document.createElement('div');
    footer.className = 'pv-footer';
    footer.innerHTML = '<span class="pv-brand">P H O T O B O O T H</span>';
    stripPreview.appendChild(footer);

    applyPreviewFilter();
}

// Live preview of the color grade + approximate cast/vignette overlay
function applyPreviewFilter() {
    if (!stripPreview) return;
    const css = getFilterCSS();
    const fx = FILTERS[currentFilter]?.fx || {};
    const vignette = (fx.vignette || 0) * filterIntensity;

    stripPreview.querySelectorAll('.pv-cell img').forEach(img => {
        img.style.filter = css === 'none' ? '' : css;
    });
    stripPreview.querySelectorAll('.pv-tint').forEach(tint => {
        tint.style.background = fx.cast || '';
        tint.style.boxShadow = vignette > 0
            ? `inset 0 0 ${Math.round(40 * vignette + 10)}px rgba(0, 0, 0, ${vignette.toFixed(2)})`
            : '';
    });
}

// ---------------------------------------------
// Printing flow
// ---------------------------------------------
async function finishAndPrint() {
    navigateTo('printing-page');
    await startPrintCountdown();
    generatePhotoStrip();
    // Wide strips (multi-column layouts) cover the side doodles,
    // so stack the result page annotations instead
    const resultContainer = document.querySelector('.result-container');
    if (resultContainer) {
        resultContainer.classList.toggle('wide-strip', LAYOUTS[currentLayout].cols > 1);
    }
    navigateTo('result-page');
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
        printCountdown.style.animation = 'countdown-pop 0.9s ease-out';
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

    const layout = LAYOUTS[currentLayout];
    const design = DESIGNS[currentDesign];
    const side = (design.sprockets || design.hearts) ? SPROCKET_MARGIN : 0;

    const stripWidth = STRIP_BORDER * 2 + side * 2
        + layout.cols * PHOTO_W + (layout.cols - 1) * STRIP_GAP;
    const stripHeight = STRIP_BORDER + layout.rows * PHOTO_H
        + (layout.rows - 1) * STRIP_GAP + STRIP_FOOTER;

    stripCanvas.width = stripWidth;
    stripCanvas.height = stripHeight;

    const ctx = stripCanvas.getContext('2d');

    // Background
    ctx.fillStyle = design.bg;
    ctx.fillRect(0, 0, stripWidth, stripHeight);

    // Outer border
    ctx.strokeStyle = design.border;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, stripWidth - 4, stripHeight - 4);

    // Inner second border (gold / elegant design)
    if (design.doubleBorder) {
        ctx.lineWidth = 1.5;
        ctx.strokeRect(11, 11, stripWidth - 22, stripHeight - 22);
    }

    // Sprocket holes (film design)
    if (design.sprockets) {
        drawSprockets(ctx, stripWidth, stripHeight, design.hole);
    }

    // Heart columns down both sides (couple design)
    if (design.hearts) {
        drawHeartsDecor(ctx, stripWidth, stripHeight, design.border);
    }

    // Photos
    for (let i = 0; i < layout.count; i++) {
        const photo = photos[i % photos.length];
        const col = i % layout.cols;
        const row = Math.floor(i / layout.cols);
        const x = STRIP_BORDER + side + col * (PHOTO_W + STRIP_GAP);
        const y = STRIP_BORDER + row * (PHOTO_H + STRIP_GAP);

        ctx.fillStyle = design.frame;
        ctx.fillRect(x - 3, y - 3, PHOTO_W + 6, PHOTO_H + 6);

        drawPhoto(ctx, photo, x, y, PHOTO_W, PHOTO_H);
    }

    // Footer
    const footerY = STRIP_BORDER + layout.rows * PHOTO_H
        + (layout.rows - 1) * STRIP_GAP;

    ctx.fillStyle = design.text;
    ctx.textAlign = 'center';
    ctx.font = '28px "Architects Daughter", cursive';
    ctx.fillText('P H O T O B O O T H', stripWidth / 2, footerY + 44);

    if (design.hearts) {
        drawHeart(ctx, stripWidth / 2 - 165, footerY + 36, 22, design.border);
        drawHeart(ctx, stripWidth / 2 + 165, footerY + 36, 22, design.border);
    }

    const dateStr = new Date().toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
    });
    ctx.font = '24px Caveat, cursive';
    ctx.fillStyle = design.sub;
    ctx.fillText(dateStr, stripWidth / 2, footerY + 74);
}

function drawSprockets(ctx, width, height, holeColor) {
    const holeW = 20;
    const holeH = 26;
    const step = 58;
    const leftX = (SPROCKET_MARGIN + STRIP_BORDER - holeW) / 2 + 6;
    const rightX = width - leftX - holeW;

    ctx.fillStyle = holeColor;
    for (let y = 24; y + holeH < height - 12; y += step) {
        for (const x of [leftX, rightX]) {
            if (typeof ctx.roundRect === 'function') {
                ctx.beginPath();
                ctx.roundRect(x, y, holeW, holeH, 5);
                ctx.fill();
            } else {
                ctx.fillRect(x, y, holeW, holeH);
            }
        }
    }
}

// Filled heart centered on (cx, cy); size is the heart's width
function drawHeart(ctx, cx, cy, size, color, rotation = 0, alpha = 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.scale(size / 24, size / 24);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.bezierCurveTo(-5, 4, -10, 0.5, -10, -3.5);
    ctx.bezierCurveTo(-10, -6.6, -7.6, -9, -4.5, -9);
    ctx.bezierCurveTo(-2.8, -9, -1.1, -8.2, 0, -6.9);
    ctx.bezierCurveTo(1.1, -8.2, 2.8, -9, 4.5, -9);
    ctx.bezierCurveTo(7.6, -9, 10, -6.6, 10, -3.5);
    ctx.bezierCurveTo(10, 0.5, 5, 4, 0, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// Columns of alternating hearts down both side margins (couple design)
function drawHeartsDecor(ctx, width, height, color) {
    const colX = (SPROCKET_MARGIN + STRIP_BORDER) / 2 + 4;
    const step = 58;
    let n = 0;
    for (let y = 34; y < height - STRIP_FOOTER + 10; y += step, n++) {
        const big = n % 2 === 0;
        const size = big ? 20 : 13;
        const alpha = big ? 0.9 : 0.5;
        const rot = (n % 2 === 0 ? -1 : 1) * 0.26;
        drawHeart(ctx, colX, y, size, color, rot, alpha);
        drawHeart(ctx, width - colX, y, size, color, -rot, alpha);
    }
}

// Center-crop `source` to cover the target rect
function drawCoverImage(ctx, source, width, height, filterCSS) {
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

    if (filterCSS && CTX_FILTER_SUPPORTED) {
        ctx.filter = filterCSS;
        ctx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
        ctx.filter = 'none';
        return true;
    }
    ctx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
    return false;
}

function drawPhoto(ctx, source, x, y, width, height) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    // Same filter string as the live preview -> WYSIWYG output
    const filtered = drawCoverImage(tempCtx, source, width, height, getFilterCSS());
    if (!filtered) {
        applyFilterPixels(tempCtx, width, height, currentFilter);
    }

    applyTextureEffects(tempCtx, width, height, currentFilter);

    ctx.drawImage(tempCanvas, x, y);
}

// ---------------------------------------------
// Pixel-level filter fallback (browsers without ctx.filter)
// Mirrors getFilterCSS order: grayscale, sepia, contrast,
// brightness, saturate, hue-rotate.
// ---------------------------------------------
function applyFilterPixels(ctx, width, height, filter) {
    const t = FILTERS[filter]?.css;
    if (!t || Object.keys(t).length === 0) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const blend = (value) => value * filterIntensity + (1 - filterIntensity);

    const grayAmt = (t.grayscale || 0) * filterIntensity;
    const sepiaAmt = (t.sepia || 0) * filterIntensity;
    const contrast = t.contrast !== undefined ? blend(t.contrast) : 1;
    const brightness = t.brightness !== undefined ? blend(t.brightness) : 1;
    const saturate = t.saturate !== undefined ? blend(t.saturate) : 1;
    const hueDeg = (t.hue || 0) * filterIntensity;
    const cos = Math.cos(hueDeg * Math.PI / 180);
    const sin = Math.sin(hueDeg * Math.PI / 180);

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];

        if (grayAmt > 0) {
            const gray = r * 0.299 + g * 0.587 + b * 0.114;
            r = r + (gray - r) * grayAmt;
            g = g + (gray - g) * grayAmt;
            b = b + (gray - b) * grayAmt;
        }
        if (sepiaAmt > 0) {
            const sr = r * 0.393 + g * 0.769 + b * 0.189;
            const sg = r * 0.349 + g * 0.686 + b * 0.168;
            const sb = r * 0.272 + g * 0.534 + b * 0.131;
            r = r + (sr - r) * sepiaAmt;
            g = g + (sg - g) * sepiaAmt;
            b = b + (sb - b) * sepiaAmt;
        }
        r = ((r / 255 - 0.5) * contrast + 0.5) * 255 * brightness;
        g = ((g / 255 - 0.5) * contrast + 0.5) * 255 * brightness;
        b = ((b / 255 - 0.5) * contrast + 0.5) * 255 * brightness;

        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        r = gray + (r - gray) * saturate;
        g = gray + (g - gray) * saturate;
        b = gray + (b - gray) * saturate;

        if (hueDeg !== 0) {
            const nr = r * (0.213 + 0.787 * cos - 0.213 * sin) + g * (0.715 - 0.715 * cos - 0.715 * sin) + b * (0.072 - 0.072 * cos + 0.928 * sin);
            const ng = r * (0.213 - 0.213 * cos + 0.143 * sin) + g * (0.715 + 0.285 * cos + 0.140 * sin) + b * (0.072 - 0.072 * cos - 0.283 * sin);
            const nb = r * (0.213 - 0.213 * cos - 0.787 * sin) + g * (0.715 - 0.715 * cos + 0.715 * sin) + b * (0.072 + 0.928 * cos + 0.072 * sin);
            r = nr; g = ng; b = nb;
        }

        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imageData, 0, 0);
}

// ---------------------------------------------
// Texture effects (grain, vignette, scratches, leaks, halation, stamp)
// ---------------------------------------------
function applyTextureEffects(ctx, width, height, filter) {
    const fx = FILTERS[filter]?.fx;
    if (!fx) return;

    if (fx.grain) addGrain(ctx, width, height, fx.grain * filterIntensity);
    if (fx.scratches) addScratchesAndDust(ctx, width, height);
    if (fx.leaks) addLightLeaks(ctx, width, height);
    if (fx.halation) addHalation(ctx, width, height);
    if (fx.vignette) addVignette(ctx, width, height, fx.vignette * filterIntensity);
    if (fx.cast) {
        ctx.fillStyle = fx.cast;
        ctx.fillRect(0, 0, width, height);
    }
    if (fx.stamp) addTimestamp(ctx, width, height);
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

// Soft warm flash bloom in the center (disposable-camera look)
function addHalation(ctx, width, height) {
    const glow = ctx.createRadialGradient(
        width / 2, height * 0.45, 0,
        width / 2, height * 0.45, width * 0.5
    );
    glow.addColorStop(0, 'rgba(255, 235, 210, 0.16)');
    glow.addColorStop(0.6, 'rgba(255, 235, 210, 0.05)');
    glow.addColorStop(1, 'rgba(255, 235, 210, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
}

// Orange digicam date stamp, bottom-right corner
function addTimestamp(ctx, width, height) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const text = `${dd} ${mm} '${yy}`;

    ctx.save();
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(255, 100, 0, 0.55)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(255, 150, 50, 0.9)';
    ctx.fillText(text, width - 16, height - 14);
    ctx.restore();
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
            if (blob) {
                const file = new File([blob], 'photostrip.png', { type: 'image/png' });
                await navigator.share({ files: [file], title: 'My Photo Strip' });
                return;
            }
        } catch (error) {
            if (error.name === 'AbortError') return; // user cancelled the share sheet
        }
    }
    downloadStrip();
}
window.shareStrip = shareStrip;

function restart() {
    photos = [];
    photoThumbs = [];
    stopStream();
    currentLayout = 'strip4';
    currentDesign = 'white';
    filterIntensity = 1.0;
    const slider = $('intensitySlider');
    if (slider) slider.value = '1';
    const sliderValue = $('intensityValue');
    if (sliderValue) sliderValue.textContent = '1.00';
    selectFilter('color');
    document.querySelectorAll('.layout-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.layout === currentLayout);
    });
    document.querySelectorAll('.design-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.design === currentDesign);
    });
    if (photoCounter) photoCounter.textContent = `0/${PHOTOS_TO_CAPTURE}`;
    navigateTo('landing-page');
}
window.restart = restart;

// ---------------------------------------------
// Cleanup
// ---------------------------------------------
window.addEventListener('beforeunload', stopStream);
