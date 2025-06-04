// src/components/summary-panel.tsx
"use client";

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Sparkles, Loader2 } from 'lucide-react'; // Removed AlertCircle as error state is handled globally
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
        title: "요약 내보내기 불가",
        description: "내보낼 요약 내용이 없습니다.",
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
      title: "요약 내보내기 완료",
      description: "recruiter_notes.txt 파일이 다운로드되었습니다.",
    });
  };
  
  const getStatusMessageForPanel = () => {
    if (isLoading) return '노트 업데이트 중...';
    if (summaryText.trim() && !isLoading) return '노트 업데이트 완료.';
    if (isParentBusy && !isLoading && !summaryText.trim()) return '전사 내용을 기다리는 중...'; // Show only if no summary yet and parent is busy
    return null; // Return null if no specific message needs to be shown
  };

  const statusMessage = getStatusMessageForPanel();

  return (
    <Card className="w-full shadow-lg rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-headline text-2xl">
          <span>채용 담당자 노트</span>
          <Sparkles className="w-6 h-6 text-accent" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
         {statusMessage && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-secondary rounded-md w-full justify-center">
              {isLoading && <Loader2 className="h-5 w-5 animate-spin text-accent" />}
              <span>{statusMessage}</span>
            </div>
         )}

        <Textarea
          placeholder="정리된 채용 담당자 노트가 여기에 실시간으로 표시됩니다..."
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
          요약 내보내기 (TXT)
        </Button>
      </CardContent>
    </Card>
  );
}
