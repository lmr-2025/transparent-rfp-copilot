# Security Questionnaire Automation - Claude Code Build Specification

## Project Overview
Build a Next.js application with conversational UI for security questionnaire automation. This maintains the interactive, back-and-forth workflow while being org-friendly and deployable.

## Project Structure

```
security-questionnaire-app/
├── pages/
│   ├── api/
│   │   └── chat.js
│   ├── _app.js
│   └── index.js
├── components/
│   └── ConversationalUI.jsx
├── styles/
│   └── globals.css
├── public/
├── .env.local (gitignored)
├── .env.example
├── .gitignore
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## Step-by-Step Build Instructions

### 1. Initialize Next.js Project

```bash
npx create-next-app@latest security-questionnaire-app --typescript=no --tailwind=yes --app=no
cd security-questionnaire-app
```

### 2. Install Dependencies

```bash
npm install @anthropic-ai/sdk lucide-react
```

### 3. Create Backend API Route

**File: `pages/api/chat.js`**

```javascript
// Next.js API route for secure Claude API communication

import Anthropic from '@anthropic-ai/sdk';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, systemPrompt } = req.body;

    // Initialize Anthropic client with API key from environment
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      system: systemPrompt,
      messages: messages,
    });

    // Return response
    res.status(200).json({
      content: response.content,
      usage: response.usage,
      id: response.id,
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process request',
    });
  }
}
```

### 4. Create Conversational UI Component

**File: `components/ConversationalUI.jsx`**

```javascript
import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, FileText, Loader2, Download, Plus, Trash2 } from 'lucide-react';

