// src/hooks/use-audio-recorder.ts
"use client";

import { useState, useRef, useCallback } from 'react';

type AudioRecorderState = {
  isRecording: boolean;
  audioDataUri: string | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  mediaRecorder: MediaRecorder | null;
};

export function useAudioRecorder(): AudioRecorderState {
  const [isRecording, setIsRecording] = useState(false);
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioDataUri(null);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // Common type, adjust if needed
          const reader = new FileReader();
          reader.onloadend = () => {
            setAudioDataUri(reader.result as string);
          };
          reader.readAsDataURL(audioBlob);
          stream.getTracks().forEach(track => track.stop()); // Stop microphone access
        };
        
        mediaRecorderRef.current.onerror = (event) => {
          // MediaRecorderErrorEvent is not fully typed in all environments, use 'any'
          const err = event as any;
          let message = 'Audio recording error';
          if (err.error && err.error.message) {
            message = err.error.message;
          } else if (err.name) {
            message = err.name;
          }
          setError(`Recording error: ${message}`);
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
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
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  return {
    isRecording,
    audioDataUri,
    error,
    startRecording,
    stopRecording,
    mediaRecorder: mediaRecorderRef.current,
  };
}
