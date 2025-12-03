/* =============================================
   RETRO PHOTOBOOTH - High Quality Polaroid Style
   ============================================= */

class RetroPhotobooth {
    constructor() {
        // DOM Elements
        this.webcam = document.getElementById('webcam');
        this.previewCanvas = document.getElementById('preview-canvas');
        this.stripCanvas = document.getElementById('strip-canvas');
        this.countdown = document.getElementById('countdown');
        this.flash = document.getElementById('flash');
        this.startBtn = document.getElementById('start-btn');
        this.captureBtn = document.getElementById('capture-btn');
        this.retakeBtn = document.getElementById('retake-btn');
        this.downloadBtn = document.getElementById('download-btn');
        this.stripControls = document.getElementById('strip-controls');
        this.stripPlaceholder = document.getElementById('strip-placeholder');
        this.status = document.getElementById('status');
        this.vintageFrame = document.querySelector('.vintage-frame');

        // State
        this.stream = null;
        this.photos = [];
        this.isCapturing = false;
        this.photosToCapture = 4;
        this.countdownSeconds = 3;

        // HIGH QUALITY Polaroid dimensions (scaled up for print quality)
        // Classic Polaroid aspect ratio: square photo with larger bottom border
        this.photoSize = 400;           // Square photo size (high res)
        this.borderTop = 25;            // Top border
        this.borderSide = 25;           // Side borders
        this.borderBottom = 80;         // Larger bottom border (classic Polaroid look)
        this.stripPadding = 30;         // Padding around the strip
        this.photoGap = 20;             // Gap between polaroids

        // Calculate polaroid frame dimensions
        this.polaroidWidth = this.photoSize + (this.borderSide * 2);
        this.polaroidHeight = this.photoSize + this.borderTop + this.borderBottom;

        // Bind methods
        this.init();
    }