export default function ConversationalQuestionnaireApp() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your security questionnaire assistant. Upload your questionnaire and any knowledge base files (Skill, SOC 2), and I'll help you process it. You can ask me questions, request revisions, or have me explain my reasoning at any point.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle file uploads
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    
    for (const file of files) {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          content: e.target.result,
          uploadedAt: new Date()
        };
        
        setUploadedFiles(prev => [...prev, fileData]);
        
        // Add system message about upload
        const fileType = file.name.includes('SKILL') ? 'Skill file' :
                        file.name.includes('SOC') ? 'SOC 2 report' :
                        'Questionnaire';
        
        setMessages(prev => [...prev, {
          role: 'system',
          content: `✓ Uploaded: ${file.name} (${fileType})`,
          timestamp: new Date()
        }]);
      };
      
      reader.readAsText(file);
    }
  };

  const removeFile = (index) => {
    const file = uploadedFiles[index];
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setMessages(prev => [...prev, {
      role: 'system',
      content: `✗ Removed: ${file.name}`,
      timestamp: new Date()
    }]);
  };

  // Send message to Claude via backend API
  const sendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    // Build context from uploaded files
    let contextMessage = '';
    const questionnaireFile = uploadedFiles.find(f => 
      !f.name.includes('SKILL') && !f.name.includes('SOC')
    );
    const skillFile = uploadedFiles.find(f => f.name.includes('SKILL'));
    const soc2File = uploadedFiles.find(f => f.name.includes('SOC'));

    if (skillFile) {
      contextMessage += `\n\n# SKILL FILE (Knowledge Base):\n${skillFile.content}\n`;
    }
    
    if (soc2File) {
      contextMessage += `\n\n# SOC 2 REPORT:\n${soc2File.content.substring(0, 50000)}\n`;
    }

    if (questionnaireFile) {
      contextMessage += `\n\n# QUESTIONNAIRE TO PROCESS:\n${questionnaireFile.content}\n`;
    }

    // Build conversation context
    const conversationContext = conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    try {
      const systemPrompt = `You are a security questionnaire automation expert with deep expertise in GRC, compliance, and security frameworks. You help users process security questionnaires efficiently.

CAPABILITIES:
- Process security questionnaires using provided skill files and SOC 2 reports
- Answer questions about your reasoning and methodology
- Explain confidence levels and source attribution
- Revise responses based on user feedback
- Identify gaps in the knowledge base
- Suggest improvements to templates

WORKFLOW:
1. When given a questionnaire, batch process by topic (5-10 questions at a time)
2. Use skill templates for proven responses
3. Reference SOC 2 for specific controls/pages
4. Provide concise responses (1-3 sentences, ~35 words)
5. Always include: Response, Confidence Level, Sources, Remarks

RESPONSE STYLE:
- Concise and direct (60% shorter than verbose)
- Lead with the answer for binary questions
- Full source attribution (URLs + SOC 2 page/control references)
- Mark confidence: High/Medium/Low

USER INTERACTION:
- Answer questions about your responses
- Explain your reasoning when asked
- Accept feedback and revise responses
- Identify when you need more information
- Be conversational but professional

${contextMessage}`;

      // Call backend API instead of Anthropic directly
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt,
          messages: [
            ...conversationContext,
            {
              role: 'user',
              content: input || 'Please process the uploaded questionnaire using the provided skill and SOC 2 files.'
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const assistantResponse = data.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      const assistantMessage = {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date(),
        tokensUsed: {
          input: data.usage.input_tokens,
          output: data.usage.output_tokens
        }
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Update conversation history for context
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: input },
        { role: 'assistant', content: assistantResponse }
      ]);

    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'error',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadConversation = () => {
    const conversationText = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        const role = m.role.toUpperCase();
        const timestamp = m.timestamp.toLocaleString();
        return `[${timestamp}] ${role}:\n${m.content}\n\n`;
      })
      .join('---\n\n');

    const blob = new Blob([conversationText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questionnaire-conversation-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startNewConversation = () => {
    setMessages([{
      role: 'assistant',
      content: "Starting fresh! Upload your files and I'll help you process the questionnaire.",
      timestamp: new Date()
    }]);
    setConversationHistory([]);
    setUploadedFiles([]);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">
            Security Questionnaire Assistant
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Conversational automation
          </p>
        </div>

        {/* File Upload Section */}
        <div className="p-4 border-b border-gray-200">
          <label className="flex items-center justify-center w-full px-4 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
            <Upload size={16} className="mr-2" />
            <span className="text-sm font-medium">Upload Files</span>
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.docx,.pdf,.txt,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Questionnaire, Skill, SOC 2
          </p>
        </div>

        {/* Uploaded Files */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Uploaded Files ({uploadedFiles.length})
          </h3>
          {uploadedFiles.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No files uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between p-2 bg-gray-50 rounded border border-gray-200"
                >
                  <div className="flex items-start flex-1 min-w-0">
                    <FileText size={16} className="text-blue-600 mt-1 mr-2 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-red-600 ml-2"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={downloadConversation}
            className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <Download size={16} className="mr-2" />
            Download Conversation
          </button>
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
          >
            <Plus size={16} className="mr-2" />
            New Conversation
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.role === 'system'
                    ? 'bg-gray-200 text-gray-700 text-sm italic'
                    : message.role === 'error'
                    ? 'bg-red-50 text-red-900 border border-red-200'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                {message.tokensUsed && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                    Tokens: {message.tokensUsed.input.toLocaleString()} in / {message.tokensUsed.output.toLocaleString()} out
                  </div>
                )}
                <div className="text-xs mt-2 opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <Loader2 className="animate-spin text-blue-600" size={20} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end space-x-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask questions, request revisions, or say 'process the questionnaire'..."
                className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                disabled={isProcessing}
              />
              <button
                onClick={sendMessage}
                disabled={isProcessing || (!input.trim() && uploadedFiles.length === 0)}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  isProcessing || (!input.trim() && uploadedFiles.length === 0)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Shift + Enter for new line • Enter to send
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 5. Update Main Page

**File: `pages/index.js`**

```javascript
import ConversationalUI from '../components/ConversationalUI';

export default function Home() {
  return <ConversationalUI />;
}
```

### 6. Update App Component

**File: `pages/_app.js`**

```javascript
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default MyApp;
```

### 7. Create Environment Files

**File: `.env.example`**

```bash
# Anthropic API Key (get from https://console.anthropic.com)
ANTHROPIC_API_KEY=your_api_key_here
```

**File: `.env.local`** (create this, add to .gitignore)

```bash
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

### 8. Update .gitignore

Add to `.gitignore`:

```
.env.local
```

### 9. Update package.json

Ensure these dependencies are included:

```json
{
  "name": "security-questionnaire-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.1",
    "lucide-react": "^0.263.1",
    "next": "14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

### 10. Create README

**File: `README.md`**

```markdown
# Security Questionnaire Automation

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` and add your Anthropic API key:
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

3. Run development server:
```bash
npm run dev
```

4. Open http://localhost:3000

## Usage

1. Upload questionnaire file (Excel, Word, PDF, text)
2. Optionally upload SKILL.md and SOC 2 report
3. Chat with Claude to process questionnaire
4. Ask questions, request revisions, iterate
5. Download complete conversation

## Deploy to Vercel

```bash
vercel
```

Set `ANTHROPIC_API_KEY` environment variable in Vercel dashboard.

## Features

- ✅ Conversational interface
- ✅ File upload support
- ✅ Context persistence
- ✅ Download conversations
- ✅ Secure API key handling
```

## Testing Instructions

1. Run `npm run dev`
2. Open http://localhost:3000
3. Upload a test questionnaire file
4. Type "Process this questionnaire"
5. Verify response appears
6. Ask a follow-up question
7. Verify conversation continues with context

## Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Then set environment variable in Vercel dashboard:
- Key: `ANTHROPIC_API_KEY`
- Value: Your API key from console.anthropic.com

### Alternative: Railway, Render, etc.

All support Next.js deployments. Just:
1. Connect your GitHub repo
2. Set `ANTHROPIC_API_KEY` environment variable
3. Deploy

## Troubleshooting

**API errors:**
- Verify `ANTHROPIC_API_KEY` is set in `.env.local`
- Check key is valid at console.anthropic.com

**Build errors:**
- Run `npm install` to ensure all dependencies installed
- Check Node.js version (need v18+)

**File upload issues:**
- Max file size: 10MB (configurable in `pages/api/chat.js`)
- Supported formats: .xlsx, .xls, .docx, .pdf, .txt, .md

## Cost Estimate

- Claude Sonnet 4: $3/M input, $15/M output tokens
- Typical 64-question questionnaire: ~$0.30
- 50 questionnaires/year: ~$15/year

---

## Project Notes

This is a conversational AI assistant that maintains the interactive workflow of using Claude directly while being deployable and shareable with your team.

Key design decisions:
- Backend API route keeps API key secure
- Frontend chat UI maintains conversation context
- Files processed in browser (not sent to server for privacy)
- Stateless design (no database needed)
```
