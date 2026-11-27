import crypto from 'crypto';
import type http from 'http';
import type express from 'express';
import { WebSocket, WebSocketServer } from 'ws';

export type StudyCallMode = 'video' | 'voice';

export interface StudyRoomPeerPublic {
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

export type StudyBuddyMessageKind = 'chat' | 'question' | 'progress' | 'system';
export type StudyBuddyReactionKey = 'helpful' | 'cheers';

export interface StudyRoomChatMessage {
  id: string;
  peerId: string;
  senderName: string;
  senderClass?: string;
  kind: StudyBuddyMessageKind;
  text: string;
  subjectTag?: string;
  progressPercent?: number;
  resolved?: boolean;
  resolvedBy?: string;
  reactions?: Partial<Record<StudyBuddyReactionKey, string[]>>;
  replyToId?: string;
  replyToSender?: string;
  replyToPreview?: string;
  timestamp: string;
}

export interface StudyRoomChecklistItem {
  id: string;
  text: string;
  done: boolean;
  authorName: string;
}

export interface StudyRoomTimerState {
  label: string;
  durationSec: number;
  remainingSec: number;
  running: boolean;
  endsAtMs: number | null;
}

interface InternalPeer extends StudyRoomPeerPublic {
  ws: WebSocket;
}

interface StudyRoom {
  roomCode: string;
  subject: string;
  topic: string;
  createdAt: number;
  peers: Map<string, InternalPeer>;
  messages: StudyRoomChatMessage[];
  checklist: StudyRoomChecklistItem[];
  timer: StudyRoomTimerState;
}

const MAX_ROOMS = 500;
const MAX_PEERS_PER_ROOM = 6;
const MAX_MESSAGES_PER_ROOM = 120;
const MAX_CHECKLIST_ITEMS = 20;
const ALLOWED_CHAT_KINDS: ReadonlySet<string> = new Set(['chat', 'question', 'progress']);
const ALLOWED_REACTIONS: ReadonlySet<StudyBuddyReactionKey> = new Set(['helpful', 'cheers']);

const ALLOWED_TIMER_PRESETS: Record<string, { label: string; durationSec: number }> = {
  focus25: { label: '25m Focus Sprint', durationSec: 25 * 60 },
  deep45: { label: '45m Deep Study', durationSec: 45 * 60 },
  break5: { label: '5m Quick Break', durationSec: 5 * 60 },
};

function cleanStr(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function normalizeRoomCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{4,10}$/.test(code);
}

function toPublicPeer(peer: InternalPeer): StudyRoomPeerPublic {
  return {
    peerId: peer.peerId,
    name: peer.name,
    classLevel: peer.classLevel,
    syllabus: peer.syllabus,
    callMode: peer.callMode,
    micOn: peer.micOn,
    camOn: peer.camOn,
    handRaised: peer.handRaised,
    joinedAt: peer.joinedAt,
  };
}

function computeAuthoritativeTimer(timer: StudyRoomTimerState): StudyRoomTimerState {
  if (!timer.running || timer.endsAtMs === null) {
    return timer;
  }
  const remainingSec = Math.max(0, Math.ceil((timer.endsAtMs - Date.now()) / 1000));
  if (remainingSec <= 0) {
    timer.running = false;
    timer.remainingSec = 0;
    timer.endsAtMs = null;
  } else {
    timer.remainingSec = remainingSec;
  }
  return timer;
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(room: StudyRoom, payload: unknown, excludePeerId?: string): void {
  const encoded = JSON.stringify(payload);
  for (const peer of room.peers.values()) {
    if (excludePeerId && peer.peerId === excludePeerId) continue;
    if (peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(encoded);
    }
  }
}

export function attachStudyRoomWebSocket(
  httpServer: http.Server,
  app: express.Express
): WebSocketServer {
  const rooms = new Map<string, StudyRoom>();

  // Lightweight room preview endpoint so friends can check if a room code is active
  app.get('/api/study-rooms/:code', (req, res) => {
    const code = normalizeRoomCode(req.params.code);
    if (!isValidRoomCode(code)) {
      res.status(400).json({ error: 'Invalid room code format.' });
      return;
    }
    const room = rooms.get(code);
    if (!room) {
      res.json({
        exists: false,
        roomCode: code,
        participantCount: 0,
        maxParticipants: MAX_PEERS_PER_ROOM,
      });
      return;
    }
    res.json({
      exists: true,
      roomCode: room.roomCode,
      subject: room.subject,
      topic: room.topic,
      participantCount: room.peers.size,
      maxParticipants: MAX_PEERS_PER_ROOM,
    });
  });

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/study-room',
    maxPayload: 64 * 1024,
  });

