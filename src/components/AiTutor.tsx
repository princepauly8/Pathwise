import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  ImagePlus,
  Loader2,
  Mic,
  RefreshCw,
  RotateCcw,
  Send,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import type { StudentProfile, TutorMediaPayload, TutorMessage } from '../types/study';
import { RichText } from './RichText';

interface AiTutorProps {
  profile: StudentProfile;
  activeSubject: string;
  activeModuleId: string | null;
  isThinking: boolean;
  tutorError: string | null;
  canRetry?: boolean;
  onSelectSubject: (subject: string) => void;
  onSendMessage: (
    subject: string,
    message: string,
    moduleTitle?: string,
    media?: TutorMediaPayload
  ) => void;
  onRetryLastMessage?: () => void;
}

interface AttachedPhoto {
  mimeType: string;
  data: string;
  previewUrl: string;
}

interface AttachedAudio {
  mimeType: string;
  data: string;
  previewUrl: string;
  durationSec: number;
}

const MAX_RECORDING_SECONDS = 90;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.max(0, seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded media.'));
    reader.readAsDataURL(blob);
  });
}

function compressImageFile(file: File): Promise<AttachedPhoto> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1280;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Unable to process photo in this browser.');
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        resolve({
          mimeType: 'image/jpeg',
          data: base64,
          previewUrl: dataUrl,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Unable to process photo.'));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read the selected image file.'));
    };
    img.src = objectUrl;
  });
}

