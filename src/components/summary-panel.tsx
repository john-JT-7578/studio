// src/components/summary-panel.tsx
"use client";

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SummaryPanelProps {
  summaryText: string;
  isLoading: boolean;
  isParentBusy?: boolean; // To disable export button if parent is recording or transcribing chunks
}

export function SummaryPanel({ summaryText, isLoading, isParentBusy = false }: SummaryPanelProps) {
  const { toast } = useToast();

  const handleExportSummary = () => {
    if (!summaryText.trim()) {
      toast({
        title: "Cannot Export Summary",
        description: "No summary available to export.",
        variant: "destructive",
      });
      return;
    }
    const blob = new Blob([summaryText], { type: 'text/plain;charset=utf-8' });
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
    if (isLoading) return 'Updating recruiter notes...';
    if (!summaryText.trim() && !isParentBusy && !isLoading) return 'Recruiter notes will appear here.';
    if (summaryText.trim() && !isLoading) return 'Notes updated.';
    if (isParentBusy && !isLoading) return 'Waiting for transcription to provide more content for notes...';
    return 'Standby for notes.';
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
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-accent" /> : null}
            {/* Add AlertCircle for error if specific error state is passed */}
            <span>{getStatusMessageForPanel()}</span>
          </div>

        <Textarea
          placeholder="Structured recruiter notes will appear here in real-time..."
          value={summaryText}
          readOnly
          className="min-h-[200px] sm:min-h-[300px] text-base bg-background border-2 border-input focus:border-primary rounded-lg p-4 shadow-inner"
          aria-label="Summary output"
        />
        <Button
          onClick={handleExportSummary}
          disabled={!summaryText.trim() || isLoading || isParentBusy}
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
