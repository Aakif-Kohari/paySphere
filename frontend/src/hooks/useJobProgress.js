import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api'; // assuming standard axio instance for baseURL

export function useJobProgress(jobType) {
  const [progress, setProgress] = useState({ percent: 0, status: 'idle', message: '' });
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Assuming backend is running on the same URL or API base URL
    const backendUrl = api.defaults.baseURL || 'http://localhost:5000';
    const newSocket = io(backendUrl, {
      withCredentials: true,
      autoConnect: false
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const startJob = useCallback((data) => {
    if (!socket) return;
    
    socket.connect();
    
    // Reset state
    setProgress({ percent: 0, status: 'starting', message: 'Initializing job...' });
    
    // Listen for progress updates
    socket.on('jobProgress', (data) => {
      if (data.jobType === jobType) {
        setProgress({
          percent: data.percent,
          status: data.status,
          message: data.message
        });
        
        if (data.status === 'completed' || data.status === 'error') {
          socket.disconnect();
        }
      }
    });

    // Start the job
    socket.emit('startJob', { jobType, data });
  }, [socket, jobType]);

  return { progress, startJob, socket };
}
