import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Hand,
  ListTodo,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneOff,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import type { StudentProfile } from '../types/study';
import {
  normalizeBuddyMessage,
  type StudyBuddyMessageKind,
  type StudyBuddyReactionKey,
  type StudyRoomChatMessage,
} from '../utils/studyBuddyChat';
import { StudyBuddyChatPanel } from './StudyBuddyChatPanel';

type StudyCallMode = 'video' | 'voice';

interface StudyRoomPeer {
  peerId: string;
  name: string;
  classLevel: string;
  syllabus: string;
  callMode: StudyCallMode;
  micOn: boolean;
  camOn: boolean;
  handRaised: boolean;
  joinedAt: string;
}

interface StudyRoomChecklistItem {
  id: string;
  text: string;
  done: boolean;
  authorName: string;
}

interface StudyRoomTimerState {
  label: string;
  durationSec: number;
  remainingSec: number;
  running: boolean;
  endsAtMs: number | null;
}

interface CombineStudyRoomProps {
  profile: StudentProfile;
  activeSubject: string;
  initialRoomCode?: string;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `PW${suffix}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatTimerClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/study-room`;
}

interface ParticipantTileProps {
  peer: StudyRoomPeer;
  isLocal: boolean;
  stream: MediaStream | null;
}

const ParticipantTile: React.FC<ParticipantTileProps> = ({ peer, isLocal, stream }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasLiveVideoTrack = Boolean(
    stream &&
      peer.camOn &&
      stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled)
  );

  useEffect(() => {
    if (videoRef.current && stream && hasLiveVideoTrack) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream, hasLiveVideoTrack]);

  useEffect(() => {
    if (!isLocal && audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => {});
    }
  }, [isLocal, stream]);

  return (
    <div
      data-testid={isLocal ? 'combine-local-tile' : `combine-remote-tile-${peer.peerId}`}
      className="relative rounded-xl border border-slate-800 bg-slate-900 overflow-hidden aspect-video flex flex-col items-center justify-center"
    >
      {/* Dedicated remote audio element so voice calls stay active even when video is off */}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline className="hidden" />}

      {hasLiveVideoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isLocal ? '-scale-x-100' : ''}`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center font-display text-xl font-semibold ${
              peer.micOn
                ? 'bg-[#0284C7] text-white ring-4 ring-sky-400/25'
                : 'bg-slate-800 text-slate-200 border border-slate-700'
            }`}
          >
            {getInitials(peer.name)}
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white">
              {peer.name} {isLocal ? '(You)' : ''}
            </p>
            <p className="text-xs text-slate-400">
              {peer.callMode === 'voice' ? 'Voice Call' : 'Camera Off'} · {peer.classLevel}{' '}
              {peer.syllabus}
            </p>
          </div>
        </div>
      )}

      {/* Top Left Call Mode / Hand Raised Badges */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-950/75 px-2 py-1 text-[11px] font-medium text-slate-200">
          {peer.callMode === 'voice' ? (
            <>
              <Phone className="w-3 h-3 text-emerald-400" aria-hidden="true" />
              Voice
            </>
          ) : (
            <>
              <Video className="w-3 h-3 text-sky-400" aria-hidden="true" />
              Video
            </>
          )}
        </span>
        {peer.handRaised && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-semibold text-slate-950">
            <Hand className="w-3 h-3" aria-hidden="true" />
            Doubt
          </span>
        )}
      </div>

      {/* Bottom Nameplate + Mic/Cam Status */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {peer.name} {isLocal ? '(You)' : ''}
          </p>
          <p className="text-[11px] text-slate-300 truncate">
            {peer.classLevel} · {peer.syllabus}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            aria-label={peer.micOn ? 'Microphone on' : 'Microphone muted'}
            className={`p-1.5 rounded-md ${
              peer.micOn ? 'bg-slate-800/85 text-emerald-400' : 'bg-red-600/90 text-white'
            }`}
          >
            {peer.micOn ? (
              <Mic className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </span>
          {peer.callMode === 'video' && (
            <span
              aria-label={peer.camOn ? 'Camera on' : 'Camera off'}
              className={`p-1.5 rounded-md ${
                peer.camOn ? 'bg-slate-800/85 text-sky-400' : 'bg-slate-800/85 text-slate-400'
              }`}
            >
              {peer.camOn ? (
                <Video className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <VideoOff className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const CombineStudyRoom: React.FC<CombineStudyRoomProps> = ({
  profile,
  activeSubject,
  initialRoomCode = '',
}) => {
  // Lobby state
  const [selectedCallMode, setSelectedCallMode] = useState<StudyCallMode>('video');
  const [selectedSubject, setSelectedSubject] = useState<string>(
    activeSubject || profile.subjects[0] || 'General Studies'
  );
  const [topicDraft, setTopicDraft] = useState<string>(
    `${activeSubject || profile.subjects[0] || 'Study'} Group Revision`
  );
  const [joinCodeInput, setJoinCodeInput] = useState<string>(
    initialRoomCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);

  // Active room state (server-authoritative)
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [selfPeerId, setSelfPeerId] = useState<string | null>(null);
  const [roomSubject, setRoomSubject] = useState<string>('');
  const [roomTopic, setRoomTopic] = useState<string>('');
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [topicEditValue, setTopicEditValue] = useState('');
  const [peers, setPeers] = useState<StudyRoomPeer[]>([]);
  const [messages, setMessages] = useState<StudyRoomChatMessage[]>([]);
  const [checklist, setChecklist] = useState<StudyRoomChecklistItem[]>([]);
  const [timer, setTimer] = useState<StudyRoomTimerState>({
    label: '25m Focus Sprint',
    durationSec: 25 * 60,
    remainingSec: 25 * 60,
    running: false,
    endsAtMs: null,
  });
  const [displayRemainingSec, setDisplayRemainingSec] = useState<number>(25 * 60);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState<number>(0);

  // Local media controls & remote streams
  const [callMode, setCallMode] = useState<StudyCallMode>('video');
  const [micOn, setMicOn] = useState<boolean>(false);
  const [camOn, setCamOn] = useState<boolean>(false);
  const [handRaised, setHandRaised] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Right panel controls
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'goals'>('chat');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [typingPeers, setTypingPeers] = useState<Record<string, string>>({});
  const [goalInput, setGoalInput] = useState('');

  // Refs for WebSocket, WebRTC peers, and cleanup
  const wsRef = useRef<WebSocket | null>(null);
  const sidebarTabRef = useRef<'chat' | 'goals'>('chat');
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const activeSessionRef = useRef<{
    roomCode: string;
    subject: string;
    topic: string;
    callMode: StudyCallMode;
    micOn: boolean;
    camOn: boolean;
  } | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const manualLeaveRef = useRef<boolean>(false);

  useEffect(() => {
    sidebarTabRef.current = sidebarTab;
    if (sidebarTab === 'chat') {
      setUnreadChatCount(0);
    }
  }, [sidebarTab]);

  useEffect(() => {
    if (initialRoomCode) {
      setJoinCodeInput(initialRoomCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10));
    }
  }, [initialRoomCode]);

  // Smooth local countdown driven by server-authoritative endsAtMs
  useEffect(() => {
    const computeDisplay = () => {
      if (!timer.running || timer.endsAtMs === null) {
        setDisplayRemainingSec(timer.remainingSec);
        return;
      }
      const estimatedServerNow = Date.now() + serverClockOffsetMs;
      const secs = Math.max(0, Math.ceil((timer.endsAtMs - estimatedServerNow) / 1000));
      setDisplayRemainingSec(secs);
    };

    computeDisplay();
    if (!timer.running) return;
    const id = window.setInterval(computeDisplay, 500);
    return () => window.clearInterval(id);
  }, [timer, serverClockOffsetMs]);

  const sendWs = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const closePeerConnection = useCallback((remotePeerId: string) => {
    const pc = peerConnectionsRef.current.get(remotePeerId);
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch {
        // Ignore teardown errors
      }
      peerConnectionsRef.current.delete(remotePeerId);
    }
    pendingIceRef.current.delete(remotePeerId);
    setRemoteStreams((prev) => {
      if (!(remotePeerId in prev)) return prev;
      const next = { ...prev };
      delete next[remotePeerId];
      return next;
    });
  }, []);

  const closeAllPeerConnections = useCallback(() => {
    for (const remotePeerId of Array.from(peerConnectionsRef.current.keys())) {
      closePeerConnection(remotePeerId);
    }
    peerConnectionsRef.current.clear();
    pendingIceRef.current.clear();
    setRemoteStreams({});
  }, [closePeerConnection]);

  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
  }, []);

  const getOrCreatePeerConnection = useCallback(
    (remotePeerId: string): RTCPeerConnection => {
      const existing = peerConnectionsRef.current.get(remotePeerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWs({
            type: 'webrtc:ice',
            toPeerId: remotePeerId,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          });
        }
      };

      pc.ontrack = (event) => {
        const incomingStream = event.streams[0] ?? new MediaStream([event.track]);
        setRemoteStreams((prev) => ({
          ...prev,
          [remotePeerId]: incomingStream,
        }));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeerConnection(remotePeerId);
        }
      };

      peerConnectionsRef.current.set(remotePeerId, pc);
      return pc;
    },
    [closePeerConnection, sendWs]
  );

  const createAndSendOffer = useCallback(
    async (remotePeerId: string) => {
      try {
        const pc = getOrCreatePeerConnection(remotePeerId);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        if (pc.localDescription) {
          sendWs({
            type: 'webrtc:offer',
            toPeerId: remotePeerId,
            sdp: {
              type: pc.localDescription.type,
              sdp: pc.localDescription.sdp,
            },
          });
        }
      } catch (err) {
        console.error('WebRTC offer failed:', err);
      }
    },
    [getOrCreatePeerConnection, sendWs]
  );

  const flushPendingIce = useCallback(async (remotePeerId: string, pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current.get(remotePeerId);
    if (!queued || queued.length === 0) return;
    pendingIceRef.current.delete(remotePeerId);
    for (const cand of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // Ignore stale ICE candidates
      }
    }
  }, []);

  const acquireInitialMedia = async (
    mode: StudyCallMode
  ): Promise<{ stream: MediaStream | null; micActive: boolean; camActive: boolean; notice: string | null }> => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return {
        stream: null,
        micActive: false,
        camActive: false,
        notice: 'Camera/microphone unavailable in this browser — joined in Listen & Chat mode.',
      };
    }

    if (mode === 'video') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 960 }, height: { ideal: 540 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        return { stream, micActive: true, camActive: true, notice: null };
      } catch {
        // Fallback to audio-only if camera is missing or denied
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          return {
            stream: audioOnly,
            micActive: true,
            camActive: false,
            notice: 'Camera unavailable — joined with microphone audio active.',
          };
        } catch {
          return {
            stream: null,
            micActive: false,
            camActive: false,
            notice:
              'Camera and microphone permission was not granted — joined in Listen & Chat mode. You can still hear friends, use the shared timer, and chat.',
          };
        }
      }
    }

    // Voice call mode
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      return { stream: audioStream, micActive: true, camActive: false, notice: null };
    } catch {
      return {
        stream: null,
        micActive: false,
        camActive: false,
        notice:
          'Microphone permission was not granted — joined in Listen & Chat mode. Allow microphone access to speak.',
      };
    }
  };

  const leaveRoom = useCallback(() => {
    manualLeaveRef.current = true;
    activeSessionRef.current = null;
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'room:leave' }));
        }
        wsRef.current.onclose = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      } catch {
        // Ignore socket close error
      }
      wsRef.current = null;
    }

    closeAllPeerConnections();
    stopLocalMedia();

    setRoomCode(null);
    setSelfPeerId(null);
    setPeers([]);
    setMessages([]);
    setTypingPeers({});
    setUnreadChatCount(0);
    setChecklist([]);
    setMicOn(false);
    setCamOn(false);
    setHandRaised(false);
    setIsConnecting(false);
    setMediaNotice(null);
  }, [closeAllPeerConnections, stopLocalMedia]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

  const connectSocketAndJoin = useCallback(
    (session: {
      roomCode: string;
      subject: string;
      topic: string;
      callMode: StudyCallMode;
      micOn: boolean;
      camOn: boolean;
    }) => {
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.close();
        } catch {
          // Ignore
        }
      }

      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'room:join',
            roomCode: session.roomCode,
            subject: session.subject,
            topic: session.topic,
            name: profile.name,
            classLevel: profile.classLevel,
            syllabus: profile.syllabus,
            callMode: session.callMode,
            micOn: session.micOn,
            camOn: session.camOn,
          })
        );
      };

      ws.onmessage = async (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(event.data)) as Record<string, unknown>;
        } catch {
          return;
        }

        const type = typeof msg.type === 'string' ? msg.type : '';

        if (type === 'room:error') {
          setRoomError(typeof msg.error === 'string' ? msg.error : 'Unable to join study room.');
          leaveRoom();
          return;
        }

        if (type === 'room:state') {
          const serverTimeMs =
            typeof msg.serverTimeMs === 'number' ? msg.serverTimeMs : Date.now();
          setServerClockOffsetMs(serverTimeMs - Date.now());

          const roomData = msg.room as {
            roomCode: string;
            subject: string;
            topic: string;
            peers: StudyRoomPeer[];
            existingPeerIds: string[];
            messages: StudyRoomChatMessage[];
            checklist: StudyRoomChecklistItem[];
            timer: StudyRoomTimerState;
          };

          setSelfPeerId(String(msg.selfPeerId ?? ''));
          setRoomCode(roomData.roomCode);
          setRoomSubject(roomData.subject);
          setRoomTopic(roomData.topic);
          setPeers(roomData.peers ?? []);
          setMessages((roomData.messages ?? []).map((m) => normalizeBuddyMessage(m)));
          setTypingPeers({});
          setUnreadChatCount(0);
          setChecklist(roomData.checklist ?? []);
          setTimer(roomData.timer);
          setIsConnecting(false);
          setRoomError(null);

          // Newcomer initiates WebRTC offers to all peers already in the room
          for (const existingId of roomData.existingPeerIds ?? []) {
            void createAndSendOffer(existingId);
          }
          return;
        }

        if (type === 'peer:joined') {
          const joinedPeer = msg.peer as StudyRoomPeer;
          setPeers((prev) => {
            if (prev.some((p) => p.peerId === joinedPeer.peerId)) return prev;
            return [...prev, joinedPeer];
          });
          return;
        }

        if (type === 'peer:updated') {
          const updatedPeer = msg.peer as StudyRoomPeer;
          setPeers((prev) =>
            prev.map((p) => (p.peerId === updatedPeer.peerId ? updatedPeer : p))
          );
          return;
        }

        if (type === 'peer:left') {
          const leftPeerId = String(msg.peerId ?? '');
          closePeerConnection(leftPeerId);
          setPeers((prev) => prev.filter((p) => p.peerId !== leftPeerId));
          setTypingPeers((prev) => {
            if (!(leftPeerId in prev)) return prev;
            const next = { ...prev };
            delete next[leftPeerId];
            return next;
          });
          return;
        }

        if (type === 'webrtc:offer') {
          const fromPeerId = String(msg.fromPeerId ?? '');
          const sdp = msg.sdp as RTCSessionDescriptionInit;
          if (!fromPeerId || !sdp) return;
          try {
            const pc = getOrCreatePeerConnection(fromPeerId);
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await flushPendingIce(fromPeerId, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (pc.localDescription) {
              sendWs({
                type: 'webrtc:answer',
                toPeerId: fromPeerId,
                sdp: {
                  type: pc.localDescription.type,
                  sdp: pc.localDescription.sdp,
                },
              });
            }
          } catch (err) {
            console.error('Failed to handle WebRTC offer:', err);
          }
          return;
        }

        if (type === 'webrtc:answer') {
          const fromPeerId = String(msg.fromPeerId ?? '');
          const sdp = msg.sdp as RTCSessionDescriptionInit;
          if (!fromPeerId || !sdp) return;
          const pc = peerConnectionsRef.current.get(fromPeerId);
          if (!pc) return;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await flushPendingIce(fromPeerId, pc);
          } catch (err) {
            console.error('Failed to handle WebRTC answer:', err);
          }
          return;
        }

        if (type === 'webrtc:ice') {
          const fromPeerId = String(msg.fromPeerId ?? '');
          const candidate = msg.candidate as RTCIceCandidateInit;
          if (!fromPeerId || !candidate) return;
          const pc = peerConnectionsRef.current.get(fromPeerId);
          if (!pc || !pc.remoteDescription) {
            const existingQueue = pendingIceRef.current.get(fromPeerId) ?? [];
            existingQueue.push(candidate);
            pendingIceRef.current.set(fromPeerId, existingQueue);
            return;
          }
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {
            // Ignore late ICE candidates
          }
          return;
        }

        if (type === 'chat:message') {
          const incoming = normalizeBuddyMessage(msg.message as Partial<StudyRoomChatMessage>);
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming].slice(-120);
          });
          if (sidebarTabRef.current !== 'chat' && incoming.kind !== 'system') {
            setUnreadChatCount((prev) => prev + 1);
          }
          return;
        }

        if (type === 'chat:updated') {
          const updated = normalizeBuddyMessage(msg.message as Partial<StudyRoomChatMessage>);
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          return;
        }

        if (type === 'chat:typing') {
          const peerId = String(msg.peerId ?? '');
          const senderName = String(msg.senderName ?? 'Buddy');
          const isTyping = Boolean(msg.isTyping);
          if (!peerId) return;
          setTypingPeers((prev) => {
            if (isTyping) {
              if (prev[peerId] === senderName) return prev;
              return { ...prev, [peerId]: senderName };
            }
            if (!(peerId in prev)) return prev;
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
          return;
        }

        if (type === 'topic:updated') {
          if (typeof msg.topic === 'string') {
            setRoomTopic(msg.topic);
          }
          return;
        }

        if (type === 'checklist:updated') {
          if (Array.isArray(msg.checklist)) {
            setChecklist(msg.checklist as StudyRoomChecklistItem[]);
          }
          return;
        }

        if (type === 'timer:updated') {
          if (typeof msg.serverTimeMs === 'number') {
            setServerClockOffsetMs(msg.serverTimeMs - Date.now());
          }
          if (msg.timer && typeof msg.timer === 'object') {
            setTimer(msg.timer as StudyRoomTimerState);
          }
        }
      };

      ws.onerror = () => {
        if (!activeSessionRef.current) {
          setIsConnecting(false);
          setRoomError('Could not connect to the Combine Study room server.');
        }
      };

      ws.onclose = () => {
        if (manualLeaveRef.current || !activeSessionRef.current) return;
        closeAllPeerConnections();
        reconnectTimerRef.current = window.setTimeout(() => {
          if (activeSessionRef.current && !manualLeaveRef.current) {
            connectSocketAndJoin(activeSessionRef.current);
          }
        }, 2000);
      };
    },
    [
      closeAllPeerConnections,
      closePeerConnection,
      createAndSendOffer,
      flushPendingIce,
      getOrCreatePeerConnection,
      leaveRoom,
      profile.classLevel,
      profile.name,
      profile.syllabus,
      sendWs,
    ]
  );

  const startOrJoinRoom = async (targetCode: string) => {
    const cleanCode = targetCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if (!/^[A-Z0-9]{4,10}$/.test(cleanCode)) {
      setRoomError('Please enter a valid 4–10 character room code (for example, PW4829).');
      return;
    }

    setRoomError(null);
    setMediaNotice(null);
    setIsConnecting(true);
    manualLeaveRef.current = false;

    const media = await acquireInitialMedia(selectedCallMode);
    localStreamRef.current = media.stream;
    setLocalStream(media.stream);
    setCallMode(selectedCallMode);
    setMicOn(media.micActive);
    setCamOn(media.camActive);
    setHandRaised(false);
    setMediaNotice(media.notice);

    const session = {
      roomCode: cleanCode,
      subject: selectedSubject,
      topic: topicDraft.trim() || `${selectedSubject} Group Revision`,
      callMode: selectedCallMode,
      micOn: media.micActive,
      camOn: media.camActive,
    };
    activeSessionRef.current = session;

    connectSocketAndJoin(session);
  };

  const handleCreateRoom = () => {
    const newCode = generateRoomCode();
    void startOrJoinRoom(newCode);
  };

  const handleJoinRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void startOrJoinRoom(joinCodeInput);
  };

  const renegotiateAllPeers = useCallback(async () => {
    for (const remotePeerId of Array.from(peerConnectionsRef.current.keys())) {
      await createAndSendOffer(remotePeerId);
    }
  }, [createAndSendOffer]);

  const handleToggleMic = async () => {
    setMediaNotice(null);
    let stream = localStreamRef.current;
    const existingAudioTrack = stream?.getAudioTracks()[0];

    if (existingAudioTrack && existingAudioTrack.readyState === 'live') {
      const nextMic = !micOn;
      existingAudioTrack.enabled = nextMic;
      setMicOn(nextMic);
      if (activeSessionRef.current) activeSessionRef.current.micOn = nextMic;
      sendWs({ type: 'media:state', micOn: nextMic });
      return;
    }

    // Request mic if we joined in listen-only mode
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      const newTrack = audioStream.getAudioTracks()[0];
      if (!newTrack) return;

      if (!stream) {
        stream = new MediaStream([newTrack]);
        localStreamRef.current = stream;
      } else {
        stream.addTrack(newTrack);
      }
      setLocalStream(new MediaStream(stream.getTracks()));

      for (const pc of peerConnectionsRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(newTrack);
        } else {
          pc.addTrack(newTrack, stream);
        }
      }
      await renegotiateAllPeers();

      setMicOn(true);
      if (activeSessionRef.current) activeSessionRef.current.micOn = true;
      sendWs({ type: 'media:state', micOn: true });
    } catch {
      setMediaNotice('Could not turn on microphone. Check browser microphone permissions.');
    }
  };

  const handleToggleCamera = async () => {
    setMediaNotice(null);
    let stream = localStreamRef.current;
    const existingVideoTrack = stream?.getVideoTracks()[0];

    if (camOn) {
      if (existingVideoTrack) {
        existingVideoTrack.enabled = false;
      }
      setCamOn(false);
      if (activeSessionRef.current) activeSessionRef.current.camOn = false;
      sendWs({ type: 'media:state', camOn: false });
      return;
    }

    // Turning camera ON (also upgrades voice call -> video call seamlessly)
    if (existingVideoTrack && existingVideoTrack.readyState === 'live') {
      existingVideoTrack.enabled = true;
      setCallMode('video');
      setCamOn(true);
      if (activeSessionRef.current) {
        activeSessionRef.current.callMode = 'video';
        activeSessionRef.current.camOn = true;
      }
      sendWs({ type: 'media:state', callMode: 'video', camOn: true });
      return;
    }

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 540 } },
        audio: false,
      });
      const newTrack = videoStream.getVideoTracks()[0];
      if (!newTrack) return;

      if (!stream) {
        stream = new MediaStream([newTrack]);
        localStreamRef.current = stream;
      } else {
        stream.addTrack(newTrack);
      }
      setLocalStream(new MediaStream(stream.getTracks()));

      for (const pc of peerConnectionsRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newTrack);
        } else {
          pc.addTrack(newTrack, stream);
        }
      }
      await renegotiateAllPeers();

      setCallMode('video');
      setCamOn(true);
      if (activeSessionRef.current) {
        activeSessionRef.current.callMode = 'video';
        activeSessionRef.current.camOn = true;
      }
      sendWs({ type: 'media:state', callMode: 'video', camOn: true });
    } catch {
      setMediaNotice('Could not open camera. Check browser camera permissions.');
    }
  };

  const handleSwitchCallMode = async (nextMode: StudyCallMode) => {
    if (nextMode === 'voice') {
      if (localStreamRef.current) {
        for (const vTrack of localStreamRef.current.getVideoTracks()) {
          vTrack.enabled = false;
        }
      }
      setCallMode('voice');
      setCamOn(false);
      if (activeSessionRef.current) {
        activeSessionRef.current.callMode = 'voice';
        activeSessionRef.current.camOn = false;
      }
      sendWs({ type: 'media:state', callMode: 'voice', camOn: false });
    } else {
      await handleToggleCamera();
    }
  };

  const handleToggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    sendWs({ type: 'media:state', handRaised: next });
  };

  const handleCopyInvite = async () => {
    if (!roomCode) return;
    const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(roomCode)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 2200);
    } catch {
      setMediaNotice(`Share this code with your friends: ${roomCode}`);
    }
  };

  const handleSendBuddyMessage = useCallback(
    (payload: {
      kind: Exclude<StudyBuddyMessageKind, 'system'>;
      text: string;
      subjectTag?: string;
      progressPercent?: number;
      replyToId?: string;
    }) => {
      const trimmed = payload.text.trim();
      if (!trimmed) return;
      sendWs({
        type: 'chat:send',
        id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        kind: payload.kind,
        text: trimmed,
        subjectTag: payload.subjectTag,
        progressPercent: payload.progressPercent,
        replyToId: payload.replyToId,
      });
    },
    [sendWs]
  );

  const handleToggleResolveQuestion = useCallback(
    (messageId: string) => {
      sendWs({ type: 'chat:resolve', messageId });
    },
    [sendWs]
  );

  const handleToggleReaction = useCallback(
    (messageId: string, reaction: StudyBuddyReactionKey) => {
      sendWs({ type: 'chat:react', messageId, reaction });
    },
    [sendWs]
  );

  const handleTypingChange = useCallback(
    (isTyping: boolean) => {
      sendWs({ type: 'chat:typing', isTyping });
    },
    [sendWs]
  );

  const handleAddChecklistGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = goalInput.trim();
    if (!trimmed) return;
    sendWs({
      type: 'checklist:add',
      id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text: trimmed,
    });
    setGoalInput('');
  };

  const handleSaveTopic = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = topicEditValue.trim();
    if (!trimmed) return;
    sendWs({ type: 'topic:update', topic: trimmed });
    setIsEditingTopic(false);
  };

  // Lobby View
  if (!roomCode) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Live Group Revision <span aria-hidden="true">·</span>{' '}
            <span className="text-[#0284C7] dark:text-sky-400">{profile.syllabus}</span>{' '}
            <span aria-hidden="true">·</span> {profile.classLevel}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#0F172A] dark:text-slate-100">
            Combine Study with Friends
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            Study together in real time over a <strong className="text-[#0F172A] dark:text-slate-200">Video Call</strong> or{' '}
            <strong className="text-[#0F172A] dark:text-slate-200">Voice Call</strong>. Share your room code with up to 5 friends to sync a group
            focus timer, track shared chapter goals, and solve doubts together.
          </p>
        </div>

        {/* Call Mode Selector */}
        <section
          aria-label="Choose call mode"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">
              1. Choose How You Want to Connect
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              You can switch between Video and Voice anytime during the call
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="combine-mode-video"
              onClick={() => setSelectedCallMode('video')}
              aria-pressed={selectedCallMode === 'video'}
              className={`flex items-start gap-3.5 p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                selectedCallMode === 'video'
                  ? 'border-[#0284C7] dark:border-sky-500 bg-sky-50/70 dark:bg-sky-950/40'
                  : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`p-2.5 rounded-lg shrink-0 ${
                  selectedCallMode === 'video'
                    ? 'bg-[#0284C7] text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Video className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">Video Call Study Room</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Face-to-face study desk with live camera & microphone. Show notebook steps directly
                  to friends.
                </p>
              </div>
            </button>

            <button
              type="button"
              data-testid="combine-mode-voice"
              onClick={() => setSelectedCallMode('voice')}
              aria-pressed={selectedCallMode === 'voice'}
              className={`flex items-start gap-3.5 p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                selectedCallMode === 'voice'
                  ? 'border-[#0284C7] dark:border-sky-500 bg-sky-50/70 dark:bg-sky-950/40'
                  : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`p-2.5 rounded-lg shrink-0 ${
                  selectedCallMode === 'voice'
                    ? 'bg-[#0284C7] text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Phone className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">Voice Call Study Room</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Audio-only discussion with camera off — low data usage and distraction-free
                  combined study.
                </p>
              </div>
            </button>
          </div>
        </section>

        {roomError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300 flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
            <span>{roomError}</span>
          </div>
        )}

        {/* Create vs Join 2-Column Action Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Room */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0284C7] dark:text-sky-400">
                  Host a Session
                </p>
                <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                  Create a Combine Study Room
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Start an instant room and send the invite link or 6-character code to your
                  classmates.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="combine-subject-select"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Subject
                  </label>
                  <select
                    id="combine-subject-select"
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      setTopicDraft(`${e.target.value} Group Revision`);
                    }}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-slate-100"
                  >
                    {profile.subjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="combine-topic-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Chapter or Revision Topic
                  </label>
                  <input
                    id="combine-topic-input"
                    type="text"
                    maxLength={120}
                    value={topicDraft}
                    onChange={(e) => setTopicDraft(e.target.value)}
                    placeholder="e.g., Quadratic Equations — Exercise 4.3"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0284C7] dark:focus:border-sky-400"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="combine-create-btn"
              onClick={handleCreateRoom}
              disabled={isConnecting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Starting Study Room...
                </>
              ) : selectedCallMode === 'video' ? (
                <>
                  <Video className="w-4 h-4" aria-hidden="true" />
                  Start Video Study Room
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" aria-hidden="true" />
                  Start Voice Study Room
                </>
              )}
            </button>
          </section>

          {/* Join Existing Room */}
          <form
            onSubmit={handleJoinRoomSubmit}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Join Friends
                </p>
                <h2 className="font-display text-xl font-semibold text-[#0F172A] dark:text-slate-100">
                  Enter a Friend’s Room Code
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Already have a code from a friend? Paste it below to join their live video or voice
                  study session.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="combine-room-code-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Room Code (e.g., PW4829)
                </label>
                <input
                  id="combine-room-code-input"
                  data-testid="combine-join-input"
                  type="text"
                  maxLength={10}
                  value={joinCodeInput}
                  onChange={(e) =>
                    setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                  }
                  placeholder="Enter 6-character code"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-base font-mono font-semibold tracking-widest text-[#0F172A] dark:text-slate-100 uppercase placeholder:tracking-normal placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0284C7] dark:focus:border-sky-400"
                />
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 p-3.5 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                <p className="font-semibold text-[#0F172A] dark:text-slate-100">Included in every Combine Study Room:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Live peer-to-peer Video & Voice Call (up to 6 friends)</li>
                  <li>Synchronized group Pomodoro study timer (25m / 45m / 5m)</li>
                  <li>Real-time Study Buddy chat to post questions and share progress updates</li>
                </ul>
              </div>
            </div>

            <button
              type="submit"
              data-testid="combine-join-btn"
              disabled={isConnecting || joinCodeInput.trim().length < 4}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#0F172A] hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white disabled:opacity-55 rounded-lg transition-colors cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Joining Room...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" aria-hidden="true" />
                  Join {selectedCallMode === 'video' ? 'Video' : 'Voice'} Study Room
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Active Combine Study Room View
  const gridColsClass =
    peers.length <= 1
      ? 'grid-cols-1 max-w-2xl mx-auto'
      : peers.length <= 4
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3';

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Top Room Header Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              data-testid="combine-active-room-code"
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/80 px-2.5 py-1 font-mono font-semibold text-[#0284C7] dark:text-sky-400"
            >
              Room {roomCode}
            </span>
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
              <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              {peers.length} / 6 studying
            </span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="font-medium text-slate-600 dark:text-slate-400">{roomSubject}</span>
          </div>

          {isEditingTopic ? (
            <form onSubmit={handleSaveTopic} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                maxLength={120}
                value={topicEditValue}
                onChange={(e) => setTopicEditValue(e.target.value)}
                className="flex-1 max-w-md rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-sm text-[#0F172A] dark:text-slate-100"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-1 text-xs font-semibold text-white bg-[#0284C7] rounded-md cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingTopic(false)}
                className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl sm:text-2xl font-semibold text-[#0F172A] dark:text-slate-100 truncate">
                {roomTopic}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setTopicEditValue(roomTopic);
                  setIsEditingTopic(true);
                }}
                className="text-xs font-medium text-[#0284C7] dark:text-sky-400 hover:underline shrink-0 cursor-pointer"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyInvite}
            data-testid="combine-copy-invite-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] dark:text-slate-100 bg-[#F8FAFC] dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            {copiedInvite ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                Invite Link Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                Copy Invite Link
              </>
            )}
          </button>

          <button
            type="button"
            onClick={leaveRoom}
            data-testid="combine-leave-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
          >
            <PhoneOff className="w-3.5 h-3.5" aria-hidden="true" />
            Leave Call
          </button>
        </div>
      </div>

      {mediaNotice && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-xs text-amber-950 dark:text-amber-200 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span>{mediaNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setMediaNotice(null)}
            className="text-xs font-semibold text-amber-900 dark:text-amber-300 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split Grid: Call Stage + Timer on Left, Chat & Shared Goals on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-4">
          {/* Video / Voice Call Grid */}
          <section
            aria-label="Live combine study call participants"
            className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-4"
          >
            <div className={`grid ${gridColsClass} gap-3`}>
              {peers.map((peer) => {
                const isLocal = peer.peerId === selfPeerId;
                return (
                  <ParticipantTile
                    key={peer.peerId}
                    peer={peer}
                    isLocal={isLocal}
                    stream={isLocal ? localStream : remoteStreams[peer.peerId] ?? null}
                  />
                );
              })}
            </div>

            {peers.length === 1 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300">
                <span>
                  Waiting for friends to join — share Room Code{' '}
                  <strong className="font-mono text-white">{roomCode}</strong> or click Copy Invite
                  Link.
                </span>
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="text-sky-400 hover:text-sky-300 font-semibold self-start sm:self-auto cursor-pointer whitespace-nowrap"
                >
                  {copiedInvite ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            )}

            {/* Live Call Control Bar */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleToggleMic}
                data-testid="combine-toggle-mic-btn"
                aria-pressed={micOn}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  micOn
                    ? 'bg-slate-800 hover:bg-slate-700 text-white'
                    : 'bg-red-600/90 hover:bg-red-600 text-white'
                }`}
              >
                {micOn ? (
                  <>
                    <Mic className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    Mic On
                  </>
                ) : (
                  <>
                    <MicOff className="w-4 h-4" aria-hidden="true" />
                    Mic Muted
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleCamera}
                data-testid="combine-toggle-cam-btn"
                aria-pressed={camOn}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  camOn
                    ? 'bg-slate-800 hover:bg-slate-700 text-white'
                    : 'bg-slate-800/70 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {camOn ? (
                  <>
                    <Video className="w-4 h-4 text-sky-400" aria-hidden="true" />
                    Camera On
                  </>
                ) : (
                  <>
                    <VideoOff className="w-4 h-4" aria-hidden="true" />
                    Camera Off
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSwitchCallMode(callMode === 'video' ? 'voice' : 'video')}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              >
                {callMode === 'video' ? (
                  <>
                    <Phone className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    Switch to Voice Only
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 text-sky-400" aria-hidden="true" />
                    Enable Video Call
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleHand}
                aria-pressed={handRaised}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  handRaised
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <Hand className="w-4 h-4" aria-hidden="true" />
                {handRaised ? 'Lower Hand' : 'Raise Hand'}
              </button>
            </div>
          </section>

          {/* Synced Group Study Timer */}
          <section
            aria-label="Synchronized group study timer"
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/80 text-[#0284C7] dark:text-sky-400">
                <Timer className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Synced Group Timer · {timer.label}
                </p>
                <p
                  data-testid="combine-timer-clock"
                  className="font-mono text-3xl font-bold text-[#0F172A] dark:text-slate-100 tabular-nums"
                >
                  {formatTimerClock(displayRemainingSec)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  sendWs({ type: 'timer:control', action: timer.running ? 'pause' : 'start' })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors cursor-pointer"
              >
                {timer.running ? (
                  <>
                    <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    Start Together
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => sendWs({ type: 'timer:control', action: 'reset' })}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-[#F8FAFC] dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Reset
              </button>

              <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2">
                {[
                  { id: 'focus25', label: '25m' },
                  { id: 'deep45', label: '45m' },
                  { id: 'break5', label: '5m' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      sendWs({ type: 'timer:control', action: 'preset', preset: preset.id })
                    }
                    className="px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Study Buddy Chat & Shared Study Goals */}
        <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-[600px]">
          <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 p-1.5 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-t-xl gap-1">
            <button
              type="button"
              data-testid="combine-tab-buddy-chat"
              onClick={() => setSidebarTab('chat')}
              className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                sidebarTab === 'chat'
                  ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                Study Buddy ({messages.filter((m) => m.kind !== 'system').length})
              </span>
              {unreadChatCount > 0 && sidebarTab !== 'chat' && (
                <span
                  data-testid="buddy-unread-count"
                  className="font-mono text-[11px] font-bold text-[#0284C7] dark:text-sky-400 tabular-nums"
                >
                  +{unreadChatCount}
                </span>
              )}
            </button>
            <button
              type="button"
              data-testid="combine-tab-study-goals"
              onClick={() => setSidebarTab('goals')}
              className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                sidebarTab === 'goals'
                  ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                Study Goals ({checklist.filter((c) => c.done).length}/{checklist.length})
              </span>
            </button>
          </div>

          {sidebarTab === 'chat' ? (
            <StudyBuddyChatPanel
              profile={profile}
              roomCode={roomCode}
              roomSubject={roomSubject}
              selfPeerId={selfPeerId}
              messages={messages}
              typingNames={Object.values(typingPeers)}
              onSendMessage={handleSendBuddyMessage}
              onToggleResolveQuestion={handleToggleResolveQuestion}
              onToggleReaction={handleToggleReaction}
              onTypingChange={handleTypingChange}
            />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {checklist.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-10">
                    Add chapters or practice problems below — everyone in the room can check them
                    off together.
                  </p>
                ) : (
                  checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 px-3 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => sendWs({ type: 'checklist:toggle', id: item.id })}
                        className="flex items-start gap-2 text-left flex-1 min-w-0 cursor-pointer"
                      >
                        {item.done ? (
                          <CheckCircle2
                            className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                        ) : (
                          <Circle
                            className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                        )}
                        <span
                          className={`text-xs leading-snug ${
                            item.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-[#0F172A] dark:text-slate-100'
                          }`}
                        >
                          {item.text}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => sendWs({ type: 'checklist:remove', id: item.id })}
                        aria-label="Remove study goal"
                        className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={handleAddChecklistGoal}
                className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  maxLength={140}
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="Add shared study goal..."
                  className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0284C7] dark:focus:border-sky-400"
                />
                <button
                  type="submit"
                  disabled={!goalInput.trim()}
                  aria-label="Add study goal"
                  className="p-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 disabled:opacity-50 text-white cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
            </>
          )}
        </aside>
      </div>
    </main>
  );
};
