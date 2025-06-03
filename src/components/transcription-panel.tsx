// src/components/transcription-panel.tsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Square, Loader2, AlertCircle, FileText } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { transcribeInterview, TranscribeInterviewInput } from '@/ai/flows/transcribe-interview';
import { useToast } from '@/hooks/use-toast';

interface TranscriptionPanelProps {
  onTranscriptionComplete: (transcript: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function TranscriptionPanel({ onTranscriptionComplete, isLoading, setIsLoading }: TranscriptionPanelProps) {
  const { isRecording, audioDataUri, error: recorderError, startRecording, stopRecording } = useAudioRecorder();
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing' | 'error' | 'success'>('idle');
  const [transcript, setTranscript] = useState('');
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (recorderError) {
      setStatus('error');
      setTranscriptionError(recorderError);
      toast({
        title: "Recording Error",
        description: recorderError,
        variant: "destructive",
      });
    }
  }, [recorderError, toast]);

  useEffect(() => {
    if (audioDataUri && status !== 'transcribing' && !isRecording) { // Ensure we only transcribe once after stopping
      const processTranscription = async () => {
        setStatus('transcribing');
        setIsLoading(true);
        setTranscriptionError(null);
        try {
          const input: TranscribeInterviewInput = { audioDataUri };
          const result = await transcribeInterview(input);
          if (result.transcription) {
            setTranscript(result.transcription);
            onTranscriptionComplete(result.transcription);
            setStatus('success');
            toast({
              title: "Transcription Complete",
              description: "The interview has been transcribed.",
            });
          } else {
            throw new Error("Transcription result was empty.");
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during transcription.";
          setTranscriptionError(errorMessage);
          setStatus('error');
          toast({
            title: "Transcription Error",
            description: errorMessage,
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      };
      processTranscription();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioDataUri, onTranscriptionComplete, setIsLoading, toast, isRecording]); // Removed 'status' to prevent re-triggering

  const handleRecordToggle = async () => {
    if (isRecording) {
      stopRecording();
      // Transcription process will start via useEffect on audioDataUri change
    } else {
      setTranscript(''); // Clear previous transcript
      onTranscriptionComplete(''); // Clear transcript in parent
      setTranscriptionError(null);
      setStatus('recording');
      await startRecording();
    }
  };
  
  const getStatusMessage = () => {
    switch (status) {
      case 'idle': return 'Ready to record';
      case 'recording': return 'Recording audio...';
      case 'transcribing': return 'Transcribing audio...';
      case 'error': return `Error: ${transcriptionError || recorderError || 'Unknown error'}`;
      case 'success': return 'Transcription complete';
      default: return 'Status unknown';
    }
  };

  return (
    <Card className="w-full shadow-lg rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-headline text-2xl">
          <span>Interview Transcription</span>
          <FileText className="w-6 h-6 text-primary" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button
            onClick={handleRecordToggle}
            disabled={isLoading || status === 'transcribing'}
            className="w-full sm:w-auto min-w-[180px] transition-all duration-150 ease-in-out transform hover:scale-105"
            variant={isRecording ? "destructive" : "default"}
            aria-live="polite"
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? <Square className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-secondary rounded-md w-full sm:w-auto justify-center">
            {status === 'transcribing' || isLoading && status !== 'recording' ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : null}
            {status === 'error' ? <AlertCircle className="h-5 w-5 text-destructive" /> : null}
            <span>{getStatusMessage()}</span>
          </div>
        </div>

        <Textarea
          placeholder="Your transcribed interview will appear here..."
          value={transcript}
          readOnly
          className="min-h-[200px] sm:min-h-[300px] text-base bg-background border-2 border-input focus:border-primary rounded-lg p-4 shadow-inner"
          aria-label="Transcription output"
        />
      </CardContent>
    </Card>
  );
}
