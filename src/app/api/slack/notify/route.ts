import { NextRequest, NextResponse } from "next/server";

type SlackNotifyBody = {
  projectName?: string;
  projectUrl?: string;
  customerName?: string;
  requesterName?: string;
};

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

    const message = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Review Requested",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Project:*\n${safeProjectName}`,
            },
            {
              type: "mrkdwn",
              text: `*Customer:*\n${safeCustomerName}`,
            },
            {
              type: "mrkdwn",
              text: `*Requested by:*\n${safeRequesterName}`,
            },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Review Now",
                emoji: true,
              },
              url: projectUrl,
              style: "primary",
            },
          ],
        },
      ],
    };

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