    init() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.captureBtn.addEventListener('click', () => this.startPhotoSession());
        this.retakeBtn.addEventListener('click', () => this.retake());
        this.downloadBtn.addEventListener('click', () => this.downloadStrip());
    }

    async startCamera() {
        try {
            this.setStatus('Requesting camera access (high quality mode)...');
            this.startBtn.disabled = true;

            // Request HIGHEST quality camera settings
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920, min: 1280 },
                    height: { ideal: 1080, min: 720 },
                    facingMode: 'user',
                    // Request best quality settings
                    aspectRatio: { ideal: 1.777778 },
                    frameRate: { ideal: 30 }
                },
                audio: false
            });

            this.webcam.srcObject = this.stream;
            await this.webcam.play();

            // Log actual resolution
            const settings = this.stream.getVideoTracks()[0].getSettings();
            console.log(`Camera resolution: ${settings.width}x${settings.height}`);

            this.startBtn.classList.add('hidden');
            this.captureBtn.classList.remove('hidden');
            this.setStatus(`Camera ready! (${settings.width}x${settings.height}) Click "Take Photos" to begin.`);

        } catch (error) {
            console.error('Camera error:', error);
            this.startBtn.disabled = false;
            
            if (error.name === 'NotAllowedError') {
                this.setStatus('Camera access denied. Please allow camera access and try again.', true);
            } else if (error.name === 'NotFoundError') {
                this.setStatus('No camera found. Please connect a camera and try again.', true);
            } else {
                this.setStatus('Could not access camera. Please try again.', true);
            }
        }
    }

    async startPhotoSession() {
        if (this.isCapturing) return;

        this.isCapturing = true;
        this.photos = [];
        this.captureBtn.disabled = true;
        this.vintageFrame.classList.add('capturing');
        
        // Hide previous strip if any
        this.stripCanvas.classList.add('hidden');
        this.stripPlaceholder.classList.remove('hidden');
        this.stripControls.classList.add('hidden');

        this.setStatus(`Taking ${this.photosToCapture} photos...`);

        for (let i = 0; i < this.photosToCapture; i++) {
            this.setStatus(`Photo ${i + 1} of ${this.photosToCapture} - Get ready!`);
            
            // Countdown
            await this.showCountdown();
            
            // Capture photo at full resolution
            const photoData = this.captureFrame();
            this.photos.push(photoData);
            
            // Flash effect
            this.triggerFlash();
            
            // Small delay between photos
            if (i < this.photosToCapture - 1) {
                await this.delay(800);
            }
        }

        this.isCapturing = false;
        this.captureBtn.disabled = false;
        this.vintageFrame.classList.remove('capturing');
        
        this.setStatus('Photos captured! Creating your Polaroid strip...');
        
        // Generate the photo strip
        await this.delay(500);
        this.generatePhotoStrip();
    }

    async showCountdown() {
        this.countdown.classList.remove('hidden');
        
        for (let i = this.countdownSeconds; i > 0; i--) {
            this.countdown.innerHTML = `<span class="countdown-number">${i}</span>`;
            await this.delay(1000);
        }
        
        this.countdown.classList.add('hidden');
    }

    captureFrame() {
        // Capture at FULL webcam resolution for highest quality
        const canvas = document.createElement('canvas');
        canvas.width = this.webcam.videoWidth;
        canvas.height = this.webcam.videoHeight;
        
        const ctx = canvas.getContext('2d', { 
            alpha: false,
            desynchronized: true
        });
        
        // Enable high quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Mirror the image (like the preview)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(this.webcam, 0, 0);
        
        return canvas;
    }

    triggerFlash() {
        this.flash.classList.add('active');
        setTimeout(() => {
            this.flash.classList.remove('active');
        }, 300);
    }

    generatePhotoStrip() {
        const ctx = this.stripCanvas.getContext('2d', { alpha: false });
        
        // Enable high quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Calculate strip dimensions for vertical Polaroid layout
        const stripWidth = this.polaroidWidth + (this.stripPadding * 2);
        const stripHeight = (this.polaroidHeight * this.photosToCapture) + 
                           (this.photoGap * (this.photosToCapture - 1)) + 
                           (this.stripPadding * 2);

        this.stripCanvas.width = stripWidth;
        this.stripCanvas.height = stripHeight;

        // Fill with cream/off-white background
        ctx.fillStyle = '#FAF8F5';
        ctx.fillRect(0, 0, stripWidth, stripHeight);

        // Draw each Polaroid
        this.photos.forEach((photoCanvas, index) => {
            const x = this.stripPadding;
            const y = this.stripPadding + (index * (this.polaroidHeight + this.photoGap));
            
            this.drawPolaroid(ctx, photoCanvas, x, y, index);
        });

        // Show the strip
        this.stripCanvas.classList.remove('hidden');
        this.stripPlaceholder.classList.add('hidden');
        this.stripControls.classList.remove('hidden');
        
        this.setStatus('Your Polaroid strip is ready! ✨');
    }

    drawPolaroid(ctx, sourceCanvas, x, y, index) {
        // Draw Polaroid frame with subtle shadow
        ctx.save();
        
        // Slight random rotation for aesthetic (-2 to 2 degrees)
        const rotation = (Math.random() - 0.5) * 4 * (Math.PI / 180);
        const centerX = x + this.polaroidWidth / 2;
        const centerY = y + this.polaroidHeight / 2;
        
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.translate(-centerX, -centerY);
        
        // Drop shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 5;
        
        // Polaroid white frame
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y, this.polaroidWidth, this.polaroidHeight);
        
        // Reset shadow for photo
        ctx.shadowColor = 'transparent';
        
        // Draw the photo (square crop from center)
        this.drawCroppedPhoto(ctx, sourceCanvas, x + this.borderSide, y + this.borderTop);
        
        // Add subtle Polaroid texture overlay
        this.addPolaroidTexture(ctx, x, y);
        
        // Add date stamp on bottom border
        this.addPolaroidDate(ctx, x, y, index);
        
        ctx.restore();
    }

    drawCroppedPhoto(ctx, sourceCanvas, x, y) {
        // Create high-quality square crop from center of the source
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.photoSize;
        tempCanvas.height = this.photoSize;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';

        // Calculate square crop from center
        const srcWidth = sourceCanvas.width;
        const srcHeight = sourceCanvas.height;
        const cropSize = Math.min(srcWidth, srcHeight);
        const srcX = (srcWidth - cropSize) / 2;
        const srcY = (srcHeight - cropSize) / 2;

        // Draw cropped and scaled photo
        tempCtx.drawImage(
            sourceCanvas,
            srcX, srcY, cropSize, cropSize,
            0, 0, this.photoSize, this.photoSize
        );

        // Apply subtle aesthetic color grading (Polaroid look)
        this.applyPolaroidEffect(tempCtx);

        // Draw to main canvas
        ctx.drawImage(tempCanvas, x, y);
    }

    applyPolaroidEffect(ctx) {
        const imageData = ctx.getImageData(0, 0, this.photoSize, this.photoSize);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // Subtle warm Polaroid color shift
            // Slightly lifted blacks, warm highlights, faded look
            
            // Lift shadows slightly
            r = r + (255 - r) * 0.05;
            g = g + (255 - g) * 0.03;
            b = b + (255 - b) * 0.02;
            
            // Warm tone shift
            r = Math.min(255, r * 1.02 + 5);
            g = Math.min(255, g * 1.0 + 2);
            b = Math.min(255, b * 0.97);
            
            // Slight contrast boost
            r = ((r / 255 - 0.5) * 1.05 + 0.5) * 255;
            g = ((g / 255 - 0.5) * 1.05 + 0.5) * 255;
            b = ((b / 255 - 0.5) * 1.05 + 0.5) * 255;

            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }

        ctx.putImageData(imageData, 0, 0);

        // Add subtle vignette
        const gradient = ctx.createRadialGradient(
            this.photoSize / 2, this.photoSize / 2, this.photoSize * 0.3,
            this.photoSize / 2, this.photoSize / 2, this.photoSize * 0.7
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.photoSize, this.photoSize);
    }

    addPolaroidTexture(ctx, x, y) {
        // Add very subtle paper texture to the white frame
        const gradient = ctx.createLinearGradient(x, y, x, y + this.polaroidHeight);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.01)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.02)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, this.polaroidWidth, this.polaroidHeight);
    }

    addPolaroidDate(ctx, x, y, index) {
        const date = new Date();
        
        // Classic Polaroid date format
        const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric'
        }).toUpperCase();

        // Position in bottom white border
        const textX = x + this.polaroidWidth / 2;
        const textY = y + this.borderTop + this.photoSize + (this.borderBottom * 0.6);

        ctx.font = '600 14px "Courier Prime", "Courier New", monospace';
        ctx.fillStyle = '#9B8579';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(dateStr, textX, textY);
    }

    downloadStrip() {
        // Create high quality PNG download
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        link.download = `polaroid-strip-${timestamp}.png`;
        
        // Export at maximum quality
        link.href = this.stripCanvas.toDataURL('image/png', 1.0);
        link.click();
        
        this.setStatus('High quality Polaroid strip downloaded! 📸');
    }

    retake() {
        this.photos = [];
        this.stripCanvas.classList.add('hidden');
        this.stripPlaceholder.classList.remove('hidden');
        this.stripControls.classList.add('hidden');
        this.setStatus('Ready to take new photos!');
    }

    setStatus(message, isError = false) {
        this.status.textContent = message;
        this.status.classList.toggle('error', isError);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Cleanup method
    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }
}

// Initialize the photobooth when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.photobooth = new RetroPhotobooth();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.photobooth) {
        window.photobooth.stop();
    }
});
