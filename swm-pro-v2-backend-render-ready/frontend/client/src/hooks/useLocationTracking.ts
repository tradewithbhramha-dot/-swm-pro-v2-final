import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

interface UseLocationTrackingOptions {
  enabled?: boolean;
  updateInterval?: number; // milliseconds
  onLocationUpdate?: (location: LocationData) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for real-time GPS location tracking
 * Sends location updates to WebSocket server
 */

export function useLocationTracking(options: UseLocationTrackingOptions = {}) {
  const {
    enabled = false,
    updateInterval = 5000, // 5 seconds default
    onLocationUpdate,
    onError,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem("auth_token");
    const userId = localStorage.getItem("user_id");

    if (!token || !userId) {
      const err = new Error("Authentication required");
      setError(err);
      onError?.(err);
      return;
    }

    // Connect to WebSocket
    socketRef.current = io(window.location.origin, {
      auth: {
        userId: parseInt(userId),
        token,
      },
    });

    socketRef.current.on("connect", () => {
      console.log("[LocationTracking] Connected to server");
    });

    socketRef.current.on("error", (err) => {
      console.error("[LocationTracking] Socket error:", err);
      setError(new Error(err));
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [enabled, onError]);

  // Start GPS tracking
  const startTracking = () => {
    if (!navigator.geolocation) {
      const err = new Error("Geolocation not supported");
      setError(err);
      onError?.(err);
      return;
    }

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          speed: position.coords.speed || undefined,
          heading: position.coords.heading || undefined,
        };

        setLocation(locationData);
        setError(null);
        onLocationUpdate?.(locationData);

        // Send to server via WebSocket
        if (socketRef.current?.connected) {
          socketRef.current.emit("location:update", locationData);
        }
      },
      (err) => {
        console.error("[LocationTracking] Geolocation error:", err);
        const error = new Error(err.message);
        setError(error);
        onError?.(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    setIsTracking(true);
  };

  // Stop GPS tracking
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  };

  // Emit task start event
  const startTask = (taskId: number, moduleType: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("task:start", { taskId, moduleType });
    }
  };

  // Emit task completion event
  const completeTask = (taskId: number, duration: number, distance: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("task:complete", { taskId, duration, distance });
    }
  };

  // Update worker status
  const updateStatus = (status: "online" | "offline" | "idle") => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("worker:status", status);
    }
  };

  return {
    location,
    isTracking,
    error,
    startTracking,
    stopTracking,
    startTask,
    completeTask,
    updateStatus,
  };
}
