import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });
const API_KEY = process.env.RUNCOMFY_API_KEY;
if (!API_KEY) {
  console.error('RUNCOMFY_API_KEY missing');
  process.exit(1);
}

// Simulate the JSON body the frontend would send
const payload = {
  mediaType: 'image',
  scene: 'text-to-image',
  provider: 'runcomfy',
  model: 'bytedance/seedream-4-5/edit',
  prompt: 'E-commerce product shot: sleek ceramic mug on white background, studio lighting, high detail',
  options: {
    num_images: 7,
    resolution: '2048x2048 (1:1)'
  }
};

const MODEL = payload.model;
const URL_BASE = `https://model-api.runcomfy.net/v1/models`;
const apiUrl = `${URL_BASE}/${MODEL}`;

async function simulateGenerate() {
  try {
    const num = payload.options?.num_images ? Number(payload.options.num_images) : 1;
    if (num > 1) {
      const requests = [];
      for (let i = 0; i < num; i++) {
        const body = {
          prompt: payload.prompt,
          resolution: payload.options.resolution,
          seed: Math.floor(Math.random() * 1e9) + i,
        };
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`,
          },
          body: JSON.stringify(body),
        });
        const data = await resp.json();
        requests.push({ request: data, requestId: data.request_id ?? data.requestId ?? data.id, status_url: data.status_url, result_url: data.result_url });
        console.log('created', data.request_id ?? data.requestId ?? data.id);
      }

      const syntheticId = `sim-${Date.now()}`;
      const result = {
        id: syntheticId,
        status: 'pending',
        requests,
      };
      fs.writeFileSync('logs/simulate_api_generate_result.json', JSON.stringify(result, null, 2));
      console.log('Simulated generate result saved to logs/simulate_api_generate_result.json');
      console.log(JSON.stringify(result, null, 2));
      return result;
    } else {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ prompt: payload.prompt, resolution: payload.options?.resolution }),
      });
      const data = await resp.json();
      fs.writeFileSync('logs/simulate_api_generate_result.json', JSON.stringify(data, null, 2));
      console.log('Simulated generate result saved to logs/simulate_api_generate_result.json');
      console.log(JSON.stringify(data, null, 2));
      return data;
    }
  } catch (e) {
    console.error('simulateGenerate error', e);
    process.exit(1);
  }
}

simulateGenerate();
