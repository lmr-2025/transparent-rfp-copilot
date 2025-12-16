'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, CheckCircle, X, Lightbulb } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ContentBlock {
  type: string;
  text?: string;
}

interface OriginalMessage {
  role: string;
  content: string;
}

interface ConversationalRefinementProps {
  originalQuestion: string;
  currentResponse: string;
  onResponseUpdate: (newResponse: string) => void;
  onClose: () => void;
  promptText: string;
  originalConversationHistory?: OriginalMessage[];
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
  acceptButton: {
    backgroundColor: '#22c55e',
    color: '#fff',
  },
  suggestButton: {
    backgroundColor: '#f59e0b',
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
  originalConversationHistory,
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

      // Build original conversation context if available
      const originalContextSection = originalConversationHistory && originalConversationHistory.length > 0
        ? `\n\nORIGINAL GENERATION CONVERSATION:
Below is the conversation that led to this response. This shows your reasoning process, what skills you matched, and how you arrived at your answer. Use this context to explain your thinking when asked.

${originalConversationHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}`
        : '';

      const systemPrompt = `${promptText}

CONVERSATION CONTEXT:
You are refining a response to a security questionnaire question.

Original Question: "${originalQuestion}"
Current Response: "${currentResponse}"
${originalContextSection}

The user is asking for refinements or clarifications. Maintain the same structured format (Response, Confidence, Sources, Reasoning, Inference, Remarks) but adjust based on their feedback.

When the user asks "why" or asks about your reasoning, refer back to the original generation conversation above to explain your thought process.

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
        throw new Error('Failed to get response');
      }

      const json = await response.json();
      // Handle both old format ({ content: [...] }) and new format ({ data: { content: [...] } })
      const content = json.data?.content ?? json.content;
      const assistantContent = (content as ContentBlock[])
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n');

      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Check if this looks like a refined response (has "Answer:" or similar structure)
      if (
        assistantContent.includes('Answer:') ||
        assistantContent.includes('Confidence:') ||
        userMessage.content.toLowerCase().includes('refine') ||
        userMessage.content.toLowerCase().includes('rewrite') ||
        userMessage.content.toLowerCase().includes('make it')
      ) {
        setLatestSuggestion(assistantContent);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process your request';
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptAnswer = () => {
    if (latestSuggestion) {
      onResponseUpdate(latestSuggestion);
      setLatestSuggestion(null);
    }
    onClose();
  };

  const handleGetSuggestions = async () => {
    if (isProcessing) return;

    const suggestionPrompt = "What additional information or context would help you provide a better, more confident answer to this question? Please be specific about what's missing or unclear.";

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: suggestionPrompt,
        timestamp: new Date(),
      },
    ]);
    setIsProcessing(true);

    try {
      const conversationContext = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const originalContextSection = originalConversationHistory && originalConversationHistory.length > 0
        ? `\n\nORIGINAL GENERATION CONVERSATION:
Below is the conversation that led to this response. This shows your reasoning process, what skills you matched, and how you arrived at your answer.

${originalConversationHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}`
        : '';

      const systemPrompt = `${promptText}

CONVERSATION CONTEXT:
You are refining a response to a security questionnaire question.

Original Question: "${originalQuestion}"
Current Response: "${currentResponse}"
${originalContextSection}

The user is asking what additional information would help improve your answer. Be specific and actionable about what's missing:
- What specific details about the company's practices would help?
- What documentation or policies would be useful?
- What technical specifics are you uncertain about?

Focus on concrete, actionable suggestions for what the user could provide to improve the answer quality and confidence.`;

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
              content: suggestionPrompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const json = await response.json();
      // Handle both old format ({ content: [...] }) and new format ({ data: { content: [...] } })
      const content = json.data?.content ?? json.content;
      const assistantContent = (content as ContentBlock[])
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n');

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantContent,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process your request';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${message}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>Refine Response</span>
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
              (message.content.includes('Answer:') || message.content.includes('Confidence:')) && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleAcceptAnswer}
                    style={{ ...styles.button, ...styles.acceptButton }}
                  >
                    <CheckCircle size={16} />
                    Accept Answer
                  </button>
                  <button
                    onClick={handleGetSuggestions}
                    disabled={isProcessing}
                    style={{
                      ...styles.button,
                      ...styles.suggestButton,
                      opacity: isProcessing ? 0.5 : 1,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Lightbulb size={16} />
                    Get Suggestions
                  </button>
                </div>
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 5000))}
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
            maxLength={5000}
          />
          <div style={{
            fontSize: '10px',
            color: input.length > 4500 ? '#dc2626' : '#94a3b8',
            textAlign: 'right',
            marginTop: '2px',
          }}>
            {input.length.toLocaleString()} / 5,000
          </div>
        </div>
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
