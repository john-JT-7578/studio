
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

const MIN_TRANSCRIPT_LENGTH_FOR_SUMMARY = 30; // Characters

export default function RecruitAssistPage() {
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentNotes, setCurrentNotes] = useState("Recruiter notes will appear here once enough content is transcribed.");
  const [appStatus, setAppStatus] = useState<AppProcessingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { toast } = useToast();

  const audioChunkQueueRef = useRef<string[]>([]);
  const isProcessingAudioChunkRef = useRef(false);
  const transcriptRef = useRef(''); 
  const summarizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processAudioChunkQueueRef = useRef<() => void>(() => {});

  const {
    isRecording: isCapturing,
    error: recorderError,
    startRecording: startAudioCapture,
    stopRecording: stopAudioCapture
  } = useAudioRecorder({
    onChunkAvailable: (audioDataUri) => {
      if (appStatus === 'error') return; 
      audioChunkQueueRef.current.push(audioDataUri);
      processAudioChunkQueueRef.current();
    },
    onRecordingStop: () => {
      if (summarizeTimeoutRef.current) {
        clearTimeout(summarizeTimeoutRef.current);
      }
      const checkAndFinalize = () => {
        if (audioChunkQueueRef.current.length === 0 && !isProcessingAudioChunkRef.current) {
          if (transcriptRef.current.trim().length >= MIN_TRANSCRIPT_LENGTH_FOR_SUMMARY && appStatus !== 'error') {
             handleSummarizeNotes(transcriptRef.current, true); 
          } else if (appStatus !== 'error') {
            if (!transcriptRef.current.trim()) {
                setCurrentNotes("Recruiter notes will appear here once enough content is transcribed.");
            }
            setAppStatus('idle'); 
          }
        } else if (appStatus !== 'error') {
          setAppStatus('processingAudioChunk');
          setTimeout(checkAndFinalize, 500); 
        }
      };
      checkAndFinalize();
    },
    timeslice: 10000, 
  });

  useEffect(() => {
    transcriptRef.current = currentTranscript;
  }, [currentTranscript]);

  const handleSummarizeNotes = useCallback(async (transcriptToSummarize: string, isFinal: boolean = false) => {
    if (transcriptToSummarize.trim().length < MIN_TRANSCRIPT_LENGTH_FOR_SUMMARY) {
      if (isFinal && !isCapturing && appStatus !== 'error') {
        setCurrentNotes("Not enough content to summarize. Try recording a longer interview.");
        setAppStatus('idle');
      } else if (!isFinal && appStatus !== 'summarizingNotes') {
        // For intermediate summaries, if content is too short, show placeholder
        setCurrentNotes("Waiting for more meaningful content to summarize.");
      }
      return;
    }

    if (appStatus === 'summarizingNotes' && !isFinal) return;
    if (appStatus === 'error' && !isFinal) return;


    setAppStatus('summarizingNotes');
    try {
      const input: SummarizeInterviewInput = { transcript: transcriptToSummarize };
      const result = await summarizeInterview(input);
      setCurrentNotes(result.summary);

      if (appStatus !== 'error') { 
        if (isFinal) {
          toast({ title: "Processing Complete", description: "Transcription and notes generation finished."});
          setAppStatus('idle');
        } else if (isCapturing) {
          setAppStatus('capturingAudio'); 
        } else {
          setAppStatus('idle');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred during summarization.";
      console.error("Summarization error:", err);
      setErrorMessage(msg);
      setAppStatus('error'); 
      toast({ title: "Summarization Error", description: msg, variant: "destructive" });
    }
  }, [toast, appStatus, isCapturing]); 

  useEffect(() => {
    if (!isCapturing || !currentTranscript.trim() || appStatus === 'error' || appStatus === 'summarizingNotes') {
      if (summarizeTimeoutRef.current) {
        clearTimeout(summarizeTimeoutRef.current);
      }
      return;
    }
    
    if (currentTranscript.trim().length < MIN_TRANSCRIPT_LENGTH_FOR_SUMMARY) {
      if (summarizeTimeoutRef.current) {
        clearTimeout(summarizeTimeoutRef.current);
      }
      // Optionally update notes to indicate waiting for more content if not already summarizing
      if (appStatus !== 'summarizingNotes') {
        setCurrentNotes("Waiting for more meaningful content to summarize.");
      }
      return;
    }


    if (summarizeTimeoutRef.current) {
      clearTimeout(summarizeTimeoutRef.current);
    }

    summarizeTimeoutRef.current = setTimeout(() => {
      if (isCapturing && currentTranscript.trim().length >= MIN_TRANSCRIPT_LENGTH_FOR_SUMMARY && appStatus !== 'error' && appStatus !== 'summarizingNotes') {
        handleSummarizeNotes(currentTranscript, false); 
      }
    }, 7000); 

    return () => {
      if (summarizeTimeoutRef.current) {
        clearTimeout(summarizeTimeoutRef.current);
      }
    };
  }, [currentTranscript, isCapturing, handleSummarizeNotes, appStatus]); 

  const handleChunkTranscription = useCallback(async (audioDataUri: string) => {
    isProcessingAudioChunkRef.current = true;
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
      const msg = err instanceof Error ? err.message : "An error occurred while processing audio.";
      console.error("Chunk transcription error:", err);
      setErrorMessage(msg);
      setAppStatus('error'); 
      toast({ title: "Transcription Error", description: msg, variant: "destructive" });
    } finally {
      isProcessingAudioChunkRef.current = false;
      processAudioChunkQueueRef.current();
      
      if (!isCapturing && audioChunkQueueRef.current.length === 0) {
        if (appStatus !== 'error' && !transcriptRef.current.trim()) {
           setAppStatus('idle');
        }
      } else if (isCapturing && appStatus !== 'error' && appStatus !== 'summarizingNotes') {
        setAppStatus('capturingAudio');
      }
    }
  }, [isCapturing, appStatus, toast, processAudioChunkQueueRef]); 


  const doProcessAudioChunkQueue = useCallback(() => {
    if (audioChunkQueueRef.current.length > 0 && !isProcessingAudioChunkRef.current && appStatus !== 'error') {
      const chunkToProcess = audioChunkQueueRef.current.shift();
      if (chunkToProcess) {
        handleChunkTranscription(chunkToProcess);
      }
    }
  }, [appStatus, handleChunkTranscription]); 

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
    } else {
      setCurrentTranscript('');
      setCurrentNotes("Recruiter notes will appear here once enough content is transcribed.");
      transcriptRef.current = '';
      audioChunkQueueRef.current = [];
      setErrorMessage(null);
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
      case 'idle': return 'Ready to record.';
      case 'capturingAudio':
        return isProcessingAudioChunkRef.current ? 'Transcribing in real-time...' : 'Listening...';
      case 'processingAudioChunk': return 'Processing final audio...';
      case 'summarizingNotes': return 'Updating notes...';
      case 'error': return `An error occurred. ${errorMessage || 'Please try again.'}`; 
      default: return 'Initializing...'; 
    }
  };
  
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
            {appStatus === 'capturingAudio' && !isProcessingAudioChunkRef.current && <Mic className="h-5 w-5 text-primary animate-pulse" />}
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
          isParentBusy={isCapturing || appStatus === 'processingAudioChunk'} 
        />
      </main>

      <footer className="w-full max-w-4xl mt-12 text-center">
        <p className="text-sm text-muted-foreground">
          Privacy: Audio is processed for transcription. Transcriptions are used for summarization. This application does not permanently store audio files or transcriptions.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
            Note: AI transcription and summarization may not be 100% accurate.
        </p>
      </footer>
    </div>
  );
}
