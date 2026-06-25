import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const BATCH_SIZE = 96;
const MAX_RETRIES = 3;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedBatchWithRetry(batch) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.embeddings.create({
        model: MODEL,
        input: batch,
      });
      return response.data.map((d) => d.embedding);
    } catch (err) {
      const status = err.status || err.statusCode;
      if ((status === 429 || status >= 500) && attempt < MAX_RETRIES - 1) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw err;
    }
  }
}

export async function embedTexts(texts) {
  const results = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatchWithRetry(batch);
    results.push(...embeddings);
  }
  return results;
}

export async function embedQuery(text) {
  return (await embedTexts([text]))[0];
}
