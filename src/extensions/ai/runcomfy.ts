import { getUuid } from '@/shared/lib/hash';

import { saveFiles } from '.';
import {
  AIConfigs,
  AIFile,
  AIGenerateParams,
  AIImage,
  AIMediaType,
  AIProvider,
  AITaskResult,
  AITaskStatus,
} from './types';

/**
 * RunComfy configs
 * @docs https://runcomfy.com/
 */
export interface RunComfyConfigs extends AIConfigs {
  apiKey: string;
  customStorage?: boolean; // use custom storage to save files
}

/**
 * RunComfy provider
 * @docs https://runcomfy.com/
 */
export class RunComfyProvider implements AIProvider {
  // provider name
  readonly name = 'runcomfy';
  // provider configs
  configs: RunComfyConfigs;

  // api base url
  private baseUrl = 'https://model-api.runcomfy.net/v1/models';

  // init provider
  constructor(configs: RunComfyConfigs) {
    this.configs = configs;
  }

  async generateImage({
    params,
  }: {
    params: AIGenerateParams;
  }): Promise<AITaskResult> {
    // default to flux-1-kontext/pro/edit if not specified, but usually model is passed
    // The user example: https://model-api.runcomfy.net/v1/models/blackforestlabs/flux-1-kontext/pro/edit
    // We need to construct the URL based on the model.
    // Let's assume the model param contains the full path suffix or we map it.
    // For now, I'll assume the model value passed from frontend matches the path or I'll handle the specific case.
    
    // Based on user example:
    // model: "blackforestlabs/flux-1-kontext/pro/edit" (or similar)
    
    let modelPath = params.model;
    // If the frontend passes just "flux-1-kontext", we might need to map it.
    // But let's try to be flexible.
    
    const apiUrl = `${this.baseUrl}/${modelPath}`;
    
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.configs.apiKey}`,
    };

    console.log('RunComfy API Key (masked):', this.configs.apiKey ? `${this.configs.apiKey.substring(0, 5)}...` : 'undefined');
    console.log('RunComfy Headers:', JSON.stringify(headers, null, 2));

    if (!params.prompt) {
      throw new Error('prompt is required');
    }

    // build request params
    let payload: any = {
      prompt: params.prompt,
      seed: Math.floor(Math.random() * 100000000), // random seed if not provided
    };

    if (params.options) {
      const options = params.options;
      // If caller provided one or more reference images, send them as `images` (RunComfy expects an array)
      if (
        options.image_input &&
        Array.isArray(options.image_input) &&
        options.image_input.length > 0
      ) {
        payload.images = options.image_input;
      }

      // pass resolution (e.g. "4K", "2048x2048 (1:1)") if provided
      if (options.resolution) {
        payload.resolution = options.resolution;
      }

      // aspect ratio can be forwarded if provided
      if (options.aspect_ratio) {
        payload.aspect_ratio = options.aspect_ratio;
      }

      if (options.seed) {
        payload.seed = options.seed;
      }

      // allow caller to request multiple outputs if supported by provider
      if (options.num_images || options.count) {
        payload.num_images = options.num_images || options.count;
      }
    }

    console.log('runcomfy input', apiUrl, payload);

    // If requesting multiple images, create multiple runcomfy requests (one per image)
    const requestedCount = payload.num_images ? Number(payload.num_images) : 1;
    if (requestedCount > 1) {
      const requests: any[] = [];
      for (let i = 0; i < requestedCount; i++) {
        // vary seed so results differ
        const thisPayload = { ...payload, seed: payload.seed ?? Math.floor(Math.random() * 100000000) + i };
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(thisPayload),
        });

        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(`request failed with status: ${resp.status}, ${errorText}`);
        }

        const data = await resp.json();
        // normalize returned request id
        const requestId = data.request_id ?? data.requestId ?? data.id;
        requests.push({ raw: data, requestId, status_url: data.status_url, result_url: data.result_url });
      }

      // create a synthetic task id that maps to these request ids; store requests in taskInfo
      const syntheticId = getUuid();
      return {
        taskStatus: AITaskStatus.PENDING,
        taskId: syntheticId,
        taskInfo: {
          requests,
        },
        taskResult: { requests },
      };
    }

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`request failed with status: ${resp.status}, ${errorText}`);
    }

    // The user example doesn't show the response format.
    // Usually these APIs return a task ID or the image directly (sync) or a polling URL.
    // RunComfy usually returns a list of images or a task ID.
    // Let's assume it returns a JSON with "images" or "output" array containing URLs, 
    // OR it might be async.
    // Wait, the user said "生图功能不正常" (Image generation not working) and gave a curl.
    // If I look at the curl, it's a POST.
    // Let's assume it returns the image URL directly or a list of images.
    // If it returns { "images": [...] } or { "output": [...] }
    
    const data = await resp.json();
    console.log('runcomfy output', data);

    // Let's adapt to common ComfyUI API wrappers.
    // Often they return { "id": "...", "status": "..." } for async
    // OR { "images": [{ "url": "..." }] } for sync.
    
    // If it's async, we need a taskId.
    // If it's sync, we fake a taskId and return success immediately.
    
    // Assuming sync for now based on "edit" endpoint naming often implying quick edits, 
    // but ComfyUI is usually slow.
    // However, if I look at `KieProvider`, it handles async.
    
    // Let's try to handle both or assume one. 
    // Without response docs, I'll assume it returns a list of images like:
    // { "images": ["url1", "url2"] } or { "output": ["url1"] }
    
    let imageUrls: string[] = [];
    if (data.images && Array.isArray(data.images)) {
      imageUrls = data.images.map((img: any) => (typeof img === 'string' ? img : img.url));
    } else if (data.output && Array.isArray(data.output)) {
      imageUrls = data.output.map((item: any) => (typeof item === 'string' ? item : item.url ?? item.image ?? item.uri));
    } else if (data.output && typeof data.output === 'object') {
      // e.g. { output: { image: '...' } } or { output: { images: [...] } }
      if (Array.isArray(data.output.images)) {
        imageUrls = data.output.images.map((i: any) => (typeof i === 'string' ? i : i.url ?? i.image ?? i.uri));
      } else if (typeof data.output.image === 'string') {
        imageUrls = [data.output.image];
      }
    } else if (data.image_url) {
      imageUrls = [data.image_url];
    }

    if (imageUrls.length > 0) {
        // Sync response
        return {
            taskStatus: AITaskStatus.SUCCESS,
            taskId: getUuid(), // fake task id
            taskInfo: {
                images: imageUrls.map(url => ({ imageUrl: url })),
            },
            taskResult: data,
        };
    }
    
    // If no images, maybe it's async and returned a request id.
    // RunComfy returns `request_id` for async jobs
    const requestId = data.request_id ?? data.requestId ?? data.id;
    if (requestId) {
      return {
        taskStatus: AITaskStatus.PENDING,
        taskId: requestId,
        taskInfo: data,
        taskResult: data,
      };
    }

    // Fallback
    throw new Error('Unknown response format from RunComfy');
  }

  // generate task
  async generate({
    params,
  }: {
    params: AIGenerateParams;
  }): Promise<AITaskResult> {
    if (params.mediaType === AIMediaType.IMAGE) {
      return this.generateImage({ params });
    }

    throw new Error(`mediaType not supported: ${params.mediaType}`);
  }

  async query({ taskId, taskInfo }: { taskId: string; taskInfo?: any }): Promise<AITaskResult> {
    const headers: any = {
      Authorization: `Bearer ${this.configs.apiKey}`,
      'Content-Type': 'application/json',
    };

    // If taskInfo includes a list of child requests, treat this as a composite job and poll each child.
    if (taskInfo && Array.isArray(taskInfo.requests)) {
      const requests = taskInfo.requests as any[];
      const images: string[] = [];
      let anyPending = false;
      let anyFailed = false;

      for (const r of requests) {
        const rid = r.requestId ?? r.request_id ?? r.id;
        const resultUrl = r.result_url ?? `https://model-api.runcomfy.net/v1/requests/${rid}/result`;
        const statusUrl = r.status_url ?? `https://model-api.runcomfy.net/v1/requests/${rid}/status`;

