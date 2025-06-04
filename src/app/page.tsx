
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
  | 'processingAudioChunk'
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
  const transcriptRef = useRef(''); // To hold the latest transcript for debounced summarization
  const summarizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Forward declaration for the queue processing function
  const processAudioChunkQueueRef = useRef<() => void>(() => {});


  const {
    isRecording: isCapturing,
    error: recorderError,
    startRecording: startAudioCapture,
    stopRecording: stopAudioCapture
  } = useAudioRecorder({
    onChunkAvailable: (audioDataUri) => {
      if (appStatus === 'error') return; // Don't process if already in error state
      audioChunkQueueRef.current.push(audioDataUri);
      processAudioChunkQueueRef.current();
    },
    onRecordingStop: () => {
      // This will be called when stopAudioCapture() completes or recorder stops naturally
      if (summarizeTimeoutRef.current) {
        clearTimeout(summarizeTimeoutRef.current);
      }
      // Check if there's still audio to process or if summarization is pending
      const checkAndFinalize = () => {
        if (audioChunkQueueRef.current.length === 0 && !isProcessingAudioChunkRef.current) {
          // All chunks processed, perform final summarization if there's transcript
          if (transcriptRef.current.trim() && appStatus !== 'error') {
             handleSummarizeNotes(transcriptRef.current, true); // Final summarization
          } else if (appStatus !== 'error') {
            setAppStatus('idle'); // Nothing to summarize, go to idle
          }
        } else if (appStatus !== 'error') {
          // Still processing audio chunks, wait
          setAppStatus('processingAudioChunk');
          setTimeout(checkAndFinalize, 500); // Check again shortly
        }
      };
      checkAndFinalize();
    },
    timeslice: 10000, // Process audio in 10-second chunks
  });

  // Keep transcriptRef updated for debounced summarization
  useEffect(() => {
    transcriptRef.current = currentTranscript;
  }, [currentTranscript]);


  const handleSummarizeNotes = useCallback(async (transcriptToSummarize: string, isFinal: boolean = false) => {
    if (!transcriptToSummarize.trim() || (appStatus === 'error' && !isFinal)) {
      // If it's a final call and there's no transcript, or if already in error (and not final), set idle
      if (isFinal && !isCapturing && appStatus !== 'error') {
        setAppStatus('idle');
      }
      return;
    }

    // Prevent re-summarizing if already summarizing (unless it's a final call that needs to happen)
    if (appStatus === 'summarizingNotes' && !isFinal) return;

    setAppStatus('summarizingNotes');
    try {
      const input: SummarizeInterviewInput = { transcript: transcriptToSummarize };
      const result = await summarizeInterview(input);
      setCurrentNotes(result.summary);

      // After successful summarization, update status based on recording state
      if (appStatus !== 'error') { // Check error state again, in case it changed during async
        if (isFinal) {
          toast({ title: "Processing Complete", description: "Transcription and notes generation finished."});
          setAppStatus('idle');
        } else if (isCapturing) {
          setAppStatus('capturingAudio'); // If still recording, go back to capturing audio status
        } else {
          // Not final and not capturing (e.g. recording stopped but final processing was ongoing)
          setAppStatus('idle');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred during summarization.";
      console.error("Summarization error:", err);
      setErrorMessage(msg);
      setAppStatus('error'); // Set error state
      toast({ title: "Summarization Error", description: msg, variant: "destructive" });
    }
  }, [toast, appStatus, isCapturing]); // Added appStatus and isCapturing

  // Debounced summarization effect
  useEffect(() => {
    // Only run debounced summarization if recording, there's transcript, and not in error or already summarizing
    if (!isCapturing || !currentTranscript.trim() || appStatus === 'error' || appStatus === 'summarizingNotes') {
      if (summarizeTimeoutRef.current) {
        clearTimeout(summarizeTimeoutRef.current);
      }
      return;
    }

    if (summarizeTimeoutRef.current) {
      clearTimeout(summarizeTimeoutRef.current);
    }

    summarizeTimeoutRef.current = setTimeout(() => {
      // Double-check conditions before calling, as state might change during timeout
      if (isCapturing && currentTranscript.trim() && appStatus !== 'error' && appStatus !== 'summarizingNotes') {
        handleSummarizeNotes(currentTranscript, false); // Intermediate summarization
      }
    }, 7000); // 7-second debounce

    return () => {
      if (summarizeTimeoutRef.current) {
        clearTimeout(summarizeTimeoutRef.current);
      }
    };
  }, [currentTranscript, isCapturing, handleSummarizeNotes, appStatus]); // appStatus added

  const handleChunkTranscription = useCallback(async (audioDataUri: string) => {
    isProcessingAudioChunkRef.current = true;
    // Set status based on whether recording is active or if it's post-recording processing
    if (isCapturing) {
      setAppStatus('capturingAudio'); // Still capturing, but also processing a chunk
    } else {
      setAppStatus('processingAudioChunk'); // Recording stopped, processing remaining chunks
    }

    try {
      const input: TranscribeInterviewInput = { audioDataUri };
      const result = await transcribeInterview(input);
      if (result.transcription) {
        setCurrentTranscript(prev => prev + (prev ? " " : "") + result.transcription);
      } else {
        // Potentially handle empty transcription for a chunk if needed, e.g., log or ignore
        console.warn("Transcription for chunk was empty.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred while processing audio.";
      console.error("Chunk transcription error:", err);
      setErrorMessage(msg);
      setAppStatus('error'); // Set error state
      toast({ title: "Transcription Error", description: msg, variant: "destructive" });
    } finally {
      isProcessingAudioChunkRef.current = false;
      // Process next chunk in queue if any
      processAudioChunkQueueRef.current();
      
      // If recording has stopped and queue is empty, determine next state
      if (!isCapturing && audioChunkQueueRef.current.length === 0) {
        if (appStatus !== 'error' && !transcriptRef.current.trim()) {
           // If no transcript and no error, means recording ended with no speech or after errors cleared
           setAppStatus('idle');
        }
        // If there is transcript, onRecordingStop will handle final summarization or idle state
      } else if (isCapturing && appStatus !== 'error' && appStatus !== 'summarizingNotes') {
        // If still recording and no error/summarization, revert to capturingAudio
        setAppStatus('capturingAudio');
      }
    }
  }, [isCapturing, appStatus, toast]); // appStatus added


  // Memoized function to process the audio chunk queue
  const doProcessAudioChunkQueue = useCallback(() => {
    if (audioChunkQueueRef.current.length > 0 && !isProcessingAudioChunkRef.current && appStatus !== 'error') {
      const chunkToProcess = audioChunkQueueRef.current.shift();
      if (chunkToProcess) {
        handleChunkTranscription(chunkToProcess);
      }
    }
  }, [appStatus, handleChunkTranscription]); // appStatus and handleChunkTranscription added

  // Assign the memoized function to the ref
  useEffect(() => {
    processAudioChunkQueueRef.current = doProcessAudioChunkQueue;
  }, [doProcessAudioChunkQueue]);

  useEffect(() => {
    if (recorderError) {
      setAppStatus('error');
      setErrorMessage(`Recorder error: ${recorderError}`);
      toast({ title: "Recording Error", description: recorderError, variant: "destructive" });
    }
  }, [recorderError, toast]);

  const handleRecordToggle = async () => {
    if (isCapturing) {
      stopAudioCapture();
      // onRecordingStop will handle further state transitions (like final summarization or idle)
    } else {
      // Reset state for a new recording session
      setCurrentTranscript('');
      setCurrentNotes('');
      transcriptRef.current = '';
      audioChunkQueueRef.current = [];
      setErrorMessage(null);
      setAppStatus('capturingAudio'); // Initial status when starting
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
      case 'idle': return 'Ready to record.';
      case 'capturingAudio':
        // More granular message for capturingAudio
        return isProcessingAudioChunkRef.current ? 'Transcribing in real-time...' : 'Listening...';
      case 'processingAudioChunk': return 'Processing final audio...';
      case 'summarizingNotes': return 'Updating notes...';
      case 'error': return `An error occurred. ${errorMessage || 'Please try again.'}`; // Fallback error message
      default: return 'Initializing...'; // Should not happen often
    }
  };
  
  // Determine if the record button should be disabled (e.g., during non-recording processing)
  const isProcessingAnythingNonRecording = 
    (appStatus === 'processingAudioChunk' || appStatus === 'summarizingNotes') && !isCapturing;

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
          Record interviews, get real-time transcriptions, and instant recruiter notes.
        </p>
      </header>

      <section className="w-full max-w-4xl mb-6 p-6 bg-card shadow-lg rounded-xl border">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button
            onClick={handleRecordToggle}
            disabled={isProcessingAnythingNonRecording} // Disable if processing after recording stopped
            className="w-full sm:w-auto min-w-[200px] transition-all duration-150 ease-in-out transform hover:scale-105 text-lg py-3 px-6"
            variant={isCapturing ? "destructive" : "default"}
            size="lg"
          >
            {isCapturing ? <Square className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
            {isCapturing ? 'Stop Recording' : 'Start Recording'}
          </Button>
          <div className={`flex items-center gap-2 text-sm p-3 rounded-md w-full sm:flex-grow justify-center sm:justify-start
            ${appStatus === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'}`}>
            {appStatus === 'capturingAudio' && !isProcessingAudioChunkRef.current && <Mic className="h-5 w-5 text-destructive animate-pulse" />}
            {(appStatus === 'processingAudioChunk' || (appStatus === 'capturingAudio' && isProcessingAudioChunkRef.current)) && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
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
              placeholder="Live transcription of the interview will appear here..."
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
          isParentBusy={isCapturing || appStatus === 'processingAudioChunk'} // Parent is busy if capturing or processing chunks post-recording
        />
      </main>

      <footer className="w-full max-w-4xl mt-12 text-center">
        <p className="text-sm text-muted-foreground">
          Privacy: Audio is processed for transcription. Transcriptions are used for summarization. This application does not permanently store audio files or transcriptions.
        </p>
      </footer>
    </div>
  );
}
    
