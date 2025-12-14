import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });
const API_KEY = process.env.RUNCOMFY_API_KEY;
if (!API_KEY) {
  console.error('RUNCOMFY_API_KEY not found in .env.development or environment');
  process.exit(1);
}

const LOG_PATH = 'logs/runcomfy_test_result.json';
if (!fs.existsSync(LOG_PATH)) {
  console.error('Runcomfy test result not found. Run scripts/runcomfy_test.mjs first.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
const resultUrl = raw.body?.result_url;
const statusUrl = raw.body?.status_url;
if (!resultUrl) {
  console.error('result_url not found in test result');
  process.exit(1);
}

async function poll(url, interval = 5000, timeout = 120000) {
  const start = Date.now();
  while (true) {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
    const text = await resp.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }
    console.log('Polled at', new Date().toISOString(), 'status', resp.status);
    console.log(JSON.stringify(data, null, 2));

    // Save each poll response
    fs.writeFileSync('logs/runcomfy_poll_latest.json', JSON.stringify({ time: Date.now(), status: resp.status, body: data }, null, 2));

    // check if completed
    const state = data.state ?? data.status ?? data.task_status ?? null;
    if (state === 'completed' || (data.output && (data.output.images || data.output.length))) {
      console.log('Completed, saving final result to logs/runcomfy_final.json');
      fs.writeFileSync('logs/runcomfy_final.json', JSON.stringify(data, null, 2));
      return data;
    }

    if (Date.now() - start > timeout) {
      throw new Error('Polling timed out');
    }

    await new Promise((r) => setTimeout(r, interval));
  }
}

poll(resultUrl, 5000, 180000)
  .then((res) => console.log('Done polling'))
  .catch((err) => {
    console.error('Polling failed:', err);
    process.exit(1);
  });
