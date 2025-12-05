/**
 * Photo Filters Demo
 * 
 * This demo showcases Vintage, Retro, Polaroid, and Faded Film filters
 * with live camera preview and adjustable intensity/grain controls.
 * 
 * ASSETS NOTE:
 * Placeholder PNG files are in /assets/filters/. Replace them with final assets:
 * - filmgrain.png: Tileable grain texture (1024x1024px recommended, alpha channel)
 * - lightleak.png: Light leak overlay (1024x1024px, transparent PNG)
 * - vignette.png: Radial vignette (1024x1024px, black center fading to transparent)
 * - dust.png: Scratches and dust overlay (1024x1024px, transparent PNG)
 * - polaroid-frame.png: Polaroid border frame (optional, for frame overlay)
 */

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

// State
let currentFilter = null;
let currentIntensity = 1.0;
let currentGrain = 0.5;
let videoStream = null;
let lastCapturedImage = null;
let ctxFilterSupported = false;

// DOM elements
const video = document.getElementById('video');
const exportCanvas = document.getElementById('exportCanvas');
const ctx = exportCanvas.getContext('2d');
const intensitySlider = document.getElementById('intensity');
const grainSlider = document.getElementById('grain');
const intensityValue = document.getElementById('intensityValue');
const grainValue = document.getElementById('grainValue');
const captureBtn = document.getElementById('captureBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusEl = document.getElementById('status');
const errorMessage = document.getElementById('errorMessage');
const noticeEl = document.getElementById('ctxFilterNotice');

// Overlay elements
const vignetteOverlay = document.getElementById('vignetteOverlay');
const lightleakOverlay = document.getElementById('lightleakOverlay');
const grainOverlay = document.getElementById('grainOverlay');
const dustOverlay = document.getElementById('dustOverlay');

// Check canvas filter support
try {
    const testCanvas = document.createElement('canvas');
    const testCtx = testCanvas.getContext('2d');
    testCtx.filter = 'sepia(1)';
    ctxFilterSupported = true;
} catch (e) {
    ctxFilterSupported = false;
    noticeEl.classList.add('show');
}

/**
 * Convert filter template to CSS filter string
 * @param {Object} template - Filter template object
 * @param {number} intensity - Intensity multiplier (0-1)
 * @returns {string} CSS filter string
 */
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

/**
 * Update video filter and overlays
 */
function updatePreview() {
    if (!currentFilter) {
        video.style.filter = 'none';
        vignetteOverlay.style.opacity = '0';
        lightleakOverlay.style.opacity = '0';
        grainOverlay.style.opacity = '0';
        dustOverlay.style.opacity = '0';
        return;
    }
    
    const template = FILTER_TEMPLATES[currentFilter];
    const cssFilter = cssFromTemplate(template, currentIntensity);
    video.style.filter = cssFilter;
    
    // Update overlay opacities
    vignetteOverlay.style.opacity = (0.7 * currentIntensity).toString();
    lightleakOverlay.style.opacity = (0.6 * currentIntensity).toString();
    grainOverlay.style.opacity = currentGrain.toString();
    dustOverlay.style.opacity = (0.3 * currentIntensity).toString();
}

/**
 * Select a filter
 */
function selectFilter(filterName) {
    // Update button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const isActive = btn.dataset.filter === filterName;
        btn.setAttribute('aria-pressed', isActive.toString());
    });
    
    currentFilter = filterName;
    updatePreview();
    statusEl.textContent = `Filter: ${filterName.charAt(0).toUpperCase() + filterName.slice(1)}`;
}

/**
 * Capture photo from video
 */
async function capturePhoto() {
    if (!videoStream || !currentFilter) {
        showError('Please select a filter and ensure camera is active');
        return;
    }
    
    try {
        const template = FILTER_TEMPLATES[currentFilter];
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        
        // Set canvas size to match video
        exportCanvas.width = width;
        exportCanvas.height = height;
        
        // Draw video frame
        if (ctxFilterSupported) {
            const cssFilter = cssFromTemplate(template, currentIntensity);
            ctx.filter = cssFilter;
        }
        ctx.drawImage(video, 0, 0, width, height);
        
        // Reset filter for overlays
        ctx.filter = 'none';
        
        // Composite overlays
        await compositeOverlays(ctx, width, height);
        
        // Add date stamp
        addDateStamp(ctx, width, height);
        
        // Store for download
        lastCapturedImage = exportCanvas.toDataURL('image/png');
        downloadBtn.disabled = false;
        
        // Open in new window
        const newWindow = window.open();
        const img = new Image();
        img.src = lastCapturedImage;
        img.onload = () => {
            newWindow.document.write(`<html><head><title>Captured Photo</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#333;"><img src="${lastCapturedImage}" style="max-width:100%;max-height:100%;"></body></html>`);
        };
        
        statusEl.textContent = 'Photo captured! Click Download to save.';
    } catch (error) {
        console.error('Capture error:', error);
        showError('Failed to capture photo: ' + error.message);
    }
}