function pickSupportedAudioMime(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return 'audio/webm';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export const AiTutor: React.FC<AiTutorProps> = ({
  profile,
  activeSubject,
  activeModuleId,
  isThinking,
  tutorError,
  canRetry = false,
  onSelectSubject,
  onSendMessage,
  onRetryLastMessage,
}) => {
  const [draft, setDraft] = useState('');
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [attachedPhoto, setAttachedPhoto] = useState<AttachedPhoto | null>(null);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [attachedAudio, setAttachedAudio] = useState<AttachedAudio | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);
  const discardRecordingRef = useRef<boolean>(false);

  const currentPath = profile.paths[activeSubject];
  const activeModule =
    currentPath?.modules.find((m) => m.id === activeModuleId) ??
    currentPath?.modules.find((m) => m.status === 'in_progress') ??
    currentPath?.modules[0];

  const messages: TutorMessage[] = profile.tutorHistory[activeSubject] ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, isThinking]);

  const stopCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopMicResources = useCallback(() => {
    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
  }, []);

  // Clean up camera, microphone, and object URLs on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      discardRecordingRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore stop errors on teardown
        }
      }
      stopMicResources();
    };
  }, [stopCameraStream, stopMicResources]);

  useEffect(() => {
    return () => {
      if (attachedAudio?.previewUrl) {
        URL.revokeObjectURL(attachedAudio.previewUrl);
      }
    };
  }, [attachedAudio]);

  // Attach active camera stream to video element once rendered
  useEffect(() => {
    if (isCameraOpen && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
      videoRef.current.play().catch(() => {
        // Autoplay might settle on metadata load
      });
    }
  }, [isCameraOpen]);

  const openCamera = async (facing: 'environment' | 'user' = cameraFacingMode) => {
    setMediaError(null);
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setMediaError('Camera access is not supported in this browser. You can upload a photo instead.');
      return;
    }

    stopCameraStream();
    setIsStartingCamera(true);
    setIsCameraOpen(true);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        // Fallback to any available webcam if ideal facingMode fails
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      stopCameraStream();
      setIsCameraOpen(false);
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMediaError(
          'Camera permission was denied. Allow camera access in your browser, or use Upload Photo.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setMediaError('No camera was detected on this device. Use Upload Photo to share a problem.');
      } else {
        setMediaError('Unable to open the camera right now. You can upload a photo instead.');
      }
    } finally {
      setIsStartingCamera(false);
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setIsCameraOpen(false);
  };

  const handleFlipCamera = () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacing);
    void openCamera(nextFacing);
  };

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setMediaError('Camera feed is still warming up. Please try capturing again.');
      return;
    }

    const maxDim = 1280;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setMediaError('Unable to capture frame from camera.');
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);

    setAttachedPhoto({
      mimeType: 'image/jpeg',
      data: base64,
      previewUrl: dataUrl,
    });
    setMediaError(null);
    closeCamera();
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setMediaError(null);
    if (!file.type.startsWith('image/')) {
      setMediaError('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    try {
      const photo = await compressImageFile(file);
      setAttachedPhoto(photo);
      if (isCameraOpen) closeCamera();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Unable to attach that photo.');
    }
  };

  const stopRecording = useCallback((discard = false) => {
    discardRecordingRef.current = discard;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        stopMicResources();
        setIsRecording(false);
      }
    } else {
      stopMicResources();
      setIsRecording(false);
    }
  }, [stopMicResources]);

  const startRecording = async () => {
    setMediaError(null);
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      setMediaError('Microphone voice recording is not supported in this browser.');
      return;
    }

    if (attachedAudio) {
      setAttachedAudio(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;

      const mimeType = pickSupportedAudioMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      discardRecordingRef.current = false;
      recordStartRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const elapsedSec = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        stopMicResources();
        setIsRecording(false);

        if (discardRecordingRef.current || audioChunksRef.current.length === 0) {
          audioChunksRef.current = [];
          return;
        }

        const finalMime = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0].trim();
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
        audioChunksRef.current = [];

        if (audioBlob.size < 256) {
          setMediaError('Voice recording was too short. Please tap the mic and speak clearly.');
          return;
        }

        try {
          const base64 = await blobToBase64(audioBlob);
          const previewUrl = URL.createObjectURL(audioBlob);
          setAttachedAudio({
            mimeType: finalMime,
            data: base64,
            previewUrl,
            durationSec: elapsedSec,
          });
        } catch (err) {
          setMediaError(
            err instanceof Error ? err.message : 'Unable to process voice recording.'
          );
        }
      };

      recorder.onerror = () => {
        stopMicResources();
        setIsRecording(false);
        setMediaError('Microphone recording encountered an error. Please try again.');
      };

      recorder.start(250);

      recordTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordStartRef.current) / 1000);
        setRecordingSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS) {
          stopRecording(false);
        }
      }, 300);
    } catch (err) {
      stopMicResources();
      setIsRecording(false);
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMediaError(
          'Microphone permission was denied. Allow microphone access in your browser to ask by voice.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setMediaError('No microphone was detected on this device.');
      } else {
        setMediaError('Unable to access the microphone right now. Please try again.');
      }
    }
  };

  const starterPrompts = activeModule
    ? [
        `Explain the core intuition behind "${activeModule.title}" for ${profile.classLevel} (${profile.syllabus}).`,
        `Walk me through one step-by-step practice problem on ${activeModule.concepts[0] ?? activeModule.title}.`,
        `What are the most common ${profile.syllabus} exam mistakes students make in ${activeModule.title}?`,
      ]
    : [
        `Give me a concise study roadmap for ${profile.classLevel} ${profile.syllabus} ${activeSubject}.`,
        `Quiz me on a foundational concept in ${activeSubject}.`,
      ];

  const canSend = !isThinking && !isRecording && (Boolean(draft.trim()) || Boolean(attachedPhoto) || Boolean(attachedAudio));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;

    const trimmed = draft.trim();
    const media: TutorMediaPayload | undefined =
      attachedPhoto || attachedAudio
        ? {
            image: attachedPhoto
              ? {
                  mimeType: attachedPhoto.mimeType,
                  data: attachedPhoto.data,
                  previewUrl: attachedPhoto.previewUrl,
                }
              : undefined,
            audio: attachedAudio
              ? {
                  mimeType: attachedAudio.mimeType,
                  data: attachedAudio.data,
                  durationSec: attachedAudio.durationSec,
                }
              : undefined,
          }
        : undefined;

    setDraft('');
    setAttachedPhoto(null);
    setAttachedAudio(null);
    setMediaError(null);
    onSendMessage(activeSubject, trimmed, activeModule?.title, media);
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Subject Scope */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            AI Study Tutor <span aria-hidden="true">·</span>{' '}
            <span className="text-[#0284C7] dark:text-sky-400">{profile.syllabus}</span>{' '}
            <span aria-hidden="true">·</span> {profile.classLevel}{' '}
            <span aria-hidden="true">·</span> {activeSubject}
            {profile.language && profile.language !== 'English' ? (
              <>
                {' '}
                <span aria-hidden="true">·</span>{' '}
                <span className="text-[#0284C7] dark:text-sky-400">{profile.language}</span>
              </>
            ) : null}
            {activeModule ? (
              <>
                {' '}
                <span aria-hidden="true">·</span> {activeModule.title}
              </>
            ) : null}
          </p>
          <h1 className="font-display text-3xl font-semibold text-[#0F172A] dark:text-slate-100">
            Buddy
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="tutor-subject-select" className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Subject:
          </label>
          <select
            id="tutor-subject-select"
            value={activeSubject}
            onChange={(e) => onSelectSubject(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-[#0F172A] dark:text-slate-100"
          >
            {profile.subjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Conversation Container */}
      <section className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl flex flex-col min-h-[500px] max-h-[74vh]">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="py-4 space-y-5 max-w-2xl">
              <div className="space-y-1.5">
                <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                  Ask Buddy anything about {profile.classLevel} {profile.syllabus} {activeSubject}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Type a doubt, snap a photo of your notebook or textbook question with the{' '}
                  <strong>Camera</strong>, or speak your question in{' '}
                  <strong>{profile.language || 'any language'}</strong> with the{' '}
                  <strong>Microphone</strong>.
                </p>
              </div>
              <div className="space-y-2">
                {starterPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSendMessage(activeSubject, prompt, activeModule?.title)}
                    disabled={isThinking}
                    className="block w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'student' ? 'items-end' : 'items-start'
                }`}
              >
                <span className="text-xs text-slate-400 dark:text-slate-500 mb-1">
                  {msg.role === 'student' ? profile.name.split(' ')[0] : 'Buddy'}
                </span>
                <div
                  className={`max-w-2xl rounded-xl px-4 py-3.5 space-y-2.5 ${
                    msg.role === 'student'
                      ? 'bg-[#0F172A] dark:bg-sky-600 text-white text-sm leading-relaxed'
                      : 'bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[#0F172A] dark:text-slate-100'
                  }`}
                >
                  {msg.role === 'student' && msg.imagePreviewUrl && (
                    <img
                      src={msg.imagePreviewUrl}
                      alt="Captured study problem"
                      className="max-h-52 w-auto rounded-lg border border-slate-700 dark:border-sky-400/50 object-contain"
                    />
                  )}
                  {msg.role === 'student' && msg.hasAudio && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-sky-300 dark:text-sky-100 font-medium">
                      <Volume2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Voice question
                        {msg.audioDurationSec ? ` · ${formatDuration(msg.audioDurationSec)}` : ''}
                      </span>
                    </div>
                  )}
                  {msg.role === 'student' ? (
                    <p>{msg.content}</p>
                  ) : (
                    <RichText text={msg.content} />
                  )}
                </div>
              </div>
            ))
          )}

          {isThinking && (
            <div className="flex items-center gap-2.5 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-[#0284C7] dark:text-sky-400" aria-hidden="true" />
              <span>Buddy is preparing a {profile.classLevel} explanation...</span>
            </div>
          )}

          {tutorError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300 flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" aria-hidden="true" />
                <span>{tutorError}</span>
              </div>
              {canRetry && onRetryLastMessage && (
                <button
                  type="button"
                  onClick={onRetryLastMessage}
                  disabled={isThinking}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-900 dark:text-red-200 bg-white dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Retry
                </button>
              )}
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Inline Live Camera Viewfinder Panel */}
        {isCameraOpen && (
          <div
            data-testid="tutor-camera-panel"
            className="border-t border-slate-200 dark:border-slate-800 bg-slate-950 p-4 space-y-3"
          >
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold text-white">
                Point camera at a math problem, textbook page, or diagram
              </span>
              <button
                type="button"
                onClick={closeCamera}
                aria-label="Close camera"
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="relative rounded-lg overflow-hidden bg-black max-h-64 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-64 object-contain"
              />
              {isStartingCamera && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/75 text-xs text-white">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Starting camera...
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFlipCamera}
                  disabled={isStartingCamera}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  Switch Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                  Upload Photo
                </button>
              </div>

              <button
                type="button"
                onClick={handleCapturePhoto}
                disabled={isStartingCamera}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                Capture Photo
              </button>
            </div>
          </div>
        )}

        {/* Active Microphone Recording Strip */}
        {isRecording && (
          <div
            data-testid="tutor-recording-bar"
            className="border-t border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 text-xs font-semibold text-red-900 dark:text-red-200">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" aria-hidden="true" />
              <span>Listening via microphone...</span>
              <span className="font-mono text-red-700 dark:text-red-300 tabular-nums">
                {formatDuration(recordingSeconds)} / {formatDuration(MAX_RECORDING_SECONDS)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stopRecording(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => stopRecording(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                Stop & Attach
              </button>
            </div>
          </div>
        )}

        {/* Attached Photo / Voice Preview Bar */}
        {(attachedPhoto || attachedAudio) && !isRecording && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/50 px-4 py-3 flex flex-wrap items-center gap-3">
            {attachedPhoto && (
              <div className="relative inline-flex items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 pr-3">
                <img
                  src={attachedPhoto.previewUrl}
                  alt="Attached study photo preview"
                  className="w-12 h-12 rounded-md object-cover border border-slate-200 dark:border-slate-700"
                />
                <div className="text-xs">
                  <p className="font-semibold text-[#0F172A] dark:text-slate-100">Photo ready</p>
                  <p className="text-slate-500 dark:text-slate-400">Tap Ask to solve</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedPhoto(null)}
                  aria-label="Remove attached photo"
                  className="ml-1 p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {attachedAudio && (
              <div className="inline-flex items-center gap-2.5 rounded-lg border border-sky-200 dark:border-sky-800/80 bg-white dark:bg-slate-900 px-3 py-1.5">
                <Volume2 className="w-4 h-4 text-[#0284C7] dark:text-sky-400 shrink-0" aria-hidden="true" />
                <audio
                  controls
                  src={attachedAudio.previewUrl}
                  className="h-8 max-w-[200px]"
                />
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {formatDuration(attachedAudio.durationSec)}
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedAudio(null)}
                  aria-label="Remove voice recording"
                  className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Media Permission / Capture Error Banner */}
        {mediaError && (
          <div
            role="alert"
            className="border-t border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-xs text-amber-950 dark:text-amber-200 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>{mediaError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-white dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-md cursor-pointer"
              >
                Upload Photo
              </button>
              <button
                type="button"
                onClick={() => setMediaError(null)}
                aria-label="Dismiss media notice"
                className="p-1 text-amber-700 dark:text-amber-400 hover:text-amber-950 dark:hover:text-amber-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Starter quick prompts when chat already started */}
        {messages.length > 0 && !isCameraOpen && !isRecording && (
          <div className="px-6 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
            {starterPrompts.slice(0, 2).map((p, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isThinking}
                onClick={() => onSendMessage(activeSubject, p, activeModule?.title)}
                className="text-xs text-slate-600 dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Hidden Photo Upload Fallback Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoFileChange}
          className="hidden"
          aria-hidden="true"
        />

        {/* Message Composer with Camera & Microphone */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 sm:gap-2.5 bg-white dark:bg-slate-900 rounded-b-xl"
        >
          <button
            type="button"
            onClick={() => (isCameraOpen ? closeCamera() : void openCamera())}
            disabled={isThinking || isRecording}
            data-testid="tutor-camera-btn"
            title="Open camera to scan a problem or textbook page"
            aria-label="Open camera"
            aria-pressed={isCameraOpen}
            className={`inline-flex items-center justify-center p-2.5 rounded-lg border transition-colors cursor-pointer shrink-0 disabled:opacity-50 ${
              isCameraOpen || attachedPhoto
                ? 'bg-sky-50 dark:bg-sky-950/60 border-[#0284C7] dark:border-sky-500 text-[#0284C7] dark:text-sky-400'
                : 'bg-[#F8FAFC] dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => (isRecording ? stopRecording(false) : void startRecording())}
            disabled={isThinking}
            data-testid="tutor-mic-btn"
            title={isRecording ? 'Stop voice recording' : 'Record a voice question'}
            aria-label={isRecording ? 'Stop microphone recording' : 'Record voice question'}
            aria-pressed={isRecording}
            className={`inline-flex items-center justify-center p-2.5 rounded-lg border transition-colors cursor-pointer shrink-0 disabled:opacity-50 ${
              isRecording
                ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                : attachedAudio
                  ? 'bg-sky-50 dark:bg-sky-950/60 border-[#0284C7] dark:border-sky-500 text-[#0284C7] dark:text-sky-400'
                  : 'bg-[#F8FAFC] dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            {isRecording ? (
              <Square className="w-4 h-4 fill-current" aria-hidden="true" />
            ) : (
              <Mic className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          <label htmlFor="tutor-question-input" className="sr-only">
            Ask Buddy your study question
          </label>
          <input
            id="tutor-question-input"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              attachedPhoto || attachedAudio
                ? 'Add an optional note, or click Ask Buddy to send...'
                : `Ask Buddy a ${activeSubject} question, snap a photo, or tap the mic...`
            }
            className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0284C7] dark:focus:border-sky-500"
          />

          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send question to Buddy"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            Ask Buddy
          </button>
        </form>
      </section>
    </main>
  );
};
