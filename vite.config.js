import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [],
  server: {
    allowedHosts: [
      'webrtc-video-chat-frontend.onrender.com',
      'webrtc-video-chat-backend.onrender.com',
      'localhost' // Optional: Keep localhost for development
    ]
  }
});