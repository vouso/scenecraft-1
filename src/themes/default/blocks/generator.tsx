'use client';

import { useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

export function Generator({ section }: { section: any }) {
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!image || !description) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image, description }),
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const data = await response.json();
      sessionStorage.setItem('generated_images', JSON.stringify(data.images));
      router.push('/generated');
    } catch (error) {
      console.error('Error generating images:', error);
      // Handle error (e.g., show toast)
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-20 lg:py-32">
      <div className="container max-w-4xl">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-center">
              {section.description}
            </h1>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex gap-4">
              <Input
                placeholder={section.input_placeholder}
                className="h-12 text-lg"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
              />
              <Button
                size="lg"
                className="h-12 px-8 text-lg"
                onClick={handleGenerate}
                disabled={!image || !description || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  section.button_text
                )}
              </Button>
            </div>

            <div
              className={`border-muted-foreground/25 hover:bg-muted/50 relative flex aspect-video cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                isLoading ? 'pointer-events-none opacity-50' : ''
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => !isLoading && fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isLoading}
              />

              {image ? (
                <div className="relative h-full w-full overflow-hidden rounded-lg">
                  <Image
                    src={image}
                    alt="Uploaded preview"
                    fill
                    className="object-contain"
                  />
                  <button
                    onClick={clearImage}
                    className="bg-background/80 hover:bg-background absolute top-2 right-2 rounded-full p-1 transition-colors"
                    disabled={isLoading}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="bg-muted rounded-full p-4">
                    <ImagePlus className="h-8 w-8" />
                  </div>
                  <p className="text-lg font-medium">{section.upload_text}</p>
                  <p className="text-sm">{section.upload_subtext}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
