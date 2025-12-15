import { NextRequest, NextResponse } from "next/server";

// Project-level review request
type ProjectReviewBody = {
  type?: "project";
  projectName: string;
  projectUrl: string;
  customerName?: string;
  requesterName: string;
};

// Question-level review request
type QuestionReviewBody = {
  type: "question";
  projectName: string;
  projectUrl: string;
  customerName?: string;
  requesterName: string;
  question: string;
  answer: string;
  confidence?: string;
  reviewNote?: string;
};

type SlackNotifyBody = ProjectReviewBody | QuestionReviewBody;

// Sanitize text for Slack markdown - escape special characters
function sanitizeForSlack(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Validate URL is from our domain
function isValidProjectUrl(url: string, request: NextRequest): boolean {
  try {
    const parsedUrl = new URL(url);
    const origin = request.headers.get("origin") || request.headers.get("host") || "";
    // Allow localhost and same origin
    return parsedUrl.hostname === "localhost" ||
           parsedUrl.origin === origin ||
           parsedUrl.hostname === new URL(`https://${origin}`).hostname;
  } catch {
    return false;
  }
}

// Truncate text for Slack (max ~3000 chars for blocks)
function truncateForSlack(text: string, maxLength = 500): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// Build Slack message for project-level review
function buildProjectReviewMessage(
  projectName: string,
  customerName: string,
  requesterName: string,
  projectUrl: string
) {
  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📋 Project Review Requested",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Project:*\n${projectName}` },
          { type: "mrkdwn", text: `*Customer:*\n${customerName}` },
          { type: "mrkdwn", text: `*Requested by:*\n${requesterName}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Review Now", emoji: true },
            url: projectUrl,
            style: "primary",
          },
        ],
      },
    ],
  };
}

// Build Slack message for question-level review
function buildQuestionReviewMessage(
  projectName: string,
  customerName: string,
  requesterName: string,
  projectUrl: string,
  question: string,
  answer: string,
  confidence?: string,
  reviewNote?: string
) {
  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🔍 Answer Review Requested",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Project:*\n${projectName}` },
        { type: "mrkdwn", text: `*Customer:*\n${customerName}` },
        { type: "mrkdwn", text: `*Requested by:*\n${requesterName}` },
        ...(confidence ? [{ type: "mrkdwn", text: `*Confidence:*\n${confidence}` }] : []),
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Question:*\n${truncateForSlack(question, 300)}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Generated Answer:*\n${truncateForSlack(answer, 500)}`,
      },
    },
  ];

  // Add reviewer note if provided
  if (reviewNote?.trim()) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📝 Note from ${requesterName}:*\n_${truncateForSlack(reviewNote.trim(), 300)}_`,
      },
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Review in App", emoji: true },
        url: projectUrl,
        style: "primary",
      },
    ],
  });

  return { blocks };
}

export async function POST(request: NextRequest) {
  try {
    const body: SlackNotifyBody = await request.json();
    const { projectName, projectUrl, customerName, requesterName } = body;

    // Validate required fields
    if (!projectName?.trim() || !projectUrl?.trim() || !requesterName?.trim()) {
      return NextResponse.json(
        { error: "projectName, projectUrl, and requesterName are required" },
        { status: 400 }
      );
    }

    // Validate URL is from our domain (prevent open redirect attacks)
    if (!isValidProjectUrl(projectUrl, request)) {
      return NextResponse.json(
        { error: "Invalid project URL" },
        { status: 400 }
      );
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn("SLACK_WEBHOOK_URL not configured, skipping notification");
      return NextResponse.json({ success: true, skipped: true }, { status: 200 });
    }

    // Sanitize all user input for Slack
    const safeProjectName = sanitizeForSlack(projectName.trim());
    const safeCustomerName = sanitizeForSlack(customerName?.trim() || "Not specified");
    const safeRequesterName = sanitizeForSlack(requesterName.trim());

    let message;

    if (body.type === "question") {
      // Question-level review request
      const { question, answer, confidence, reviewNote } = body;

      if (!question?.trim() || !answer?.trim()) {
        return NextResponse.json(
          { error: "question and answer are required for question reviews" },
          { status: 400 }
        );
      }

      message = buildQuestionReviewMessage(
        safeProjectName,
        safeCustomerName,
        safeRequesterName,
        projectUrl,
        sanitizeForSlack(question.trim()),
        sanitizeForSlack(answer.trim()),
        confidence ? sanitizeForSlack(confidence) : undefined,
        reviewNote ? sanitizeForSlack(reviewNote) : undefined
      );
    } else {
      // Project-level review request (default)
      message = buildProjectReviewMessage(
        safeProjectName,
        safeCustomerName,
        safeRequesterName,
        projectUrl
      );
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Slack webhook error:", errorText);
      return NextResponse.json(
        { error: "Failed to send Slack notification" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error sending Slack notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
