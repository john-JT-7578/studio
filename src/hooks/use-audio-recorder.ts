// src/hooks/use-audio-recorder.ts
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';

type UseAudioRecorderProps = {
  onChunkAvailable: (audioDataUri: string) => void;
  onRecordingStop?: () => void;
  timeslice?: number; // milliseconds, e.g., 2000 for 2-second chunks
};

type AudioRecorderState = {
  isRecording: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
};

export function useAudioRecorder({ 
  onChunkAvailable, 
  onRecordingStop, 
  timeslice = 3000 // Default to 3-second chunks
}: UseAudioRecorderProps): AudioRecorderState {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            const reader = new FileReader();
            reader.onloadend = () => {
              onChunkAvailable(reader.result as string);
            };
            reader.readAsDataURL(event.data);
          }
        };

        mediaRecorderRef.current.onstop = () => {
          setIsRecording(false);
          streamRef.current?.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          if (onRecordingStop) {
            onRecordingStop();
          }
        };
        
        mediaRecorderRef.current.onerror = (event) => {
          const err = event as any; // MediaRecorderErrorEvent might not be fully typed
          let message = 'Audio recording error';
          if (err.error && err.error.name) {
            message = err.error.name;
          } else if (err.type) {
            message = err.type;
          }
          setError(`Recording error: ${message}`);
          setIsRecording(false);
          streamRef.current?.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        };

        mediaRecorderRef.current.start(timeslice);
        setIsRecording(true);
      } catch (err) {
        if (err instanceof Error) {
          setError(`Error accessing microphone: ${err.message}. Please ensure microphone access is allowed.`);
        } else {
          setError('An unknown error occurred while accessing the microphone.');
        }
        setIsRecording(false);
      }
    } else {
      setError('Audio recording is not supported by your browser.');
      setIsRecording(false);
    }
  }, [onChunkAvailable, onRecordingStop, timeslice]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); // This will trigger the 'onstop' event handler
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      // If already stopped but resources might not be released
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsRecording(false); // Ensure state consistency
    }
  }, []);

  // Cleanup effect to stop recording and release media resources on component unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  return {
    isRecording,
    error,
    startRecording,
    stopRecording,
  };
}
