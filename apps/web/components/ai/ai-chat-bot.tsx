'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthStore } from '@/lib/auth-store';
import { aiApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIChatBot() {
  const { accessToken, user } = useAuthStore();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi ${user?.name?.split(' ')[0] || 'there'}! I'm your AI assistant. I can help you with:\n\n• Task management tips\n• Using the PMS features\n• Productivity advice\n• Project questions\n\nHow can I help you today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      aiApi.chat(
        message,
        messages.slice(1).map((m) => ({ role: m.role, content: m.content })),
        accessToken!
      ),
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.data.message,
          timestamp: new Date(),
        },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I couldn't process that. Please try again.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    setInput('');

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      },
    ]);

    chatMutation.mutate(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  React.useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/25 z-50"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex flex-col bg-[#0f1729] border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 transition-all duration-300',
        isMinimized ? 'w-72 h-14' : 'w-96 h-[500px]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">AI Assistant</h3>
            {!isMinimized && (
              <p className="text-xs text-slate-400">Always here to help</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
          >
            {isMinimized ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  )}
                >
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                      message.role === 'user'
                        ? 'bg-blue-600'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500'
                    )}
                  >
                    {message.role === 'user' ? (
                      <User className="h-4 w-4 text-white" />
                    ) : (
                      <Bot className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2',
                      message.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-[10px] opacity-50 mt-1">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
                      <span
                        className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <span
                        className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 rounded-xl"
                disabled={chatMutation.isPending}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || chatMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center">
              Powered by AI • Responses may not always be accurate
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default AIChatBot;
