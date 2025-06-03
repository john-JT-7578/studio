// src/app/page.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Square, Loader2, AlertCircle, BrainCircuit, FileText, Sparkles } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { transcribeInterview, TranscribeInterviewInput } from '@/ai/flows/transcribe-interview';
import { SummaryPanel } from '@/components/summary-panel';
import { useToast } from '@/hooks/use-toast';

type AppStatus = 'idle' | 'recording' | 'transcribing' | 'summarizing' | 'error' | 'success';

export default function RecruitAssistPage() {
  const { 
    isRecording: actualIsRecording, 
    audioDataUri, 
    error: recorderError, 
    startRecording, 
    stopRecording 
  } = useAudioRecorder();
  
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [appStatus, setAppStatus] = useState<AppStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (recorderError) {
      setAppStatus('error');
      setErrorMessage(`Recorder error: ${recorderError}`);
      toast({
        title: "Recording Error",
        description: recorderError,
        variant: "destructive",
      });
    }
  }, [recorderError, toast]);

  const handleRecordToggle = async () => {
    setErrorMessage(null);
    if (actualIsRecording) {
      stopRecording();
      // Transcription will be triggered by useEffect watching audioDataUri
    } else {
      setCurrentTranscript('');
      setAppStatus('recording');
      try {
        await startRecording();
      } catch (err) {
        setAppStatus('error');
        const msg = err instanceof Error ? err.message : "Failed to start recording.";
        setErrorMessage(msg);
        toast({ title: "Recording Start Error", description: msg, variant: "destructive" });
      }
    }
  };

  useEffect(() => {
    if (audioDataUri && !actualIsRecording && appStatus === 'recording') {
      // This means recording has just stopped and audio is ready.
      const processTranscription = async () => {
        setAppStatus('transcribing');
        setErrorMessage(null);
        try {
          const input: TranscribeInterviewInput = { audioDataUri };
          const result = await transcribeInterview(input);
          if (result.transcription) {
            setCurrentTranscript(result.transcription);
            setAppStatus('summarizing'); // Will trigger SummaryPanel
            toast({
              title: "Transcription Complete",
              description: "Now summarizing the transcript.",
            });
          } else {
            throw new Error("Transcription result was empty.");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "An unknown error occurred during transcription.";
          setErrorMessage(msg);
          setAppStatus('error');
          toast({
            title: "Transcription Error",
            description: msg,
            variant: "destructive",
          });
        }
      };
      processTranscription();
    }
  }, [audioDataUri, actualIsRecording, appStatus, toast]);

  const handleSummarizationStatusChange = useCallback((status: 'summarizing' | 'error' | 'success', errorMsg?: string) => {
    if (status === 'summarizing') {
      setAppStatus('summarizing');
      setErrorMessage(null);
    } else if (status === 'success') {
      setAppStatus('success');
      setErrorMessage(null);
      toast({
        title: "Summarization Complete",
        description: "Recruiter notes are ready and displayed.",
      });
    } else if (status === 'error') {
      setAppStatus('error');
      setErrorMessage(errorMsg || "An unknown error occurred during summarization.");
    }
  }, [toast]);

  const getStatusMessage = () => {
    if (errorMessage) return `Error: ${errorMessage}`;
    switch (appStatus) {
      case 'idle': return 'Ready to record interview.';
      case 'recording': return 'Recording audio... Speak clearly.';
      case 'transcribing': return 'Transcribing audio... Please wait.';
      case 'summarizing': return 'Generating summary... This may take a moment.';
      case 'success': return 'Process complete. Transcript and summary are ready.';
      case 'error': return `An error occurred. ${errorMessage || 'Please try again.'}`; // Should be covered by if(errorMessage)
      default: return 'Standby';
    }
  };
  
  const isProcessing = appStatus === 'transcribing' || appStatus === 'summarizing';

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
            disabled={isProcessing}
            className="w-full sm:w-auto min-w-[200px] transition-all duration-150 ease-in-out transform hover:scale-105 text-lg py-3 px-6"
            variant={actualIsRecording ? "destructive" : "default"}
            size="lg"
          >
            {actualIsRecording ? <Square className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
            {actualIsRecording ? 'Stop Recording' : 'Start Recording'}
          </Button>
          <div className={`flex items-center gap-2 text-sm p-3 rounded-md w-full sm:flex-grow justify-center sm:justify-start
            ${appStatus === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'}`}>
            {appStatus === 'recording' && <Mic className="h-5 w-5 text-destructive animate-pulse" />}
            {appStatus === 'transcribing' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {appStatus === 'summarizing' && <Loader2 className="h-5 w-5 animate-spin text-accent" />}
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
              placeholder="Your transcribed interview will appear here after recording..."
              value={currentTranscript}
              readOnly
              className="min-h-[300px] sm:min-h-[400px] text-base bg-background border-2 border-input focus:border-primary rounded-lg p-4 shadow-inner"
              aria-label="Transcription output"
            />
          </CardContent>
        </Card>
        
        <SummaryPanel 
          transcript={currentTranscript}
          onSummarizationStatusChange={handleSummarizationStatusChange}
          isParentBusy={isProcessing || actualIsRecording} 
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

