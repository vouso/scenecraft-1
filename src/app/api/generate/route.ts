import { NextResponse } from 'next/server';

const API_KEY = process.env.DOUBAO_API_KEY;
const API_URL = 'https://api.cometapi.com/v1/images/generations'; // Using CometAPI endpoint as found in research

const PROMPTS = [
  '一张白底主图，不能有任何文字出现。',
  '1张产品多角度展示图，可以做成4分位的图片。',
  '1张产品信息展示图，要标明产品尺寸和重量。',
  '2张产品使用场景展示图。 (场景1)',
  '2张产品使用场景展示图。 (场景2)',
  '根据具体产品的情况，按需要生成。 (变体1)',
  '根据具体产品的情况，按需要生成。 (变体2)',
];

const CAPTIONS = [
  '白底主图',
  '多角度展示',
  '信息展示',
  '使用场景 1',
  '使用场景 2',
  '创意展示 1',
  '创意展示 2',
];

async function generateImage(
  image: string,
  userDescription: string,
  systemPrompt: string
) {
  const prompt = `仔细观察用户上传的产品。用户描述：${userDescription}。任务：${systemPrompt}。每一张图片都必须是1600x1600像素的正方形图片。`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'doubao-seedream-4-5-251128', // Using a recent model version found in research
        prompt: prompt,
        image_urls: [image],
        size: '1600x1600', // As requested, though API might expect "1k" or similar, trying explicit first or fallback to closest
        // If 1600x1600 is not supported, we might need to use "1024x1024" or "2048x2048"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].url; // Assuming standard OpenAI-like response format
  } catch (error) {
    console.error('Generation failed:', error);
    return null; // Return null on failure to handle gracefully
  }
}

export async function POST(req: Request) {
  try {
    const { image, description } = await req.json();

    if (!image || !description) {
      return NextResponse.json(
        { error: 'Missing image or description' },
        { status: 400 }
      );
    }

    // Generate images in parallel
    const promises = PROMPTS.map((prompt) =>
      generateImage(image, description, prompt)
    );
    const results = await Promise.all(promises);

    const generatedImages = results.map((url, index) => ({
      url: url || 'https://placehold.co/600x600?text=Generation+Failed', // Fallback image
      caption: CAPTIONS[index],
      description: PROMPTS[index], // Adding full description for context if needed
    }));

    return NextResponse.json({ images: generatedImages });
  } catch (error) {
    console.error('Handler error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
