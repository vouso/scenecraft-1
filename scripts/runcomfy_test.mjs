import fs from 'fs';
import dotenv from 'dotenv';

// load .env.development
dotenv.config({ path: '.env.development' });

const API_KEY = process.env.RUNCOMFY_API_KEY;
if (!API_KEY) {
  console.error('RUNCOMFY_API_KEY not found in .env.development or environment');
  process.exit(1);
}

const MODEL = 'bytedance/seedream-4-5/edit';
const URL = `https://model-api.runcomfy.net/v1/models/${MODEL}`;

async function main() {
  const payload = {
    prompt: 'A clean product photo of a stylish ceramic mug on a white background, e-commerce, high detail, studio lighting',
    // request 7 variations
    num_images: 7,
    // resolution can be '4K' or a specific size string
    resolution: '2048x2048 (1:1)'
  };

  console.log('Sending request to RunComfy:', URL);

  const resp = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { raw: text };
  }

  const outPath = 'logs/runcomfy_test_result.json';
  try {
    fs.mkdirSync('logs', { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ status: resp.status, ok: resp.ok, body: data }, null, 2));
    console.log('Saved response to', outPath);
  } catch (e) {
    console.error('Failed to save result:', e);
  }

  console.log('Response status:', resp.status);
  console.log('Response body:', data);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
