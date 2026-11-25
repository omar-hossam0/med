"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Microphone capture + live waveform levels + MediaRecorder.
 *
 * Real audio only: the bars are driven by RMS values computed from the
 * AnalyserNode's time-domain samples. Nothing is synthesised, and no audio is
 * uploaded or persisted — the blob stays in memory for this session.
 *
 * The stream is never routed to an AudioContext destination, so the microphone
 * cannot be monitored through the speakers.
 */

export const WAVE_BARS = 72;

/** Conservative silence gate: below this RMS the bars stay at the baseline. */
const NOISE_FLOOR = 0.012;
/** RMS that maps to a full-height bar. Normal speech sits around 0.08–0.25. */
const LOUD_LEVEL = 0.28;
/** Attack / release coefficients — fast up, slow down, no fake motion. */
const ATTACK = 0.55;
const RELEASE = 0.16;

export type MicStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "stopped"
  | "denied"
  | "unavailable"
  | "unsupported"
  | "error";

export type MicError = { title: string; detail: string } | null;

export type AudioRecorderApi = {
  status: MicStatus;
  error: MicError;
  /** Seconds of audio actually recorded; paused time is excluded. */
  seconds: number;
  deviceLabel: string | null;
  mimeType: string | null;
  blob: Blob | null;
  /** Live bar amplitudes (0–1), updated on the animation frame. */
  levelsRef: React.MutableRefObject<Float32Array>;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
};

function describeError(error: unknown): { status: MicStatus; error: MicError } {
  const name = error instanceof Error ? error.name : "";

  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      status: "unsupported",
      error: {
        title: "Microphone not supported",
        detail: "This browser does not expose microphone access. Try a current version of Chrome, Edge, or Firefox.",
      },
    };
  }

  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      status: "denied",
      error: {
        title: "Microphone permission denied",
        detail: "Allow microphone access for this site in your browser settings, then try again.",
      },
    };
  }

  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return {
      status: "unavailable",
      error: {
        title: "No microphone found",
        detail: "Connect a microphone and try again. The consultation can still be documented manually.",
      },
    };
  }

  if (name === "NotReadableError" || name === "AbortError") {
    return {
      status: "unavailable",
      error: {
        title: "Microphone is busy",
        detail: "Another application is using the microphone. Close it and try again.",
      },
    };
  }

  return {
    status: "error",
    error: {
      title: "Could not start recording",
      detail: "The microphone could not be initialised. Check your audio device and try again.",
    },
  };
}

