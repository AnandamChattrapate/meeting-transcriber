const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile';

async function processTranscript(rawTranscript) {
  const response = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a meeting transcript editor. Given raw speech-to-text output, return a JSON object with exactly three fields:
"cleanedTranscript": the full transcript rewritten with proper punctuation, capitalization, and paragraph breaks. Remove filler words (um, uh, like, you know, sort of). Keep all content and meaning intact.
"summary": an array of 3 to 5 concise strings, each summarising one key discussion point.
"actionItems": an array of strings describing specific tasks or decisions requiring follow-up. Return an empty array if there are none.
Return only valid JSON. No markdown, no extra text.`,
        },
        {
          role: 'user',
          content: rawTranscript,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq LLM failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

module.exports = { processTranscript };
