import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type RecorderStatus = 'idle' | 'recording' | 'unsupported';

const MAX_SECONDS = 120;

// Grabadora de notas de voz. Solo web (MediaRecorder); en nativo devuelve
// 'unsupported' — la interfaz queda lista para una implementación expo-audio.
export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopResolveRef = useRef<((b: Blob | null) => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const supported =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  useEffect(() => {
    if (!supported) setStatus('unsupported');
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, [supported]);

  const stop = useCallback((): Promise<Blob | null> => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      stopResolveRef.current = resolve;
      rec.stop();
    });
  }, []);

  const start = useCallback(async () => {
    if (!supported || status === 'recording') return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus('idle');
      setSeconds(0);
      const blob = chunksRef.current.length
        ? new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        : null;
      stopResolveRef.current?.(blob);
      stopResolveRef.current = null;
    };
    recorderRef.current = rec;
    rec.start();
    setStatus('recording');
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) void stop();
        return s + 1;
      });
    }, 1000);
  }, [supported, status, stop]);

  const cancel = useCallback(async () => {
    stopResolveRef.current = null; // el blob resultante se descarta
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  return { status, seconds, supported, start, stop, cancel };
}
