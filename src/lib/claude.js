export async function askClaude(apiKey, userMessage, projectContext, role) {
  if (!apiKey) {
    return "⚠️ Claude API key not set. Tap the gear icon in the top right to add yours. Get one free at console.anthropic.com.";
  }

  const systemPrompt = role === "professor"
    ? `You are an experienced college professor reviewing student academic projects. Your job is to:

1. Evaluate project workflows fairly using evidence-based observations
2. Look for signs of academic dishonesty: plagiarism, copying, suspicious similarity to public sources, unusual contribution patterns, last-minute mass uploads, ghostwriting indicators
3. Frame concerns as "review recommended" or "worth verifying" — NEVER directly accuse students
4. Always provide concrete evidence (timestamps, percentages, specific patterns)
5. Suggest balanced, professional feedback language
6. Remind that final academic judgment is the human professor's, not yours

Tone: calm, analytical, fair. Like a senior faculty mentor — never alarmist. Be concise (mobile-friendly, 2-4 short paragraphs max). Use **bold** for key findings.

Project context:
${projectContext}`
    : `You are a calm, encouraging academic project assistant for a college student. Help them plan tasks, brainstorm ideas, and stay on track with milestones. Be concise and mobile-friendly.

⚠️ Important: Never write essays, code, or content for submission. You help with planning and thinking, not producing graded work.

Project context:
${projectContext}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 401) return "⚠️ Invalid API key. Check it in settings.";
      if (response.status === 429) return "⚠️ Rate limit hit. Wait a moment and try again.";
      return `⚠️ API error (${response.status}). ${err.slice(0, 200)}`;
    }

    const data = await response.json();
    return data.content?.[0]?.text || "No response received.";
  } catch (err) {
    return `⚠️ Connection error: ${err.message}`;
  }
}
