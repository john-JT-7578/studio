
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
  const transcriptRef = useRef(''); 
  const summarizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Forward declaration for processAudioChunkQueue to resolve circular dependency if wrapped in useCallback
  const processAudioChunkQueueRef = useRef<() => void>(() => {});

  const {
    isRecording: isCapturing, // Renamed from isRecording for clarity in this component
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
      // Ensure any remaining chunks are processed before final summarization
      const checkAndFinalize = () => {
        if (audioChunkQueueRef.current.length === 0 && !isProcessingAudioChunkRef.current) {
          if (transcriptRef.current.trim() && appStatus !== 'error') {
             handleSummarizeNotes(transcriptRef.current, true); // Final summarization
          } else if (appStatus !== 'error') {
            setAppStatus('idle');
          }
        } else if (appStatus !== 'error') {
          setAppStatus('processingAudioChunk'); // Still processing chunks
          setTimeout(checkAndFinalize, 500); // Check again shortly
        }
      };
      checkAndFinalize();
    },
    timeslice: 10000, // Process audio in 10-second chunks
  });

  useEffect(() => {
    transcriptRef.current = currentTranscript;
  }, [currentTranscript]);


  const handleSummarizeNotes = useCallback(async (transcriptToSummarize: string, isFinal: boolean = false) => {
    if (!transcriptToSummarize.trim() || appStatus === 'error') {
      // If it's a final summarization attempt but no transcript, or error state, just go to idle if not capturing
      if (isFinal && !isCapturing && appStatus !== 'error') {
        setAppStatus('idle');
      }
      return;
    }
    
    // Avoid concurrent summarizations unless it's a final one
    if (appStatus === 'summarizingNotes' && !isFinal) return;

    setAppStatus('summarizingNotes');
    try {
      const input: SummarizeInterviewInput = { transcript: transcriptToSummarize };
      const result = await summarizeInterview(input);
      setCurrentNotes(result.summary);

      if (appStatus !== 'error') { // Check appStatus again in case an error occurred during await
        if (isFinal) {
          toast({ title: "처리 완료", description: "전사 및 노트 생성이 완료되었습니다."});
          setAppStatus('idle');
        } else if (isCapturing) { // If still capturing, go back to capturingAudio status
          setAppStatus('capturingAudio');
        } else { // If not capturing and not final, implies it was an intermediate summary after recording stopped
          setAppStatus('idle');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "요약 중 오류가 발생했습니다.";
      console.error("Summarization error:", err);
      setErrorMessage(msg);
      setAppStatus('error');
      toast({ title: "요약 오류", description: msg, variant: "destructive" });
    }
  }, [toast, appStatus, isCapturing]); // Added isCapturing

  // Debounced summarization for real-time notes
  useEffect(() => {
    // Only run if capturing, there's a transcript, not in error, and not already summarizing
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
      // Check conditions again inside timeout, as state might have changed
      if (isCapturing && currentTranscript.trim() && appStatus !== 'error' && appStatus !== 'summarizingNotes') {
        handleSummarizeNotes(currentTranscript, false); // Intermediate summarization
      }
    }, 7000); // Summarize 7 seconds after last transcript update during recording

    return () => {
      if (summarizeTimeoutRef.current) {
        clearTimeout(summarizeTimeoutRef.current);
      }
    };
  }, [currentTranscript, isCapturing, handleSummarizeNotes, appStatus]);


  const handleChunkTranscription = useCallback(async (audioDataUri: string) => {
    isProcessingAudioChunkRef.current = true;
    // Set status based on whether recording is ongoing or if these are trailing chunks
    if (isCapturing) {
      setAppStatus('capturingAudio'); // Indicates recording AND processing a chunk
    } else {
      setAppStatus('processingAudioChunk'); // Indicates processing chunks after recording stopped
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
      const msg = err instanceof Error ? err.message : "음성 파일 처리 중 오류가 발생했습니다.";
      console.error("Chunk transcription error:", err);
      setErrorMessage(msg);
      setAppStatus('error');
      toast({ title: "전사 오류", description: msg, variant: "destructive" });
    } finally {
      isProcessingAudioChunkRef.current = false;
      processAudioChunkQueueRef.current(); // Attempt to process next chunk in queue
      
      // If recording has stopped and queue is empty, move to idle or trigger final summary if transcript exists
      if (!isCapturing && audioChunkQueueRef.current.length === 0) {
        if (appStatus !== 'error' && !transcriptRef.current.trim()) {
           setAppStatus('idle'); // No transcript, go idle.
        }
        // Final summary is handled by onRecordingStop
      } else if (isCapturing && appStatus !== 'error' && appStatus !== 'summarizingNotes') {
        // If still recording, and no error, and not summarizing, ensure status reflects capturing
        setAppStatus('capturingAudio');
      }
    }
  }, [isCapturing, appStatus, toast]);


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
      setErrorMessage(`녹음기 오류: ${recorderError}`);
      toast({ title: "녹음 오류", description: recorderError, variant: "destructive" });
    }
  }, [recorderError, toast]);

  const handleRecordToggle = async () => {
    if (isCapturing) {
      stopAudioCapture(); 
      // onRecordingStop will handle final summarization and status changes
    } else {
      // Reset states for a new recording session
      setCurrentTranscript('');
      setCurrentNotes('');
      transcriptRef.current = '';
      audioChunkQueueRef.current = [];
      setErrorMessage(null);
      setAppStatus('capturingAudio'); // Initial status when starting
      try {
        await startAudioCapture();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "녹음 시작에 실패했습니다.";
        setErrorMessage(msg);
        setAppStatus('error');
        toast({ title: "녹음 시작 오류", description: msg, variant: "destructive" });
      }
    }
  };

  const getStatusMessage = () => {
    if (appStatus === 'error' && errorMessage) return `오류: ${errorMessage}`;
    switch (appStatus) {
      case 'idle': return '녹음 대기 중.';
      case 'capturingAudio':
        return isProcessingAudioChunkRef.current ? '실시간 전사 중...' : '듣는 중...';
      case 'processingAudioChunk': return '최종 음성 처리 중...';
      case 'summarizingNotes': return '노트 업데이트 중...';
      case 'error': return `오류가 발생했습니다. ${errorMessage || '다시 시도해 주세요.'}`;
      default: return '준비 중';
    }
  };
  
  // Determine if any non-recording processing is happening (to disable record button)
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
          인터뷰를 녹음하고, 실시간 전사 및 즉석 채용 담당자 노트를 받아보세요.
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
            {isCapturing ? '녹음 중지' : '녹음 시작'}
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
              <span>인터뷰 전사</span>
              <FileText className="w-6 h-6 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="실시간으로 전사된 인터뷰 내용이 여기에 표시됩니다..."
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
          개인 정보 보호: 오디오는 전사를 위해 처리됩니다. 전사 내용은 요약에 사용됩니다. 이 애플리케이션은 오디오 파일이나 전사 내용을 영구적으로 저장하지 않습니다.
        </p>
      </footer>
    </div>
  );
}
    
