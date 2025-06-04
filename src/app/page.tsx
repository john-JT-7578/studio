
// src/app/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Square, Loader2, AlertCircle, BrainCircuit, FileText } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { transcribeInterview, TranscribeInterviewInput } from '@/ai/flows/transcribe-interview';
import { summarizeInterview, SummarizeInterviewInput } from '@/ai/flows/summarize-interview';
import { SummaryPanel } from '@/components/summary-panel';
import { useToast } from '@/hooks/use-toast';

type AppProcessingStatus = 
  | 'idle' 
  | 'capturingAudio' 
  | 'processingAudioChunk' // Covers transcription of a chunk
  | 'summarizingNotes'
  | 'error';

export default function RecruitAssistPage() {
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentNotes, setCurrentNotes] = useState('');
  const [appStatus, setAppStatus] = useState<AppProcessingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { toast } = useToast();
  
  const audioChunkQueueRef = useRef<string[]>([]);
  const isProcessingAudioChunkRef = useRef(false);
  const summaryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef(''); // To use in setTimeout for summary

  useEffect(() => {
    transcriptRef.current = currentTranscript;
  }, [currentTranscript]);

  const handleChunkTranscription = async (audioDataUri: string) => {
    isProcessingAudioChunkRef.current = true;
    // Keep appStatus as 'capturingAudio' if actively recording, else 'processingAudioChunk'
    // This helps UI reflect ongoing recording better while chunk processes.
    if (isCapturing) {
      setAppStatus('capturingAudio'); 
    } else {
      setAppStatus('processingAudioChunk');
    }

    try {
      const input: TranscribeInterviewInput = { audioDataUri };
      const result = await transcribeInterview(input);
      if (result.transcription) {
        setCurrentTranscript(prev => prev + (prev ? " " : "") + result.transcription);
      } else {
        console.warn("Transcription for chunk was empty.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transcription error for chunk.";
      setErrorMessage(msg);
      setAppStatus('error'); 
      toast({ title: "Transcription Error", description: msg, variant: "destructive" });
    } finally {
      isProcessingAudioChunkRef.current = false;
      processAudioChunkQueue(); 
      // If not recording anymore and queue is empty, set to idle or trigger final summary
      if (!isCapturing && audioChunkQueueRef.current.length === 0) {
        if (transcriptRef.current.trim() && appStatus !== 'error') { // Check appStatus to avoid summarizing on error
           // Final summary handled by onRecordingStop's checkAndFinalize
        } else if (appStatus !== 'error') {
           setAppStatus('idle');
        }
      } else if (isCapturing && appStatus !== 'error') {
        setAppStatus('capturingAudio'); // Ensure it's back to capturing audio if still recording
      }
    }
  };
  
  const processAudioChunkQueue = useCallback(() => {
    if (audioChunkQueueRef.current.length > 0 && !isProcessingAudioChunkRef.current) {
      const chunkToProcess = audioChunkQueueRef.current.shift();
      if (chunkToProcess) {
        handleChunkTranscription(chunkToProcess);
      }
    }
  }, []);

  const { 
    isRecording: isCapturing, 
    error: recorderError, 
    startRecording: startAudioCapture, 
    stopRecording: stopAudioCapture 
  } = useAudioRecorder({
    onChunkAvailable: (audioDataUri) => {
      audioChunkQueueRef.current.push(audioDataUri);
      if (appStatus !== 'error') { // Only process if not in error state
        processAudioChunkQueue();
      }
    },
    onRecordingStop: () => {
      const checkAndFinalize = () => {
        if (audioChunkQueueRef.current.length === 0 && !isProcessingAudioChunkRef.current) {
          if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
          if (transcriptRef.current.trim() && appStatus !== 'error') {
            handleSummarizeNotes(transcriptRef.current, true); 
          } else if (appStatus !== 'error') {
            setAppStatus('idle');
          }
        } else if (appStatus !== 'error') {
          setTimeout(checkAndFinalize, 500); 
        }
      };
      if (appStatus !== 'error') {
        checkAndFinalize();
      } else {
        // If already in error, just ensure UI reflects idle or error state
        if (audioChunkQueueRef.current.length === 0 && !isProcessingAudioChunkRef.current) {
          // No more processing to do. Error state should persist.
        }
      }
    },
    timeslice: 5000, // Process audio in 5-second chunks
  });

  useEffect(() => {
    if (recorderError) {
      setAppStatus('error');
      setErrorMessage(`Recorder error: ${recorderError}`);
      toast({ title: "Recording Error", description: recorderError, variant: "destructive" });
    }
  }, [recorderError, toast]);

  const handleSummarizeNotes = useCallback(async (transcriptToSummarize: string, isFinal: boolean = false) => {
    if (!transcriptToSummarize.trim() || appStatus === 'error') { // Do not summarize if error or empty
      if (isFinal && !isCapturing && appStatus !== 'error') setAppStatus('idle');
      return;
    }
    setAppStatus('summarizingNotes');
    try {
      const input: SummarizeInterviewInput = { transcript: transcriptToSummarize };
      const result = await summarizeInterview(input);
      setCurrentNotes(result.summary);
      if (isFinal && appStatus !== 'error') {
        toast({ title: "Process Complete", description: "Transcription and notes generated."});
        setAppStatus('idle'); 
      } else if (isCapturing && appStatus !== 'error') {
         setAppStatus('capturingAudio'); 
      } else if (appStatus !== 'error') {
         setAppStatus('idle'); 
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Summarization error.";
      setErrorMessage(msg);
      setAppStatus('error');
      toast({ title: "Summarization Error", description: msg, variant: "destructive" });
    }
  }, [toast, isCapturing, appStatus]); // Added appStatus to dependencies

  useEffect(() => {
    if (currentTranscript.trim() && appStatus !== 'error' && (isCapturing || audioChunkQueueRef.current.length > 0 || isProcessingAudioChunkRef.current)) {
      if (summaryTimeoutRef.current) {
        clearTimeout(summaryTimeoutRef.current);
      }
      summaryTimeoutRef.current = setTimeout(() => {
          if(isCapturing && appStatus !== 'error') { // Only summarize if still capturing and no error
               handleSummarizeNotes(transcriptRef.current);
          }
      }, 7000); // Debounce summarization: 7s after last transcript update during recording
    }
    
    return () => {
      if (summaryTimeoutRef.current) {
        clearTimeout(summaryTimeoutRef.current);
      }
    };
  }, [currentTranscript, handleSummarizeNotes, isCapturing, appStatus]); // Added appStatus


  const handleRecordToggle = async () => {
    if (isCapturing) {
      stopAudioCapture();
    } else {
      setCurrentTranscript('');
      setCurrentNotes('');
      transcriptRef.current = '';
      audioChunkQueueRef.current = [];
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
      setErrorMessage(null); // Clear previous errors
      setAppStatus('capturingAudio');
      try {
        await startAudioCapture();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to start recording.";
        setErrorMessage(msg);
        setAppStatus('error');
        toast({ title: "Recording Start Error", description: msg, variant: "destructive" });
      }
    }
  };
  
  const getStatusMessage = () => {
    if (appStatus === 'error' && errorMessage) return `Error: ${errorMessage}`;
    switch (appStatus) {
      case 'idle': return 'Ready to record interview.';
      case 'capturingAudio': 
        return isProcessingAudioChunkRef.current ? 'Recording & Transcribing chunk...' : 'Recording audio... Real-time processing active.';
      case 'processingAudioChunk': return 'Transcribing audio chunk...'; // Should be less visible if isCapturing is true
      case 'summarizingNotes': return 'Updating recruiter notes...';
      case 'error': return `An error occurred. ${errorMessage || 'Please try again.'}`; // Should be handled by the first condition
      default: return 'Standby';
    }
  };
  
  const isProcessingAnythingNonRecording = (appStatus === 'processingAudioChunk' || appStatus === 'summarizingNotes') && !isCapturing;


  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 sm:p-8 bg-background">
      <header className="w-full max-w-4xl mb-8 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start space-x-3 mb-2">
          <BrainCircuit className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-headline font-bold text-foreground">
            RecruitAssist AI
          </h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Record interviews, get real-time transcription, and instant recruiter notes.
        </p>
      </header>

      <section className="w-full max-w-4xl mb-6 p-6 bg-card shadow-lg rounded-xl border">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button
            onClick={handleRecordToggle}
            disabled={isProcessingAnythingNonRecording} 
            className="w-full sm:w-auto min-w-[200px] transition-all duration-150 ease-in-out transform hover:scale-105 text-lg py-3 px-6"
            variant={isCapturing ? "destructive" : "default"}
            size="lg"
          >
            {isCapturing ? <Square className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
            {isCapturing ? 'Stop Recording' : 'Start Recording'}
          </Button>
          <div className={`flex items-center gap-2 text-sm p-3 rounded-md w-full sm:flex-grow justify-center sm:justify-start
            ${appStatus === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'}`}>
            {isCapturing && appStatus === 'capturingAudio' && !isProcessingAudioChunkRef.current && <Mic className="h-5 w-5 text-destructive animate-pulse" />}
            {(appStatus === 'processingAudioChunk' || (isCapturing && isProcessingAudioChunkRef.current)) && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {appStatus === 'summarizingNotes' && <Loader2 className="h-5 w-5 animate-spin text-accent" />}
            {appStatus === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
            <span className="font-medium">{getStatusMessage()}</span>
          </div>
        </div>
      </section>

      <main className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between font-headline text-2xl">
              <span>Interview Transcription</span>
              <FileText className="w-6 h-6 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Your transcribed interview will appear here in real-time..."
              value={currentTranscript}
              readOnly
              className="min-h-[300px] sm:min-h-[400px] text-base bg-background border-2 border-input focus:border-primary rounded-lg p-4 shadow-inner"
              aria-label="Transcription output"
            />
          </CardContent>
        </Card>
        
        <SummaryPanel 
          summaryText={currentNotes}
          isLoading={appStatus === 'summarizingNotes'}
          isParentBusy={isCapturing || appStatus === 'processingAudioChunk'} 
        />
      </main>

      <footer className="w-full max-w-4xl mt-12 text-center">
        <p className="text-sm text-muted-foreground">
          Privacy: Audio is processed for transcription. Transcripts are used for summarization. No audio files or transcripts are permanently stored by this application.
        </p>
      </footer>
    </div>
  );
}