  wss.on('connection', (ws: WebSocket) => {
    let activeRoomCode: string | null = null;
    let activePeerId: string | null = null;

    const removeFromCurrentRoom = () => {
      if (!activeRoomCode || !activePeerId) return;
      const room = rooms.get(activeRoomCode);
      const leavingPeerId = activePeerId;
      activeRoomCode = null;
      activePeerId = null;

      if (!room) return;
      const leavingPeer = room.peers.get(leavingPeerId);
      room.peers.delete(leavingPeerId);
      broadcastToRoom(room, {
        type: 'peer:left',
        peerId: leavingPeerId,
      });

      if (leavingPeer && room.peers.size > 0) {
        broadcastToRoom(room, {
          type: 'chat:typing',
          peerId: leavingPeerId,
          senderName: leavingPeer.name,
          isTyping: false,
        });
        const leaveNotice: StudyRoomChatMessage = {
          id: `sys_leave_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          peerId: 'system',
          senderName: 'Study Room',
          kind: 'system',
          text: `${leavingPeer.name} left the study room`,
          timestamp: new Date().toISOString(),
        };
        room.messages = [...room.messages, leaveNotice].slice(-MAX_MESSAGES_PER_ROOM);
        broadcastToRoom(room, {
          type: 'chat:message',
          message: leaveNotice,
        });
      }

      if (room.peers.size === 0) {
        rooms.delete(room.roomCode);
      }
    };

    ws.on('message', (rawData) => {
      let msg: Record<string, unknown>;
      try {
        const parsed = JSON.parse(rawData.toString('utf8')) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
        msg = parsed as Record<string, unknown>;
      } catch {
        return;
      }

      const type = typeof msg.type === 'string' ? msg.type : '';

      if (type === 'ping') {
        sendJson(ws, { type: 'pong', serverTimeMs: Date.now() });
        return;
      }

      if (type === 'room:join') {
        removeFromCurrentRoom();

        const code = normalizeRoomCode(msg.roomCode);
        if (!isValidRoomCode(code)) {
          sendJson(ws, {
            type: 'room:error',
            error: 'Room code must be 4 to 10 letters or numbers.',
          });
          return;
        }

        let room = rooms.get(code);
        if (!room) {
          if (rooms.size >= MAX_ROOMS) {
            sendJson(ws, {
              type: 'room:error',
              error: 'Study room capacity is temporarily full. Please try again shortly.',
            });
            return;
          }
          const subject = cleanStr(msg.subject, 80) || 'General Studies';
          const topic = cleanStr(msg.topic, 120) || `${subject} Group Revision`;
          room = {
            roomCode: code,
            subject,
            topic,
            createdAt: Date.now(),
            peers: new Map(),
            messages: [],
            checklist: [],
            timer: {
              label: ALLOWED_TIMER_PRESETS.focus25.label,
              durationSec: ALLOWED_TIMER_PRESETS.focus25.durationSec,
              remainingSec: ALLOWED_TIMER_PRESETS.focus25.durationSec,
              running: false,
              endsAtMs: null,
            },
          };
          rooms.set(code, room);
        }

        if (room.peers.size >= MAX_PEERS_PER_ROOM) {
          sendJson(ws, {
            type: 'room:error',
            error: `This combine study room is full (${MAX_PEERS_PER_ROOM} friends max).`,
          });
          return;
        }

        const peerId = `peer_${crypto.randomBytes(6).toString('hex')}`;
        const callMode: StudyCallMode = msg.callMode === 'voice' ? 'voice' : 'video';
        const peer: InternalPeer = {
          peerId,
          name: cleanStr(msg.name, 60) || 'Student',
          classLevel: cleanStr(msg.classLevel, 40) || 'Class 10',
          syllabus: cleanStr(msg.syllabus, 40) || 'CBSE',
          callMode,
          micOn: Boolean(msg.micOn),
          camOn: callMode === 'video' && Boolean(msg.camOn),
          handRaised: false,
          joinedAt: new Date().toISOString(),
          ws,
        };

        const existingPeers = Array.from(room.peers.values()).map(toPublicPeer);
        room.peers.set(peerId, peer);
        activeRoomCode = code;
        activePeerId = peerId;

        sendJson(ws, {
          type: 'room:state',
          selfPeerId: peerId,
          serverTimeMs: Date.now(),
          room: {
            roomCode: room.roomCode,
            subject: room.subject,
            topic: room.topic,
            peers: [...existingPeers, toPublicPeer(peer)],
            existingPeerIds: existingPeers.map((p) => p.peerId),
            messages: room.messages,
            checklist: room.checklist,
            timer: computeAuthoritativeTimer(room.timer),
          },
        });

        broadcastToRoom(
          room,
          {
            type: 'peer:joined',
            peer: toPublicPeer(peer),
          },
          peerId
        );

        if (existingPeers.length > 0) {
          const joinNotice: StudyRoomChatMessage = {
            id: `sys_join_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            peerId: 'system',
            senderName: 'Study Room',
            kind: 'system',
            text: `${peer.name} joined the study room (${peer.classLevel} · ${peer.syllabus})`,
            timestamp: new Date().toISOString(),
          };
          room.messages = [...room.messages, joinNotice].slice(-MAX_MESSAGES_PER_ROOM);
          broadcastToRoom(room, {
            type: 'chat:message',
            message: joinNotice,
          });
        }
        return;
      }

      if (type === 'room:leave') {
        removeFromCurrentRoom();
        return;
      }

      if (!activeRoomCode || !activePeerId) return;
      const room = rooms.get(activeRoomCode);
      if (!room) return;
      const sender = room.peers.get(activePeerId);
      if (!sender) return;

      if (type === 'media:state') {
        if (msg.callMode === 'video' || msg.callMode === 'voice') {
          sender.callMode = msg.callMode;
        }
        if (typeof msg.micOn === 'boolean') sender.micOn = msg.micOn;
        if (typeof msg.camOn === 'boolean') {
          sender.camOn = sender.callMode === 'video' ? msg.camOn : false;
        }
        if (typeof msg.handRaised === 'boolean') sender.handRaised = msg.handRaised;

        broadcastToRoom(room, {
          type: 'peer:updated',
          peer: toPublicPeer(sender),
        });
        return;
      }

      if (type === 'webrtc:offer' || type === 'webrtc:answer') {
        const toPeerId = cleanStr(msg.toPeerId, 40);
        const target = room.peers.get(toPeerId);
        if (!target || target.peerId === sender.peerId) return;

        const sdpObj = msg.sdp as { type?: unknown; sdp?: unknown } | undefined;
        if (
          !sdpObj ||
          typeof sdpObj !== 'object' ||
          (sdpObj.type !== 'offer' && sdpObj.type !== 'answer') ||
          typeof sdpObj.sdp !== 'string' ||
          sdpObj.sdp.length === 0 ||
          sdpObj.sdp.length > 32_000
        ) {
          return;
        }

        sendJson(target.ws, {
          type,
          fromPeerId: sender.peerId,
          sdp: { type: sdpObj.type, sdp: sdpObj.sdp },
        });
        return;
      }

      if (type === 'webrtc:ice') {
        const toPeerId = cleanStr(msg.toPeerId, 40);
        const target = room.peers.get(toPeerId);
        if (!target || target.peerId === sender.peerId) return;

        const cand = msg.candidate as
          | { candidate?: unknown; sdpMid?: unknown; sdpMLineIndex?: unknown }
          | undefined;
        if (
          !cand ||
          typeof cand !== 'object' ||
          typeof cand.candidate !== 'string' ||
          cand.candidate.length > 2048
        ) {
          return;
        }

        sendJson(target.ws, {
          type: 'webrtc:ice',
          fromPeerId: sender.peerId,
          candidate: {
            candidate: cand.candidate,
            sdpMid: typeof cand.sdpMid === 'string' ? cand.sdpMid.slice(0, 64) : null,
            sdpMLineIndex:
              typeof cand.sdpMLineIndex === 'number' && Number.isFinite(cand.sdpMLineIndex)
                ? cand.sdpMLineIndex
                : null,
          },
        });
        return;
      }

      if (type === 'chat:send') {
        const text = cleanStr(msg.text, 500);
        if (!text) return;
        const rawId = cleanStr(msg.id, 60);
        const id = rawId || `chat_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        // Idempotency guard
        if (room.messages.some((m) => m.id === id)) return;

        const rawKind = typeof msg.kind === 'string' ? msg.kind : 'chat';
        const kind: StudyBuddyMessageKind = ALLOWED_CHAT_KINDS.has(rawKind)
          ? (rawKind as StudyBuddyMessageKind)
          : 'chat';

        const subjectTag = cleanStr(msg.subjectTag, 80) || room.subject;
        const progressPercent =
          kind === 'progress' &&
          typeof msg.progressPercent === 'number' &&
          Number.isFinite(msg.progressPercent)
            ? Math.max(0, Math.min(100, Math.round(msg.progressPercent)))
            : undefined;

        const replyToId = cleanStr(msg.replyToId, 60);
        const replyTarget = replyToId
          ? room.messages.find((m) => m.id === replyToId && m.kind !== 'system')
          : undefined;

        const chatMessage: StudyRoomChatMessage = {
          id,
          peerId: sender.peerId,
          senderName: sender.name,
          senderClass: sender.classLevel,
          kind,
          text,
          subjectTag: kind === 'question' || kind === 'progress' ? subjectTag : undefined,
          progressPercent,
          resolved: kind === 'question' ? false : undefined,
          reactions: {},
          replyToId: replyTarget?.id,
          replyToSender: replyTarget?.senderName,
          replyToPreview: replyTarget ? replyTarget.text.slice(0, 90) : undefined,
          timestamp: new Date().toISOString(),
        };
        room.messages = [...room.messages, chatMessage].slice(-MAX_MESSAGES_PER_ROOM);
        broadcastToRoom(room, {
          type: 'chat:message',
          message: chatMessage,
        });
        broadcastToRoom(
          room,
          {
            type: 'chat:typing',
            peerId: sender.peerId,
            senderName: sender.name,
            isTyping: false,
          },
          sender.peerId
        );
        return;
      }

      if (type === 'chat:resolve') {
        const messageId = cleanStr(msg.messageId, 60);
        const target = room.messages.find((m) => m.id === messageId && m.kind === 'question');
        if (!target) return;
        const nextResolved = !Boolean(target.resolved);
        target.resolved = nextResolved;
        target.resolvedBy = nextResolved ? sender.name : undefined;
        broadcastToRoom(room, {
          type: 'chat:updated',
          message: target,
        });
        return;
      }

      if (type === 'chat:react') {
        const messageId = cleanStr(msg.messageId, 60);
        const reaction = cleanStr(msg.reaction, 20) as StudyBuddyReactionKey;
        if (!ALLOWED_REACTIONS.has(reaction)) return;
        const target = room.messages.find((m) => m.id === messageId && m.kind !== 'system');
        if (!target) return;

        const reactions = target.reactions ? { ...target.reactions } : {};
        const currentList = Array.isArray(reactions[reaction]) ? [...reactions[reaction]!] : [];
        const existingIdx = currentList.indexOf(sender.peerId);
        if (existingIdx >= 0) {
          currentList.splice(existingIdx, 1);
        } else {
          currentList.push(sender.peerId);
        }
        reactions[reaction] = currentList;
        target.reactions = reactions;

        broadcastToRoom(room, {
          type: 'chat:updated',
          message: target,
        });
        return;
      }

      if (type === 'chat:typing') {
        broadcastToRoom(
          room,
          {
            type: 'chat:typing',
            peerId: sender.peerId,
            senderName: sender.name,
            isTyping: Boolean(msg.isTyping),
          },
          sender.peerId
        );
        return;
      }

      if (type === 'topic:update') {
        const nextTopic = cleanStr(msg.topic, 120);
        if (!nextTopic) return;
        room.topic = nextTopic;
        broadcastToRoom(room, {
          type: 'topic:updated',
          topic: room.topic,
        });
        return;
      }

      if (type === 'checklist:add') {
        const text = cleanStr(msg.text, 140);
        if (!text || room.checklist.length >= MAX_CHECKLIST_ITEMS) return;
        const rawId = cleanStr(msg.id, 60);
        const id = rawId || `goal_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        if (room.checklist.some((item) => item.id === id)) return;

        room.checklist.push({
          id,
          text,
          done: false,
          authorName: sender.name,
        });
        broadcastToRoom(room, {
          type: 'checklist:updated',
          checklist: room.checklist,
        });
        return;
      }

      if (type === 'checklist:toggle') {
        const id = cleanStr(msg.id, 60);
        const item = room.checklist.find((entry) => entry.id === id);
        if (!item) return;
        item.done = !item.done;
        broadcastToRoom(room, {
          type: 'checklist:updated',
          checklist: room.checklist,
        });
        return;
      }

      if (type === 'checklist:remove') {
        const id = cleanStr(msg.id, 60);
        const before = room.checklist.length;
        room.checklist = room.checklist.filter((entry) => entry.id !== id);
        if (room.checklist.length !== before) {
          broadcastToRoom(room, {
            type: 'checklist:updated',
            checklist: room.checklist,
          });
        }
        return;
      }

      if (type === 'timer:control') {
        const action = typeof msg.action === 'string' ? msg.action : '';
        computeAuthoritativeTimer(room.timer);

        if (action === 'preset') {
          const presetKey = typeof msg.preset === 'string' ? msg.preset : 'focus25';
          const preset = ALLOWED_TIMER_PRESETS[presetKey] ?? ALLOWED_TIMER_PRESETS.focus25;
          room.timer = {
            label: preset.label,
            durationSec: preset.durationSec,
            remainingSec: preset.durationSec,
            running: false,
            endsAtMs: null,
          };
        } else if (action === 'start') {
          if (!room.timer.running) {
            const baseSec =
              room.timer.remainingSec > 0 ? room.timer.remainingSec : room.timer.durationSec;
            room.timer.remainingSec = baseSec;
            room.timer.running = true;
            room.timer.endsAtMs = Date.now() + baseSec * 1000;
          }
        } else if (action === 'pause') {
          if (room.timer.running) {
            room.timer.running = false;
            room.timer.endsAtMs = null;
          }
        } else if (action === 'reset') {
          room.timer.running = false;
          room.timer.remainingSec = room.timer.durationSec;
          room.timer.endsAtMs = null;
        } else {
          return;
        }

        broadcastToRoom(room, {
          type: 'timer:updated',
          serverTimeMs: Date.now(),
          timer: room.timer,
        });
      }
    });

    ws.on('close', () => {
      removeFromCurrentRoom();
    });

    ws.on('error', () => {
      removeFromCurrentRoom();
    });
  });

  // Periodic heartbeat keep-alive to clean up dead sockets
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.ping();
      }
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  return wss;
}
