const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile';

// ~4000 words ≈ 5500 tokens — safely under the 12k TPM free-tier limit
const CHUNK_WORDS = 4000;

function splitIntoChunks(text) {
  const words = text.trim().split(/\s+/);
  if (words.length <= CHUNK_WORDS) return [text];
  const chunks = [];
  for (let i = 0; i < words.length; i += CHUNK_WORDS) {
    chunks.push(words.slice(i, i + CHUNK_WORDS).join(' '));
  }
  return chunks;
}

async function callGroq(messages) {
  const res = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq LLM failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

// Process a single chunk (or full short transcript)
async function processChunk(chunk, isPartial) {
  const system = isPartial
    ? `You are a meeting transcript editor. Given a portion of a meeting, return JSON with:
"cleanedTranscript": this portion rewritten with proper punctuation, capitalisation, paragraph breaks. Remove filler words.
"summary": array of 2-3 key points from this portion.
"actionItems": array of action items from this portion, empty array if none.
Return only valid JSON.`
    : `You are a meeting transcript editor. Return JSON with:
"cleanedTranscript": full transcript rewritten with proper punctuation, capitalisation, paragraph breaks. Remove filler words. Keep all content.
"summary": array of 3-5 key discussion points.
"actionItems": array of specific tasks or decisions requiring follow-up. Empty array if none.
Return only valid JSON.`;

  return callGroq([
    { role: 'system', content: system },
    { role: 'user', content: chunk },
  ]);
}

// Merge multiple chunk results into one coherent response
async function mergeResults(chunkResults) {
  const cleanedTranscript = chunkResults.map(r => r.cleanedTranscript || '').join('\n\n');
  const allPoints = chunkResults.flatMap(r => r.summary || []);
  const allActions = chunkResults.flatMap(r => r.actionItems || []);

  const merged = await callGroq([
    {
      role: 'system',
      content: `You are a meeting summarizer. Given bullet points and action items collected from multiple parts of a meeting, consolidate them. Return JSON with:
"summary": array of 4-6 concise, non-duplicate key points covering the whole meeting.
"actionItems": array of unique action items. Empty array if none.
Return only valid JSON.`,
    },
    {
      role: 'user',
      content: JSON.stringify({ points: allPoints, actionItems: allActions }),
    },
  ]);

  return {
    cleanedTranscript,
    summary: merged.summary || allPoints.slice(0, 5),
    actionItems: merged.actionItems || allActions,
  };
}

async function processTranscript(rawTranscript) {
  const chunks = splitIntoChunks(rawTranscript);

  if (chunks.length === 1) {
    return processChunk(rawTranscript, false);
  }

  // Process each chunk sequentially; pause between calls to stay under TPM limit
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 4000));
    results.push(await processChunk(chunks[i], true));
  }

  return mergeResults(results);
}

module.exports = { processTranscript };
