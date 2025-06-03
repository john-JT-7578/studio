// src/components/summary-panel.tsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { summarizeInterview, SummarizeInterviewInput } from '@/ai/flows/summarize-interview';
import { useToast } from '@/hooks/use-toast';

interface SummaryPanelProps {
  transcript: string;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function SummaryPanel({ transcript, isLoading, setIsLoading }: SummaryPanelProps) {
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<'idle' | 'summarizing' | 'error' | 'success'>('idle');
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Reset summary if transcript changes and panel was not idle
    if (transcript && status !== 'idle') {
      setSummary('');
      setStatus('idle');
      setSummaryError(null);
    }
  }, [transcript, status]);


  const handleGenerateSummary = async () => {
    if (!transcript.trim()) {
      toast({
        title: "Cannot Generate Summary",
        description: "Please provide a transcript first.",
        variant: "destructive",
      });
      return;
    }

    setStatus('summarizing');
    setIsLoading(true);
    setSummaryError(null);
    try {
      const input: SummarizeInterviewInput = { transcript };
      const result = await summarizeInterview(input);
      if (result.summary) {
        setSummary(result.summary);
        setStatus('success');
        toast({
          title: "Summary Generated",
          description: "Recruiter notes are ready.",
        });
      } else {
        throw new Error("Summarization result was empty.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during summarization.";
      setSummaryError(errorMessage);
      setStatus('error');
      toast({
        title: "Summarization Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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

  const getStatusMessage = () => {
    switch (status) {
      case 'idle': return 'Ready to summarize';
      case 'summarizing': return 'Generating summary...';
      case 'error': return `Error: ${summaryError || 'Unknown error'}`;
      case 'success': return 'Summary generated successfully';
      default: return 'Status unknown';
    }
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
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button
            onClick={handleGenerateSummary}
            disabled={!transcript.trim() || isLoading || status === 'summarizing'}
            className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground min-w-[180px] transition-all duration-150 ease-in-out transform hover:scale-105"
            aria-live="polite"
            aria-label="Generate summary"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Generate Summary
          </Button>
           <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-secondary rounded-md w-full sm:w-auto justify-center">
            {status === 'summarizing' || (isLoading && status !== 'idle') ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : null}
            {status === 'error' ? <AlertCircle className="h-5 w-5 text-destructive" /> : null}
            <span>{getStatusMessage()}</span>
          </div>
        </div>

        <Textarea
          placeholder="Structured recruiter notes will appear here..."
          value={summary}
          readOnly
          className="min-h-[200px] sm:min-h-[300px] text-base bg-background border-2 border-input focus:border-primary rounded-lg p-4 shadow-inner"
          aria-label="Summary output"
        />
        <Button
          onClick={handleExportSummary}
          disabled={!summary.trim() || isLoading}
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
