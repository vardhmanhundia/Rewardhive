/**
 * Hooks for voice input (speech-to-text) and output (text-to-speech).
 * Uses the Web Speech API — works in Chrome, Edge, Safari; Firefox has partial support.
 * TTS answers are rewritten by Muse Spark into casual spoken-word style before voicing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import cardService from '@/services/cardService';

// ── Speech-to-text ──────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const SpeechRecognitionCtor: (new () => any) | undefined =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    : undefined;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function useSpeechToText(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => !!SpeechRecognitionCtor);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  const start = useCallback(() => {
    if (!SpeechRecognitionCtor || listening) return;
    const rec = new SpeechRecognitionCtor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript;
      if (text) onTranscript(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, onTranscript]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  return { listening, supported, start, stop, toggle };
}

// ── Text-to-speech (Edge TTS via backend) ───────────────────────────────

export function useTextToSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cancelledRef = useRef(false);

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Stop any current playback.
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      cancelledRef.current = false;
      setLoading(true);

      try {
        const blob = await cardService.speak(text);
        if (cancelledRef.current) return;

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };

        setLoading(false);
        setSpeaking(true);
        await audio.play();
      } catch {
        setLoading(false);
        setSpeaking(false);
      }
    },
    [],
  );

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setLoading(false);
    setSpeaking(false);
  }, []);

  const toggle = useCallback(
    (text: string) => {
      if (speaking || loading) stop();
      else speak(text);
    },
    [speaking, loading, speak, stop],
  );

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return { speaking, loading, supported: true, speak, stop, toggle };
}
