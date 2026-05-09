const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

export async function getAiReply({ apiKey, prompt, model = 'gpt-4.1-mini' }) {
  if (!apiKey) throw new Error('Missing API key.');
  if (!prompt?.trim()) throw new Error('Prompt cannot be empty.');

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: prompt
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenAI error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  return data.output_text?.trim() || 'No response text returned.';
}
