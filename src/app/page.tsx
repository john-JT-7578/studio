// src/app/page.tsx
"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TranscriptionPanel } from '@/components/transcription-panel';
import { SummaryPanel } from '@/components/summary-panel';
import { BrainCircuit } from 'lucide-react'; // Using BrainCircuit as a placeholder app icon element

export default function RecruitAssistPage() {
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Shared loading state

  const handleTranscriptionComplete = (transcript: string) => {
    setCurrentTranscript(transcript);
  };

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
          AI-powered tool for real-time interview transcription and summarization into recruiter notes.
        </p>
      </header>

      <main className="w-full max-w-4xl">
        <Tabs defaultValue="transcription" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary p-1 rounded-lg shadow">
            <TabsTrigger value="transcription" className="py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all">
              Interview Transcription
            </TabsTrigger>
            <TabsTrigger value="summary" className="py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all">
              Recruiter Notes
            </TabsTrigger>
          </TabsList>
          <TabsContent value="transcription">
            <TranscriptionPanel 
              onTranscriptionComplete={handleTranscriptionComplete}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </TabsContent>
          <TabsContent value="summary">
            <SummaryPanel 
              transcript={currentTranscript}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </TabsContent>
        </Tabs>
      </main>
      <footer className="w-full max-w-4xl mt-12 text-center">
        <p className="text-sm text-muted-foreground">
          Privacy: Audio is processed for transcription. Transcripts are used for summarization. No audio files or transcripts are permanently stored by this application.
        </p>
      </footer>
    </div>
  );
}
