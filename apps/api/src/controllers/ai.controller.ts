import { Response } from 'express';
import OpenAI from 'openai';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types for AI responses
interface GeneratedTask {
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimatedHours: number;
  subtasks: string[];
  tags: string[];
}

// Generate a task from natural language description
export const generateTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, projectId } = req.body;
    const userId = req.user!.id;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    // Get project context if provided
    let projectContext = '';
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          tasks: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: { title: true, description: true, status: true },
          },
        },
      });
      if (project) {
        projectContext = `
Project: ${project.name}
Project Description: ${project.description || 'No description'}
Recent Tasks: ${project.tasks.map(t => `- ${t.title} (${t.status})`).join('\n')}
`;
      }
    }

    const systemPrompt = `You are an AI assistant for a Project Management System. Your job is to help create well-structured tasks from user descriptions.

${projectContext ? `Context:\n${projectContext}` : ''}

Based on the user's description, generate a task with:
1. A clear, concise title (max 100 chars)
2. A detailed description with acceptance criteria in markdown
3. Suggested priority (LOW, MEDIUM, HIGH, URGENT)
4. Estimated hours to complete (be realistic)
5. Subtasks if the task is complex (max 5)
6. Relevant tags/labels

Respond in JSON format only:
{
  "title": "string",
  "description": "string (markdown supported)",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  "estimatedHours": number,
  "subtasks": ["string"],
  "tags": ["string"]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from AI');
    }

    const generatedTask: GeneratedTask = JSON.parse(response);

    console.log(`[AI] Task generated for user ${userId}: "${generatedTask.title}"`);

    res.json({
      success: true,
      data: generatedTask,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      },
    });
  } catch (error) {
    console.error('[AI] Generate task error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate task',
    });
  }
};

// Enhance an existing task description
export const enhanceTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId, enhancementType } = req.body;

    if (!taskId) {
      return res.status(400).json({ success: false, error: 'Task ID is required' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { name: true, description: true } },
      },
    });

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    let systemPrompt = '';
    let userPrompt = '';

    switch (enhancementType) {
      case 'improve_description':
        systemPrompt = `You are a technical writer. Improve the task description to be clearer, more detailed, and actionable. Keep the same intent but make it professional and well-structured using markdown.`;
        userPrompt = `Task: ${task.title}\nCurrent Description: ${task.description || 'No description'}\n\nProject Context: ${task.project?.name} - ${task.project?.description || ''}`;
        break;

      case 'add_acceptance_criteria':
        systemPrompt = `You are a QA specialist. Add clear acceptance criteria to this task. Format as a markdown checklist that defines when this task is "done".`;
        userPrompt = `Task: ${task.title}\nDescription: ${task.description || 'No description'}\n\nGenerate 3-7 acceptance criteria as a checklist.`;
        break;

      case 'break_into_subtasks':
        systemPrompt = `You are a project manager. Break this task into smaller, actionable subtasks. Each subtask should be completable in 1-4 hours. Return as JSON array of strings.`;
        userPrompt = `Task: ${task.title}\nDescription: ${task.description || 'No description'}\n\nReturn JSON: { "subtasks": ["subtask 1", "subtask 2", ...] }`;
        break;

      default:
        return res.status(400).json({ success: false, error: 'Invalid enhancement type' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: enhancementType === 'break_into_subtasks' ? { type: 'json_object' } : undefined,
    });

    const response = completion.choices[0]?.message?.content;

    res.json({
      success: true,
      data: {
        enhancementType,
        original: {
          title: task.title,
          description: task.description,
        },
        enhanced: enhancementType === 'break_into_subtasks' ? JSON.parse(response || '{}') : response,
      },
    });
  } catch (error) {
    console.error('[AI] Enhance task error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enhance task',
    });
  }
};

// Extract tasks from meeting notes or text
export const extractTasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text, projectId } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    // Get team members for assignee suggestions
    let teamContext = '';
    if (projectId) {
      const projectMembers = await prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { id: true, name: true, designation: true } } },
      });
      teamContext = `\nTeam Members:\n${projectMembers.map(m => `- ${m.user.name} (${m.user.designation || 'Team Member'})`).join('\n')}`;
    }

    const systemPrompt = `You are an AI assistant that extracts action items and tasks from meeting notes, emails, or any text.

${teamContext}

Extract all actionable tasks from the text. For each task:
1. Create a clear title
2. Add relevant description
3. Try to identify who should be assigned (match to team members if possible)
4. Identify any mentioned deadlines
5. Suggest priority based on urgency words

Respond in JSON format:
{
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "assignee": "string or null",
      "dueDate": "YYYY-MM-DD or null",
      "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT"
    }
  ],
  "summary": "Brief summary of the meeting/text"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content;
    const extracted = JSON.parse(response || '{"tasks": [], "summary": ""}');

    res.json({
      success: true,
      data: extracted,
    });
  } catch (error) {
    console.error('[AI] Extract tasks error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract tasks',
    });
  }
};

