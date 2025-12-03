# Retro Photobooth

A cute, vintage-styled photobooth web application that captures photos using your webcam and creates classic photo strips.

**Author:** Shashwat Shah  
**GitHub:** [github.com/Shashwat-09/photobooth](https://github.com/Shashwat-09/photobooth)

## Features

- **Webcam Integration** - Live camera preview with mirror effect
- **Countdown Timer** - 3-second countdown with animated numbers before each shot
- **Photo Strip** - Captures 4 photos and arranges them in a classic vertical strip
- **Vintage Effects** - Sepia tones, vignette, and paper texture for authentic retro look
- **Flash Effect** - Visual flash feedback when photos are captured
- **Download** - Save your photo strip as a PNG file
- **Responsive Design** - Works on desktop and mobile devices

## Getting Started

### Option 1: Open directly
Simply open `index.html` in a modern web browser.

> Note: Some browsers may require a local server for webcam access.

### Option 2: Local server (recommended)
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000` in your browser.

## Usage

1. Click **"Start Camera"** to enable your webcam
2. Allow camera access when prompted
3. Click **"Take Photos"** to begin the photo session
4. Smile! The app will take 4 photos with a 3-second countdown between each
5. View your completed photo strip
6. Click **"Download"** to save or **"Retake"** to try again

## Browser Support

Requires a modern browser with:
- WebRTC/getUserMedia API (for webcam access)
- Canvas API (for image processing)

Tested on:
- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## Technical Details

- **No build step required** - Pure HTML, CSS, and JavaScript
- **No dependencies** - Everything runs client-side
- **Privacy-focused** - Photos never leave your device

## License

MIT License - Copyright (c) 2025 Shashwat Shah

See [LICENSE](LICENSE) for details.

