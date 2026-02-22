'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  Wand2,
  FileText,
  Users,
  Loader2,
  Copy,
  Check,
  ChevronRight,
  Clock,
  Tag,
  ListTodo,
  AlertCircle,
  Brain,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth-store';
import { aiApi, GeneratedTask, ExtractedTask } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AITaskAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onTaskGenerated?: (task: GeneratedTask) => void;
  onTasksExtracted?: (tasks: ExtractedTask[]) => void;
}

const PRIORITY_COLORS = {
  LOW: 'bg-slate-500',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500',
};

const EXAMPLE_PROMPTS = [
  'Create a user authentication system with login and signup',
  'Build a dashboard page showing project statistics',
  'Fix the bug where users cannot upload files larger than 5MB',
  'Write unit tests for the payment module',
  'Design a responsive navbar component',
];

export function AITaskAssistant({
  open,
  onOpenChange,
  projectId,
  onTaskGenerated,
  onTasksExtracted,
}: AITaskAssistantProps) {
  const { accessToken } = useAuthStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState('generate');
  const [prompt, setPrompt] = React.useState('');
  const [meetingNotes, setMeetingNotes] = React.useState('');
  const [generatedTask, setGeneratedTask] = React.useState<GeneratedTask | null>(null);
  const [extractedTasks, setExtractedTasks] = React.useState<ExtractedTask[]>([]);
  const [extractSummary, setExtractSummary] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  // Generate task mutation
  const generateMutation = useMutation({
    mutationFn: () => aiApi.generateTask(prompt, projectId, accessToken!),
    onSuccess: (response) => {
      setGeneratedTask(response.data);
      toast({
        title: 'Task Generated!',
        description: `"${response.data.title}" is ready to use.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Could not generate task. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Extract tasks mutation
  const extractMutation = useMutation({
    mutationFn: () => aiApi.extractTasks(meetingNotes, projectId, accessToken!),
    onSuccess: (response) => {
      setExtractedTasks(response.data.tasks);
      setExtractSummary(response.data.summary);
      toast({
        title: 'Tasks Extracted!',
        description: `Found ${response.data.tasks.length} actionable tasks.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Extraction Failed',
        description: error.message || 'Could not extract tasks. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: 'Please enter a description',
        description: 'Describe the task you want to create.',
        variant: 'destructive',
      });
      return;
    }
    generateMutation.mutate();
  };

  const handleExtract = () => {
    if (!meetingNotes.trim()) {
      toast({
        title: 'Please enter meeting notes',
        description: 'Paste your meeting notes or text to extract tasks from.',
        variant: 'destructive',
      });
      return;
    }
    extractMutation.mutate();
  };

  const handleUseTask = () => {
    if (generatedTask && onTaskGenerated) {
      onTaskGenerated(generatedTask);
      onOpenChange(false);
      resetState();
    }
  };

  const handleUseExtractedTasks = () => {
    if (extractedTasks.length > 0 && onTasksExtracted) {
      onTasksExtracted(extractedTasks);
      onOpenChange(false);
      resetState();
    }
  };

  const handleCopyTask = () => {
    if (generatedTask) {
      const taskText = `# ${generatedTask.title}\n\n${generatedTask.description}\n\n**Priority:** ${generatedTask.priority}\n**Estimated:** ${generatedTask.estimatedHours}h\n\n**Subtasks:**\n${generatedTask.subtasks.map(s => `- [ ] ${s}`).join('\n')}`;
      navigator.clipboard.writeText(taskText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetState = () => {
    setPrompt('');
    setMeetingNotes('');
    setGeneratedTask(null);
    setExtractedTasks([]);
    setExtractSummary('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-[hsl(var(--layout-card))] border-[hsl(var(--layout-border))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-purple-400" />
            AI Task Assistant
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--text-secondary))]">
            Let AI help you create tasks faster and smarter
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-[hsl(var(--layout-card))] border-[hsl(var(--layout-border))]">
            <TabsTrigger value="generate" className="data-[state=active]:bg-purple-600">
              <Wand2 className="h-4 w-4 mr-2" />
              Generate Task
            </TabsTrigger>
            <TabsTrigger value="extract" className="data-[state=active]:bg-purple-600">
              <FileText className="h-4 w-4 mr-2" />
              Extract from Notes
            </TabsTrigger>
          </TabsList>

          {/* Generate Task Tab */}
          <TabsContent value="generate" className="flex-1 overflow-auto p-1">
            <div className="space-y-4">
              {/* Input Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--text-primary))]">
                  Describe the task you want to create
                </label>
                <Textarea
                  placeholder="e.g., Create a user authentication system with login, signup, and password reset functionality..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[100px] bg-[hsl(var(--layout-card))] border-[hsl(var(--layout-border))] text-white placeholder:text-[hsl(var(--text-muted))]"
                />
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-[hsl(var(--text-muted))]">Try:</span>
                  {EXAMPLE_PROMPTS.slice(0, 3).map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(example)}
                      className="text-xs px-2 py-1 rounded bg-[hsl(var(--layout-card))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--layout-card-hover))] hover:text-[hsl(var(--text-primary))] transition-colors"
                    >
                      {example.slice(0, 40)}...
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !prompt.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Generate Task with AI
                  </>
                )}
              </Button>

              {/* Generated Task Result */}
              {generatedTask && (
                <Card className="bg-[hsl(var(--layout-card))] border-[hsl(var(--layout-border))]">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg text-white">
                        {generatedTask.title}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-white', PRIORITY_COLORS[generatedTask.priority])}>
                          {generatedTask.priority}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyTask}
                          className="h-8 w-8 p-0"
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Description */}
                    <div>
                      <h4 className="text-sm font-medium text-[hsl(var(--text-secondary))] mb-1">Description</h4>
                      <div className="text-sm text-[hsl(var(--text-primary))] whitespace-pre-wrap bg-[hsl(var(--layout-bg))] p-3 rounded-lg">
                        {generatedTask.description}
                      </div>
                    </div>

                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
                        <Clock className="h-4 w-4" />
                        <span>{generatedTask.estimatedHours}h estimated</span>
                      </div>
                      {generatedTask.tags.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-[hsl(var(--text-secondary))]" />
                          {generatedTask.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Subtasks */}
                    {generatedTask.subtasks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-[hsl(var(--text-secondary))] mb-2 flex items-center gap-2">
                          <ListTodo className="h-4 w-4" />
                          Subtasks ({generatedTask.subtasks.length})
                        </h4>
                        <ul className="space-y-1">
                          {generatedTask.subtasks.map((subtask, idx) => (
                            <li
                              key={idx}
                              className="flex items-center gap-2 text-sm text-[hsl(var(--text-primary))] bg-[hsl(var(--layout-bg))] px-3 py-2 rounded"
                            >
                              <ChevronRight className="h-3 w-3 text-[hsl(var(--text-muted))]" />
                              {subtask}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleUseTask}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Use This Task
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setGeneratedTask(null)}
                        className="border-[hsl(var(--layout-border))]"
                      >
                        Regenerate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Extract Tasks Tab */}
          <TabsContent value="extract" className="flex-1 overflow-auto p-1">
            <div className="space-y-4">
              {/* Input Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--text-primary))]">
                  Paste meeting notes, emails, or any text
                </label>
                <Textarea
                  placeholder={`e.g.,
Meeting Notes - Sprint Planning
- John will work on the user authentication feature
- Sarah needs to fix the payment bug by Friday
- We should add dark mode support - Alice to handle
- Review the API documentation before release`}
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  className="min-h-[150px] bg-[hsl(var(--layout-card))] border-[hsl(var(--layout-border))] text-white placeholder:text-[hsl(var(--text-muted))]"
                />
              </div>

              <Button
                onClick={handleExtract}
                disabled={extractMutation.isPending || !meetingNotes.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {extractMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Extract Tasks from Text
                  </>
                )}
              </Button>

              {/* Extracted Tasks Result */}
              {extractedTasks.length > 0 && (
                <Card className="bg-[hsl(var(--layout-card))] border-[hsl(var(--layout-border))]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <ListTodo className="h-5 w-5" />
                      Extracted Tasks ({extractedTasks.length})
                    </CardTitle>
                    {extractSummary && (
                      <p className="text-sm text-[hsl(var(--text-secondary))]">{extractSummary}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {extractedTasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="bg-[hsl(var(--layout-bg))] p-3 rounded-lg space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-white">{task.title}</h4>
                          <Badge className={cn('text-white text-xs', PRIORITY_COLORS[task.priority])}>
                            {task.priority}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-[hsl(var(--text-secondary))]">{task.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-[hsl(var(--text-muted))]">
                          {task.assignee && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {task.assignee}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Due: {task.dueDate}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleUseExtractedTasks}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Create All Tasks
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setExtractedTasks([]);
                          setExtractSummary('');
                        }}
                        className="border-[hsl(var(--layout-border))]"
                      >
                        Clear
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Info */}
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-muted))] pt-2 border-t border-[hsl(var(--layout-border))]">
          <AlertCircle className="h-3 w-3" />
          AI-generated content may need review. Always verify before creating tasks.
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AITaskAssistant;