/**
 * Composite overlays onto canvas
 */
async function compositeOverlays(canvasCtx, width, height) {
    const overlayOrder = ['lightleak', 'grain', 'dust', 'vignette'];
    
    for (const overlayName of overlayOrder) {
        try {
            const img = await loadOverlayImage(`assets/filters/${getOverlayFilename(overlayName)}.png`);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw overlay image
            tempCtx.drawImage(img, 0, 0, width, height);
            const imageData = tempCtx.getImageData(0, 0, width, height);
            
            // Apply opacity
            const opacity = getOverlayOpacity(overlayName);
            for (let i = 3; i < imageData.data.length; i += 4) {
                imageData.data[i] = imageData.data[i] * opacity;
            }
            
            tempCtx.putImageData(imageData, 0, 0);
            
            // Composite with appropriate blend mode
            const blendMode = getBlendMode(overlayName);
            canvasCtx.globalCompositeOperation = blendMode;
            canvasCtx.drawImage(tempCanvas, 0, 0);
            canvasCtx.globalCompositeOperation = 'source-over';
        } catch (error) {
            // Silently fail if overlay image doesn't exist (placeholder)
            console.log(`Overlay ${overlayName} not available:`, error);
        }
    }
}

/**
 * Get overlay filename
 */
function getOverlayFilename(overlayName) {
    const map = {
        'lightleak': 'lightleak',
        'grain': 'filmgrain',
        'dust': 'dust',
        'vignette': 'vignette'
    };
    return map[overlayName] || overlayName;
}

/**
 * Get overlay opacity
 */
function getOverlayOpacity(overlayName) {
    switch (overlayName) {
        case 'vignette': return 0.7 * currentIntensity;
        case 'lightleak': return 0.6 * currentIntensity;
        case 'grain': return currentGrain;
        case 'dust': return 0.3 * currentIntensity;
        default: return 0.5;
    }
}

/**
 * Get blend mode for overlay
 */
function getBlendMode(overlayName) {
    switch (overlayName) {
        case 'lightleak': return 'screen';
        case 'grain': return 'overlay';
        case 'dust': return 'screen';
        case 'vignette': return 'multiply';
        default: return 'normal';
    }
}

/**
 * Load overlay image
 */
function loadOverlayImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load ${src}`));
        img.src = src;
    });
}

/**
 * Add date stamp to canvas
 */
function addDateStamp(canvasCtx, width, height) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const dateStr = `${day} ${month} '${year}`;
    
    canvasCtx.fillStyle = '#ff0000';
    canvasCtx.font = 'bold 20px monospace';
    canvasCtx.textBaseline = 'bottom';
    canvasCtx.fillText(dateStr, 10, height - 10);
}

/**
 * Download captured image
 */
function downloadImage() {
    if (!lastCapturedImage) {
        showError('No image to download. Please capture a photo first.');
        return;
    }
    
    const link = document.createElement('a');
    link.download = `photobooth-${currentFilter}-${Date.now()}.png`;
    link.href = lastCapturedImage;
    link.click();
}

/**
 * Show error message
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    setTimeout(() => {
        errorMessage.classList.remove('show');
    }, 5000);
}

/**
 * Initialize camera
 */
async function initCamera() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'user'
            }
        });
        
        video.srcObject = videoStream;
        statusEl.textContent = 'Camera ready! Select a filter to start.';
        captureBtn.disabled = false;
    } catch (error) {
        console.error('Camera error:', error);
        showError('Failed to access camera: ' + error.message);
        statusEl.textContent = 'Camera access denied. Please allow camera permissions.';
    }
}

// Event listeners
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        selectFilter(btn.dataset.filter);
    });
});

intensitySlider.addEventListener('input', (e) => {
    currentIntensity = parseFloat(e.target.value);
    intensityValue.textContent = currentIntensity.toFixed(2);
    updatePreview();
});

grainSlider.addEventListener('input', (e) => {
    currentGrain = parseFloat(e.target.value);
    grainValue.textContent = currentGrain.toFixed(2);
    updatePreview();
});

captureBtn.addEventListener('click', capturePhoto);
downloadBtn.addEventListener('click', downloadImage);

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.matches('input, button')) {
        e.preventDefault();
        capturePhoto();
    }
});

// Initialize on load
window.addEventListener('load', () => {
    initCamera();
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
    }
});