        try {
          const resp = await fetch(resultUrl, { method: 'GET', headers });
          if (!resp.ok) {
            // not ready; check status endpoint
            const statusResp = await fetch(statusUrl, { method: 'GET', headers });
            if (!statusResp.ok) {
              anyPending = true;
              continue;
            }
            const statusData = await statusResp.json();
            if (statusData.status && statusData.status !== 'completed') {
              anyPending = true;
              continue;
            }
          }

          const data = await resp.json();
          // extract image urls
          if (data.output) {
            if (typeof data.output === 'string') images.push(data.output);
            else if (Array.isArray(data.output)) images.push(...data.output.filter(Boolean).map((it: any) => (typeof it === 'string' ? it : it.url ?? it.image ?? it.uri)));
            else if (data.output.image) images.push(data.output.image);
            else if (Array.isArray(data.output.images)) images.push(...data.output.images.map((it: any) => (typeof it === 'string' ? it : it.url ?? it.image ?? it.uri)));
          } else if (data.image || data.image_url) {
            images.push(data.image ?? data.image_url);
          }
        } catch (e) {
          anyFailed = true;
        }
      }

      if (images.length > 0 && !anyPending) {
        const imageObjs = images.map((url) => ({ imageUrl: url }));
        return {
          taskStatus: AITaskStatus.SUCCESS,
          taskId,
          taskInfo: { images: imageObjs },
          taskResult: { images },
        };
      }

      if (anyFailed) {
        return {
          taskStatus: AITaskStatus.FAILED,
          taskId,
          taskInfo,
          taskResult: { images },
        };
      }

      return {
        taskStatus: AITaskStatus.PENDING,
        taskId,
        taskInfo,
        taskResult: { images },
      };
    }

    // Otherwise assume taskId is a single RunComfy request id
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(taskId);
    if (!isUuid) {
      throw new Error('RunComfy query: invalid task id');
    }

    const resultUrl = `https://model-api.runcomfy.net/v1/requests/${taskId}/result`;
    const statusUrl = `https://model-api.runcomfy.net/v1/requests/${taskId}/status`;

    const resp = await fetch(resultUrl, { method: 'GET', headers });
    if (!resp.ok) {
      const statusResp = await fetch(statusUrl, { method: 'GET', headers });
      if (!statusResp.ok) {
        const errText = await statusResp.text();
        throw new Error(`request failed with status: ${statusResp.status}, ${errText}`);
      }
      const statusData = await statusResp.json();
      return {
        taskStatus: AITaskStatus.PENDING,
        taskId,
        taskInfo: statusData,
        taskResult: statusData,
      };
    }

    const data = await resp.json();
    const state = data.state ?? data.status ?? data.task_status ?? null;
    let taskStatus = AITaskStatus.PENDING;
    if (state === 'in_queue') taskStatus = AITaskStatus.PENDING;
    else if (state === 'in_progress') taskStatus = AITaskStatus.PROCESSING;
    else if (state === 'completed') taskStatus = AITaskStatus.SUCCESS;
    else if (state === 'cancelled') taskStatus = AITaskStatus.FAILED;

    return {
      taskStatus,
      taskId,
      taskInfo: data,
      taskResult: data,
    };
  }
}
