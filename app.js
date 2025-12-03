/* =============================================
   RETRO PHOTOBOOTH - Main Application Logic
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

        // Photo strip dimensions
        this.photoWidth = 180;
        this.photoHeight = 135;
        this.stripPadding = 15;
        this.photoBorder = 8;
        this.photoGap = 10;

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
            this.setStatus('Requesting camera access...');
            this.startBtn.disabled = true;

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });

            this.webcam.srcObject = this.stream;
            await this.webcam.play();

            this.startBtn.classList.add('hidden');
            this.captureBtn.classList.remove('hidden');
            this.setStatus('Camera ready! Click "Take Photos" to begin.');

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
            
            // Capture photo
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
        
        this.setStatus('Photos captured! Creating your strip...');
        
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
        const canvas = document.createElement('canvas');
        canvas.width = this.webcam.videoWidth;
        canvas.height = this.webcam.videoHeight;
        
        const ctx = canvas.getContext('2d');
        
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
        const ctx = this.stripCanvas.getContext('2d');
        
        // Calculate strip dimensions
        const totalPhotoHeight = this.photoHeight + (this.photoBorder * 2);
        const stripWidth = this.photoWidth + (this.stripPadding * 2) + (this.photoBorder * 2);
        const stripHeight = (totalPhotoHeight * this.photosToCapture) + 
                           (this.photoGap * (this.photosToCapture - 1)) + 
                           (this.stripPadding * 2) + 40; // Extra space for date

        this.stripCanvas.width = stripWidth;
        this.stripCanvas.height = stripHeight;

        // Fill with off-white background (like real photo paper)
        ctx.fillStyle = '#FEFCF9';
        ctx.fillRect(0, 0, stripWidth, stripHeight);

        // Add subtle paper texture
        this.addPaperTexture(ctx, stripWidth, stripHeight);

        // Draw each photo
        this.photos.forEach((photoCanvas, index) => {
            const x = this.stripPadding;
            const y = this.stripPadding + (index * (totalPhotoHeight + this.photoGap));
            
            // Draw white border
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x, y, this.photoWidth + (this.photoBorder * 2), totalPhotoHeight);
            
            // Draw photo with vintage effect
            this.drawVintagePhoto(ctx, photoCanvas, x + this.photoBorder, y + this.photoBorder);
        });

        // Add date stamp
        this.addDateStamp(ctx, stripWidth, stripHeight);

        // Show the strip
        this.stripCanvas.classList.remove('hidden');
        this.stripPlaceholder.classList.add('hidden');
        this.stripControls.classList.remove('hidden');
        
        this.setStatus('Your photo strip is ready!');
    }

    drawVintagePhoto(ctx, sourceCanvas, x, y) {
        // Create temporary canvas for effects
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.photoWidth;
        tempCanvas.height = this.photoHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw scaled photo
        tempCtx.drawImage(
            sourceCanvas,
            0, 0, sourceCanvas.width, sourceCanvas.height,
            0, 0, this.photoWidth, this.photoHeight
        );

        // Apply vintage color effect
        const imageData = tempCtx.getImageData(0, 0, this.photoWidth, this.photoHeight);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            // Slight sepia tone
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            data[i] = Math.min(255, r * 1.05 + 20);      // Red
            data[i + 1] = Math.min(255, g * 1.02 + 10);  // Green
            data[i + 2] = Math.min(255, b * 0.95);       // Blue (reduced)
        }

        tempCtx.putImageData(imageData, 0, 0);

        // Add subtle vignette
        const gradient = tempCtx.createRadialGradient(
            this.photoWidth / 2, this.photoHeight / 2, this.photoHeight * 0.3,
            this.photoWidth / 2, this.photoHeight / 2, this.photoHeight * 0.8
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
        
        tempCtx.fillStyle = gradient;
        tempCtx.fillRect(0, 0, this.photoWidth, this.photoHeight);

        // Draw to main canvas
        ctx.drawImage(tempCanvas, x, y);
    }

    addPaperTexture(ctx, width, height) {
        // Add very subtle noise for paper texture
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 8;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }

        ctx.putImageData(imageData, 0, 0);
    }

    addDateStamp(ctx, width, height) {
        const date = new Date();
        const dateStr = date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        }).replace(/\//g, ' . ');

        ctx.font = '12px "Courier Prime", monospace';
        ctx.fillStyle = '#8B4513';
        ctx.textAlign = 'center';
        ctx.fillText(dateStr, width / 2, height - 15);
    }

    downloadStrip() {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        link.download = `photobooth-strip-${timestamp}.png`;
        link.href = this.stripCanvas.toDataURL('image/png');
        link.click();
        
        this.setStatus('Photo strip downloaded!');
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

