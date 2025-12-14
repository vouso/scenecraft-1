'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { Button } from '@/shared/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface GeneratedImage {
  url: string;
  caption: string;
  description: string;
}

export default function GeneratedPage() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const router = useRouter();

  useEffect(() => {
    const storedImages = sessionStorage.getItem('generated_images');
    if (storedImages) {
      try {
        setImages(JSON.parse(storedImages));
      } catch (e) {
        console.error('Failed to parse images', e);
      }
    } else {
      // Redirect back if no images found
      router.push('/');
    }
  }, [router]);

  if (images.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Generator
        </Button>
        <h1 className="text-3xl font-bold">Generated Images</h1>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {images.map((img, index) => (
          <div key={index} className="flex flex-col gap-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
              <Image
                src={img.url}
                alt={img.caption}
                fill
                className="object-cover"
              />
            </div>
            <div className="space-y-1">
              <h3 className="font-medium">{img.caption}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {img.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