// Suggest assignee based on task and team workload
export const suggestAssignee = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskTitle, taskDescription, projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, error: 'Project ID is required' });
    }

    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            designation: true,
            role: true,
            assignedTasks: {
              where: {
                status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
              },
              select: { id: true, title: true, priority: true, status: true },
            },
          },
        },
      },
    });

    const eligibleMembers = projectMembers.filter(
      m => m.user.role === 'EMPLOYEE' || m.user.role === 'TEAM_LEAD'
    );

    const teamData = eligibleMembers.map(m => ({
      id: m.user.id,
      name: m.user.name,
      designation: m.user.designation,
      currentTasks: m.user.assignedTasks.length,
      activeTasks: m.user.assignedTasks.map(t => t.title),
    }));

    const systemPrompt = `You are a smart task assignment assistant. Based on the task details and team workload, suggest the best person to assign this task to.

Consider:
1. Current workload (fewer active tasks = more available)
2. Designation/role match to task type
3. Balance work across team

Team Members:
${JSON.stringify(teamData, null, 2)}

Respond in JSON:
{
  "suggestedAssignee": {
    "id": "user_id",
    "name": "user name",
    "reason": "why this person"
  },
  "alternativeAssignees": [
    { "id": "user_id", "name": "name", "reason": "why" }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Task: ${taskTitle}\nDescription: ${taskDescription || 'No description'}` },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content;
    const suggestion = JSON.parse(response || '{}');

    res.json({
      success: true,
      data: {
        ...suggestion,
        teamWorkload: teamData,
      },
    });
  } catch (error) {
    console.error('[AI] Suggest assignee error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to suggest assignee',
    });
  }
};

// Summarize daily/weekly activity
export const summarizeActivity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, period = 'daily' } = req.body;
    const targetUserId = userId || req.user!.id;

    const now = new Date();
    const startDate = new Date();
    if (period === 'weekly') {
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate.setHours(0, 0, 0, 0);
    }

    const [tasks, timeEntries, user] = await Promise.all([
      prisma.task.findMany({
        where: {
          assigneeId: targetUserId,
          updatedAt: { gte: startDate },
        },
        select: { title: true, status: true, updatedAt: true },
      }),
      prisma.timeEntry.findMany({
        where: {
          userId: targetUserId,
          startTime: { gte: startDate },
        },
        include: { task: { select: { title: true } } },
      }),
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: { name: true },
      }),
    ]);

    const totalHours = timeEntries.reduce((sum, te) => sum + (te.duration || 0), 0) / 60;

    const activityData = {
      user: user?.name,
      period,
      tasksWorkedOn: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
      totalHoursLogged: totalHours.toFixed(1),
    };

    const systemPrompt = `You are a productivity assistant. Summarize this user's work activity in a friendly, encouraging tone.
Highlight achievements, note any concerns (if hours seem low), and provide a brief productivity tip.
Keep it concise (2-3 paragraphs max).`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(activityData) },
      ],
      temperature: 0.7,
    });

    const summary = completion.choices[0]?.message?.content;

    res.json({
      success: true,
      data: {
        summary,
        stats: {
          tasksWorkedOn: tasks.length,
          tasksCompleted: tasks.filter(t => t.status === 'COMPLETED').length,
          hoursLogged: parseFloat(totalHours.toFixed(1)),
        },
      },
    });
  } catch (error) {
    console.error('[AI] Summarize activity error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to summarize activity',
    });
  }
};

// Chat with AI assistant
export const chat = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const userId = req.user!.id;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        role: true,
        assignedTasks: {
          where: { status: { in: ['TODO', 'IN_PROGRESS'] } },
          take: 5,
          select: { title: true, status: true, dueDate: true },
        },
      },
    });

    const systemPrompt = `You are a helpful AI assistant for a Project Management System called "Super In Tech PMS".

Current User: ${user?.name} (${user?.role})
Their Active Tasks: ${user?.assignedTasks.map(t => t.title).join(', ') || 'None'}

You can help with:
- Explaining how to use the PMS
- Productivity tips
- Task management advice
- General questions about project management

Be concise, friendly, and helpful.`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content;

    res.json({
      success: true,
      data: {
        message: response,
        conversationHistory: [
          ...conversationHistory.slice(-10),
          { role: 'user', content: message },
          { role: 'assistant', content: response },
        ],
      },
    });
  } catch (error) {
    console.error('[AI] Chat error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process chat',
    });
  }
};

// Analyze project health
export const analyzeProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        members: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const now = new Date();
    const overdueTasks = project.tasks.filter(
      t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED'
    );
    const completedTasks = project.tasks.filter(t => t.status === 'COMPLETED');

    const projectData = {
      name: project.name,
      status: project.status,
      totalTasks: project.tasks.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      teamSize: project.members.length,
      completionRate: project.tasks.length > 0
        ? ((completedTasks.length / project.tasks.length) * 100).toFixed(1)
        : 0,
    };

    const systemPrompt = `You are a project management expert. Analyze this project's health and provide:
1. A health score (0-100)
2. Key risks or concerns
3. 2-3 actionable recommendations
4. A brief overall assessment

Be specific and actionable. Respond in JSON:
{
  "healthScore": number,
  "status": "healthy" | "at_risk" | "critical",
  "risks": ["risk1", "risk2"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "assessment": "Brief 2-3 sentence assessment"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(projectData) },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(completion.choices[0]?.message?.content || '{}');

    res.json({
      success: true,
      data: {
        ...analysis,
        projectStats: projectData,
      },
    });
  } catch (error) {
    console.error('[AI] Analyze project error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze project',
    });
  }
};
