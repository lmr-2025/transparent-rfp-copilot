'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, CheckCircle, X } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ConversationalRefinementProps {
  originalQuestion: string;
  currentResponse: string;
  onResponseUpdate: (newResponse: string) => void;
  onClose: () => void;
  promptText: string;
}

const styles = {
  container: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    marginTop: '12px',
    overflow: 'hidden',
  },
  header: {
    padding: '12px 16px',
    backgroundColor: '#0ea5e9',
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 600,
  },
  messagesContainer: {
    maxHeight: '400px',
    overflowY: 'auto' as const,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  message: {
    padding: '10px 14px',
    borderRadius: '8px',
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end' as const,
    backgroundColor: '#0ea5e9',
    color: '#fff',
  },
  assistantMessage: {
    alignSelf: 'flex-start' as const,
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    color: '#0f172a',
  },
  inputContainer: {
    padding: '12px',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#fff',
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e0',
    resize: 'none' as const,
    fontFamily: 'inherit',
    fontSize: '14px',
    minHeight: '44px',
    maxHeight: '120px',
  },
  button: {
    padding: '10px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap' as const,
  },
  sendButton: {
    backgroundColor: '#0ea5e9',
    color: '#fff',
  },
  useButton: {
    backgroundColor: '#22c55e',
    color: '#fff',
  },
  closeButton: {
    backgroundColor: 'transparent',
    color: '#fff',
    padding: '4px',
    border: 'none',
    cursor: 'pointer',
  },
};

export default function ConversationalRefinement({
  originalQuestion,
  currentResponse,
  onResponseUpdate,
  onClose,
  promptText,
}: ConversationalRefinementProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `I generated this response to your question: "${originalQuestion}"\n\n${currentResponse}\n\nHow would you like to refine it? You can ask me to make it shorter, explain my reasoning, add more detail, or anything else.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [latestSuggestion, setLatestSuggestion] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Build conversation context
      const conversationContext = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const systemPrompt = `${promptText}

CONVERSATION CONTEXT:
You are refining a response to a security questionnaire question.

Original Question: "${originalQuestion}"
Current Response: "${currentResponse}"

The user is asking for refinements or clarifications. Maintain the same structured format (Response, Confidence, Sources, Remarks) but adjust based on their feedback.

If the user asks you to generate a new/updated response, format it the same way as the original.`;

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
              content: input.trim(),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from GRC Minion');
      }

      const data = await response.json();
      const assistantContent = data.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');

      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Check if this looks like a refined response (has "Response:" or similar structure)
      if (
        assistantContent.includes('Response:') ||
        assistantContent.includes('Confidence:') ||
        userMessage.content.toLowerCase().includes('refine') ||
        userMessage.content.toLowerCase().includes('rewrite') ||
        userMessage.content.toLowerCase().includes('make it')
      ) {
        setLatestSuggestion(assistantContent);
      }
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to process your request'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseResponse = () => {
    if (latestSuggestion) {
      onResponseUpdate(latestSuggestion);
      setLatestSuggestion(null);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>💬 Ask GRC Minion</span>
        <button onClick={onClose} style={styles.closeButton} title="Close conversation">
          <X size={20} />
        </button>
      </div>

      <div style={styles.messagesContainer}>
        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              ...styles.message,
              ...(message.role === 'user' ? styles.userMessage : styles.assistantMessage),
            }}
          >
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.5' }}>
              {message.content}
            </div>
            {message.role === 'assistant' &&
              index === messages.length - 1 &&
              latestSuggestion &&
              (message.content.includes('Response:') || message.content.includes('Confidence:')) && (
                <button
                  onClick={handleUseResponse}
                  style={{ ...styles.button, ...styles.useButton, marginTop: '10px' }}
                >
                  <CheckCircle size={16} />
                  Use This Answer
                </button>
              )}
          </div>
        ))}
        {isProcessing && (
          <div
            style={{
              ...styles.message,
              ...styles.assistantMessage,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Loader2 className="animate-spin" size={16} />
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputContainer}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask to refine, explain, shorten, add detail..."
          style={styles.textarea}
          disabled={isProcessing}
          rows={1}
        />
        <button
          onClick={sendMessage}
          disabled={isProcessing || !input.trim()}
          style={{
            ...styles.button,
            ...styles.sendButton,
            opacity: isProcessing || !input.trim() ? 0.5 : 1,
            cursor: isProcessing || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          Send
        </button>
      </div>
    </div>
  );
}
