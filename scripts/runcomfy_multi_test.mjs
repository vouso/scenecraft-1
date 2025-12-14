import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });
const API_KEY = process.env.RUNCOMFY_API_KEY;
if (!API_KEY) {
  console.error('RUNCOMFY_API_KEY not found in .env.development or environment');
  process.exit(1);
}

const MODEL = 'bytedance/seedream-4-5/edit';
const URL = `https://model-api.runcomfy.net/v1/models/${MODEL}`;

async function createRequests(count = 7) {
  const requests = [];
  for (let i = 0; i < count; i++) {
    const payload = {
      prompt: 'A clean product photo of a stylish ceramic mug on a white background, e-commerce, high detail, studio lighting',
      resolution: '2048x2048 (1:1)',
      seed: Math.floor(Math.random() * 1e9) + i,
    };

    console.log(`creating request ${i + 1}/${count}`);
    const resp = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`create request failed: ${resp.status} ${text}`);
    }

    const data = await resp.json();
    const requestId = data.request_id ?? data.requestId ?? data.id;
    requests.push({ raw: data, requestId, status_url: data.status_url, result_url: data.result_url });
    fs.writeFileSync('logs/runcomfy_multi_requests.json', JSON.stringify(requests, null, 2));
  }
  return requests;
}

async function pollRequests(requests, timeout = 180000) {
  const start = Date.now();
  const images = [];

  while (true) {
    for (const r of requests) {
      if (r.done) continue;
      const resultUrl = r.result_url ?? `https://model-api.runcomfy.net/v1/requests/${r.requestId}/result`;
      const statusUrl = r.status_url ?? `https://model-api.runcomfy.net/v1/requests/${r.requestId}/status`;
      try {
        const resp = await fetch(resultUrl, { headers: { Authorization: `Bearer ${API_KEY}` } });
        if (!resp.ok) {
          const s = await fetch(statusUrl, { headers: { Authorization: `Bearer ${API_KEY}` } });
          const statusData = await s.json().catch(() => null);
          r.status = statusData?.status ?? 'pending';
          continue;
        }

        const data = await resp.json();
        r.result = data;
        // extract images from possible shapes
        if (data.output) {
          if (typeof data.output === 'string') images.push(data.output);
          else if (Array.isArray(data.output)) images.push(...data.output.filter(Boolean));
          else if (data.output.image) images.push(data.output.image);
          else if (Array.isArray(data.output.images)) images.push(...data.output.images);
        }
        if (data.image) images.push(data.image);
        if (data.image_url) images.push(data.image_url);

        // determine completion; only mark done when provider reports completed or images found
        const state = data.state ?? data.status ?? data.task_status ?? null;
        if (state === 'completed' || images.length > 0) {
          r.done = true;
        } else {
          r.done = false;
          r.status = state ?? 'pending';
        }

        fs.writeFileSync('logs/runcomfy_multi_poll.json', JSON.stringify(requests, null, 2));
      } catch (e) {
        console.warn('poll error', e.message || e);
      }
    }

    const allDone = requests.every((r) => r.done);
    if (allDone) {
      fs.writeFileSync('logs/runcomfy_multi_final.json', JSON.stringify({ requests, images }, null, 2));
      return { requests, images };
    }

    if (Date.now() - start > timeout) {
      fs.writeFileSync('logs/runcomfy_multi_poll.json', JSON.stringify(requests, null, 2));
      throw new Error('Polling timed out');
    }

    await new Promise((r) => setTimeout(r, 4000));
  }
}

(async () => {
  try {
    fs.mkdirSync('logs', { recursive: true });
    const requests = await createRequests(7);
    console.log('created requests:', requests.map((r) => r.requestId));
    const result = await pollRequests(requests, 240000);
    console.log('done, images:', result.images.length);
  } catch (e) {
    console.error('error:', e);
    process.exit(1);
  }
})();
