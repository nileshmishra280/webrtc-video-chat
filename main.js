import io from 'socket.io-client';

// Dynamically set the Socket.IO server URL
const isProduction = window.location.hostname !== 'localhost';
const socketUrl = isProduction ? window.location.origin.replace('frontend', 'backend') : 'http://localhost:3000';
const socket = io(socketUrl);
let localStream;
let peerConnection;
let iceCandidateQueue = [];
const roomId = new URLSearchParams(window.location.search).get('room') || null;

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

async function startVideo() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
  } catch (error) {
    console.error('Error accessing media devices:', error);
  }
}

document.getElementById('joinButton').addEventListener('click', async () => {
  console.log('Join Room button clicked');
  const roomInput = document.getElementById('roomInput').value;
  if (roomInput) {
    window.location.search = `?room=${roomInput}`;
  } else {
    alert('Please enter a room ID');
  }
});

async function createPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);

  if (localStream) {
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
      document.getElementById('remoteVideo').srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { roomId, candidate: event.candidate });
      }
    };
  } else {
    console.error('localStream is not available');
  }
}

async function processIceCandidates() {
  if (peerConnection && peerConnection.remoteDescription) {
    for (const candidate of iceCandidateQueue) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding queued ICE candidate:', error);
      }
    }
    iceCandidateQueue = [];
  }
}

socket.on('user-connected', async (userId) => {
  await createPeerConnection();
  if (peerConnection) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { roomId, offer });
  }
});

socket.on('offer', async ({ offer, from }) => {
  await createPeerConnection();
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    await processIceCandidates();
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { roomId, answer });
  }
});

socket.on('answer', async ({ answer }) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await processIceCandidates();
  }
});

socket.on('ice-candidate', async ({ candidate }) => {
  try {
    if (peerConnection && peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      console.log('Queuing ICE candidate');
      iceCandidateQueue.push(candidate);
    }
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
});

socket.on('user-disconnected', () => {
  if (peerConnection) {
    peerConnection.close();
    document.getElementById('remoteVideo').srcObject = null;
  }
});

if (roomId) {
  await startVideo();
  if (localStream) {
    socket.emit('join-room', roomId);
  } else {
    console.error('Failed to get local stream, cannot join room');
  }
}