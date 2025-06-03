// src/components/summary-panel.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { summarizeInterview, SummarizeInterviewInput } from '@/ai/flows/summarize-interview';
import { useToast } from '@/hooks/use-toast';

interface SummaryPanelProps {
  transcript: string;
  onSummarizationStatusChange: (status: 'summarizing' | 'error' | 'success', errorMsg?: string) => void;
  isParentBusy?: boolean; // To disable export button if parent is recording or transcribing
}

export function SummaryPanel({ transcript, onSummarizationStatusChange, isParentBusy = false }: SummaryPanelProps) {
  const [summary, setSummary] = useState('');
  const [internalStatus, setInternalStatus] = useState<'idle' | 'summarizing' | 'error' | 'success'>('idle');
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerateSummary = useCallback(async (currentTranscript: string) => {
    if (!currentTranscript.trim()) {
      // This case should ideally be handled by the parent not calling if transcript is empty
      // but as a safeguard:
      setInternalStatus('idle');
      onSummarizationStatusChange('idle' as any); // Or handle idle state if defined in parent
      return;
    }

    setInternalStatus('summarizing');
    onSummarizationStatusChange('summarizing');
    setSummaryError(null);
    setSummary(''); // Clear previous summary

    try {
      const input: SummarizeInterviewInput = { transcript: currentTranscript };
      const result = await summarizeInterview(input);
      if (result.summary) {
        setSummary(result.summary);
        setInternalStatus('success');
        onSummarizationStatusChange('success');
        // Toast is now handled by parent page for overall process completion
      } else {
        throw new Error("Summarization result was empty.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during summarization.";
      setSummaryError(errorMessage);
      setInternalStatus('error');
      onSummarizationStatusChange('error', errorMessage);
      toast({ // Still show specific error toast from here
        title: "Summarization Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [onSummarizationStatusChange, toast]);

  useEffect(() => {
    if (transcript.trim()) {
      // Only trigger if transcript is non-empty and different from what might have caused previous summary
      // The parent component `page.tsx` now controls when to start summarizing by changing `appStatus`
      // which in turn calls `onSummarizationStatusChange('summarizing')`
      // This useEffect will call handleGenerateSummary when `transcript` effectively changes.
      handleGenerateSummary(transcript);
    } else {
      // If transcript becomes empty (e.g. new recording started), reset summary panel
      setSummary('');
      setInternalStatus('idle');
      setSummaryError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]); // Reacts to transcript changes

  const handleExportSummary = () => {
    if (!summary.trim()) {
      toast({
        title: "Cannot Export Summary",
        description: "Please generate a summary first.",
        variant: "destructive",
      });
      return;
    }
    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'recruiter_notes.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast({
      title: "Summary Exported",
      description: "recruiter_notes.txt has been downloaded.",
    });
  };
  
  const getStatusMessageForPanel = () => {
    if (internalStatus === 'idle' && !transcript.trim()) return 'Waiting for transcription...';
    if (internalStatus === 'idle' && transcript.trim()) return 'Ready to summarize. (Auto-starts)';
    if (internalStatus === 'summarizing') return 'Generating summary...';
    if (internalStatus === 'error') return `Error: ${summaryError || 'Unknown error'}`;
    if (internalStatus === 'success') return 'Summary generated successfully.';
    return 'Standby';
  };

  return (
    <Card className="w-full shadow-lg rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-headline text-2xl">
          <span>Recruiter Notes</span>
          <Sparkles className="w-6 h-6 text-accent" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
         <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-secondary rounded-md w-full justify-center">
            {internalStatus === 'summarizing' ? <Loader2 className="h-5 w-5 animate-spin text-accent" /> : null}
            {internalStatus === 'error' ? <AlertCircle className="h-5 w-5 text-destructive" /> : null}
            <span>{getStatusMessageForPanel()}</span>
          </div>

        <Textarea
          placeholder="Structured recruiter notes will appear here after transcription and summarization..."
          value={summary}
          readOnly
          className="min-h-[200px] sm:min-h-[300px] text-base bg-background border-2 border-input focus:border-primary rounded-lg p-4 shadow-inner"
          aria-label="Summary output"
        />
        <Button
          onClick={handleExportSummary}
          disabled={!summary.trim() || internalStatus === 'summarizing' || isParentBusy}
          variant="outline"
          className="w-full sm:w-auto min-w-[180px] transition-all duration-150 ease-in-out transform hover:scale-105"
          aria-label="Export summary as TXT file"
        >
          <Download className="mr-2 h-5 w-5" />
          Export Summary (TXT)
        </Button>
      </CardContent>
    </Card>
  );
}
