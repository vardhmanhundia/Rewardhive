/**
 * Hook for managing image attachments in the chat composer.
 * Handles file selection, preview URLs, and base64 conversion.
 */
import { useCallback, useRef, useState } from 'react';

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export interface ImageAttachment {
  file: File;
  previewUrl: string;
  b64: string;
  mime: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:…;base64, prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useImageAttachment() {
  const [attachment, setAttachment] = useState<ImageAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const clear = useCallback(() => {
    setAttachment((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`Unsupported type: ${file.type}. Use PNG, JPEG, WebP, or GIF.`);
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Image too large (max 20 MB).');
      return;
    }
    const b64 = await fileToBase64(file);
    const previewUrl = URL.createObjectURL(file);
    setAttachment({ file, previewUrl, b64, mime: file.type });
  }, []);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
            return;
          }
        }
      }
    },
    [handleFile],
  );

  return { attachment, error, inputRef, open, clear, onChange, onDrop, onPaste };
}