export function useAudioRecorder(): AudioRecorderApi {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [error, setError] = useState<MicError>(null);
  const [seconds, setSeconds] = useState(0);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  const levelsRef = useRef<Float32Array>(new Float32Array(WAVE_BARS));

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const samplesRef = useRef<Float32Array | null>(null);

  // Timer bookkeeping: accumulate real recording time across pauses.
  const accumulatedRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (startedAtRef.current === null) return;
    const elapsed = accumulatedRef.current + (Date.now() - startedAtRef.current) / 1000;
    setSeconds(Math.floor(elapsed));
  }, []);

  const release = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    clearTimer();
    startedAtRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    if (contextRef.current && contextRef.current.state !== "closed") {
      void contextRef.current.close().catch(() => undefined);
    }
    contextRef.current = null;

    levelsRef.current.fill(0);
  }, [clearTimer]);

  /* -------------------------------------------------------------- */
  /* Waveform sampling                                              */
  /* -------------------------------------------------------------- */

  const sample = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    if (!samplesRef.current || samplesRef.current.length !== analyser.fftSize) {
      samplesRef.current = new Float32Array(analyser.fftSize);
    }
    const samples = samplesRef.current;
    analyser.getFloatTimeDomainData(samples);

    let sum = 0;
    for (let index = 0; index < samples.length; index += 1) {
      sum += samples[index] * samples[index];
    }
    const rms = Math.sqrt(sum / samples.length);

    // Map RMS to 0–1 with a conservative noise floor, then smooth.
    const normalized =
      rms <= NOISE_FLOOR ? 0 : Math.min(1, (rms - NOISE_FLOOR) / (LOUD_LEVEL - NOISE_FLOOR));

    const levels = levelsRef.current;
    const previous = levels[levels.length - 1] ?? 0;
    const smoothed =
      normalized > previous
        ? previous + (normalized - previous) * ATTACK
        : previous + (normalized - previous) * RELEASE;

    // Shift the history left; the newest sample enters on the right.
    levels.copyWithin(0, 1);
    levels[levels.length - 1] = smoothed;

    rafRef.current = requestAnimationFrame(sample);
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const described = describeError(new Error("unsupported"));
      setStatus(described.status);
      setError(described.error);
      return;
    }

    setError(null);
    setStatus("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (caught) {
      const described = describeError(caught);
      setStatus(described.status);
      setError(described.error);
      return;
    }

    streamRef.current = stream;
    setDeviceLabel(stream.getAudioTracks()[0]?.label || "Default microphone");

    // The stream is analysed but never connected to a destination, so the
    // doctor does not hear their own microphone.
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      stream.getTracks().forEach((track) => track.stop());
      const described = describeError(new Error("unsupported"));
      setStatus(described.status);
      setError(described.error);
      return;
    }

    try {
      const context = new AudioContextCtor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      context.createMediaStreamSource(stream).connect(analyser);
      contextRef.current = context;
      analyserRef.current = analyser;
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      const described = describeError(new Error("audio-init"));
      setStatus(described.status);
      setError(described.error);
      return;
    }

    // MediaRecorder: prefer Opus in WebM, fall back to whatever is supported.
    const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    const chosen = preferred.find((type) => MediaRecorder.isTypeSupported?.(type));

    try {
      const recorder = new MediaRecorder(stream, chosen ? { mimeType: chosen } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || chosen || "audio/webm";
        setBlob(new Blob(chunksRef.current, { type }));
        chunksRef.current = [];
      };
      recorder.onerror = () => {
        setStatus("error");
        setError({
          title: "Recording stopped unexpectedly",
          detail: "The audio device reported an error. Start a new recording to continue.",
        });
      };
      recorder.start(500);
      recorderRef.current = recorder;
      setMimeType(recorder.mimeType || chosen || "audio/webm");
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setStatus("error");
      setError({
        title: "Recording could not start",
        detail: "This browser cannot record audio in a supported format.",
      });
      return;
    }

    accumulatedRef.current = 0;
    startedAtRef.current = Date.now();
    setSeconds(0);
    setStatus("recording");

    clearTimer();
    timerRef.current = window.setInterval(tick, 250);

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(sample);
  }, [clearTimer, sample, tick]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    recorder.pause();
    if (startedAtRef.current !== null) {
      accumulatedRef.current += (Date.now() - startedAtRef.current) / 1000;
      startedAtRef.current = null;
    }
    clearTimer();
    setSeconds(Math.floor(accumulatedRef.current));
    setStatus("paused");
  }, [clearTimer]);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;

    recorder.resume();
    startedAtRef.current = Date.now();
    setStatus("recording");
    clearTimer();
    timerRef.current = window.setInterval(tick, 250);
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(sample);
  }, [clearTimer, sample, tick]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;

    if (startedAtRef.current !== null) {
      accumulatedRef.current += (Date.now() - startedAtRef.current) / 1000;
      startedAtRef.current = null;
    }
    const total = Math.floor(accumulatedRef.current);
    clearTimer();
    setSeconds(total);

    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    }
    recorderRef.current = null;

    release();
    setStatus("stopped");
  }, [clearTimer, release]);

  // Release the device if the doctor navigates away mid-recording.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* noop */
        }
      }
      recorderRef.current = null;
      release();
    };
  }, [release]);

  return {
    status,
    error,
    seconds,
    deviceLabel,
    mimeType,
    blob,
    levelsRef,
    start,
    pause,
    resume,
    stop,
  };
}
