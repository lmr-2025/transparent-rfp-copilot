# Security Questionnaire Automation - Conversational UI

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Add your Anthropic API key to `.env.local`:**
```bash
# Edit .env.local and replace 'your_api_key_here' with your actual key
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get your API key from [https://console.anthropic.com](https://console.anthropic.com)

3. **Run development server:**
```bash
npm run dev
```

4. **Open [http://localhost:3000](http://localhost:3000)**

## Usage

1. **Upload files:**
   - Upload your questionnaire file (Excel, Word, PDF, text, or markdown)
   - Optionally upload your SKILL.md knowledge base file
   - Optionally upload your SOC 2 report or other compliance documentation

2. **Interact with Claude:**
   - Type "process the questionnaire" to start automated processing
   - Ask questions like "Why did you choose Medium confidence for question 12?"
   - Request revisions: "Make the response to question 5 more concise"
   - Iterate conversationally until satisfied

3. **Download results:**
   - Click "Download Conversation" to save the complete conversation
   - Includes all questions, responses, and revisions

## Features

- ✅ **Conversational interface** - Natural back-and-forth with Claude
- ✅ **File upload support** - Questionnaires, Skill files, SOC 2 reports
- ✅ **Context persistence** - Full conversation history maintained
- ✅ **Download conversations** - Export as markdown
- ✅ **Secure API handling** - API key never exposed to frontend
- ✅ **Token usage tracking** - Monitor API costs per response

## Architecture

### Pages Router Structure
```
pages/
├── api/
│   └── chat.js          # Backend API route for Claude calls
├── _app.js              # App wrapper
└── index.js             # Main page

components/
└── ConversationalUI.jsx # Chat interface component

styles/
└── globals.css          # Global styles with Tailwind
```

### Security Features

- **Backend API Route:** All Anthropic API calls happen server-side in `/api/chat`
- **Environment Variables:** API key stored securely in `.env.local` (gitignored)
- **File Processing:** Files processed in browser, not sent to server
- **Stateless Design:** No database required

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Then set environment variable in Vercel dashboard:
- **Key:** `ANTHROPIC_API_KEY`
- **Value:** Your API key from console.anthropic.com

## Alternative Deployment (Railway, Render, etc.)

All platforms support Next.js. Steps:
1. Connect your GitHub repository
2. Set `ANTHROPIC_API_KEY` environment variable
3. Deploy

## Troubleshooting

### API Errors
- Verify `ANTHROPIC_API_KEY` is set correctly in `.env.local`
- Check key is valid at [console.anthropic.com](https://console.anthropic.com)
- Ensure you have API credits available

### Build Errors
- Run `npm install` to ensure all dependencies are installed
- Check Node.js version (requires v18+)
- Try deleting `.next` folder and running `npm run dev` again

### File Upload Issues
- **Max file size:** 10MB (configurable in `pages/api/chat.js`)
- **Supported formats:** .xlsx, .xls, .docx, .pdf, .txt, .md
- Files are processed client-side for privacy

### Page Not Found
- The app uses Pages Router (not App Router)
- Ensure files are in `pages/` directory, not `src/app/`
- Clear `.next` cache if switching between routers

## Cost Estimate

- **Claude Sonnet 4:** $3/M input tokens, $15/M output tokens
- **Typical 64-question questionnaire:** ~$0.30 per processing
- **50 questionnaires/year:** ~$15/year
- **Interactive iterations:** Budget ~$0.50 per questionnaire with revisions

## Example Conversations

### Example 1: Initial Processing
```
User: "Process this questionnaire using the skill file"
Assistant: [Processes all 64 questions with responses, confidence levels, sources]

User: "Why is question 12 marked as Medium confidence?"
Assistant: [Explains reasoning, suggests what info would increase confidence]

User: "Make all responses under 30 words"
Assistant: [Revises verbose responses to be more concise]
```

### Example 2: Iterative Refinement
```
User: "Upload files and process"
Assistant: [Processes questionnaire]

User: "The vulnerability management response seems too technical"
Assistant: [Provides simplified version]

User: "Perfect, use that style for all infrastructure questions"
Assistant: [Revises infrastructure section with simpler language]
```

## Development Notes

This maintains the interactive workflow of using Claude Code directly while being:
- **Org-friendly:** Deployable web app, not CLI tool
- **Shareable:** Team members can use without setup
- **Auditable:** All conversations can be downloaded
- **Secure:** API keys never exposed to frontend

## Next.js Configuration

The project uses:
- **Next.js 16** with Pages Router
- **Tailwind CSS 4** for styling
- **Anthropic SDK** for Claude API
- **Lucide React** for icons

## Additional Resources

- [Anthropic API Documentation](https://docs.anthropic.com)
- [Next.js Pages Router Guide](https://nextjs.org/docs/pages)
- [Vercel Deployment Guide](https://vercel.com/docs)
