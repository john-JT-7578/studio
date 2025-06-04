// src/components/summary-panel.tsx
"use client";

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SummaryPanelProps {
  summaryText: string;
  isLoading: boolean;
  isParentBusy?: boolean; 
}

export function SummaryPanel({ summaryText, isLoading, isParentBusy = false }: SummaryPanelProps) {
  const { toast } = useToast();

  const handleExportSummary = () => {
    if (!summaryText.trim()) {
      toast({
        title: "Cannot Export Summary",
        description: "There is no summary content to export.",
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
      description: "The file recruiter_notes.txt has been downloaded.",
    });
  };
  
  return (
    <Card className="w-full shadow-lg rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-headline text-2xl">
          <span>Recruiter Notes</span>
          {isLoading ? <Loader2 className="w-6 h-6 text-accent animate-spin" /> : <Sparkles className="w-6 h-6 text-accent" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
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
