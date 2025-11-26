import { useEffect, useMemo, useRef, useState, KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { getOrCreateId } from '../lib/user';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL ?? API_BASE;

type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: number;
  kind?: 'system';
  systemType?: 'join' | 'leave';
};

export default function ChatPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selfId] = useState<string>(() => getOrCreateId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!roomId) return;
    let aborted = false;
    async function loadHistory() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/rooms/${roomId}/messages?limit=100`);
        if (!res.ok) throw new Error('历史记录加载失败');
        const data = await res.json();
        if (!aborted) setMessages(data.messages ?? []);
      } catch (err) {
        if (!aborted) setError(err instanceof Error ? err.message : '无法加载数据');
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    loadHistory();
    return () => {
      aborted = true;
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const socket = io(WS_URL, {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    const handleMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    };
    const handleSystem = (event: { type: 'join' | 'leave'; userId: string; at: number }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${event.type}-${event.userId}-${event.at}`,
          roomId,
          senderId: event.userId,
          content: event.type === 'join' ? '加入了会话' : '离开了会话',
          createdAt: event.at,
          kind: 'system',
          systemType: event.type,
        },
      ]);
    };

    socket.on('message', handleMessage);
    socket.on('system', handleSystem);
    socket.emit('join', { roomId, userId: selfId });

    return () => {
      socket.emit('leave', { roomId, userId: selfId });
      socket.off('message', handleMessage);
      socket.off('system', handleSystem);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, selfId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    const content = input.trim();
    if (!content || !roomId || !socketRef.current) return;
    socketRef.current.emit('message', { roomId, senderId: selfId, content });
    setInput('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const formattedTitle = useMemo(() => roomId?.slice(0, 10) ?? '', [roomId]);

  if (!roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded shadow text-center space-y-4">
          <div>链接无效</div>
          <button className="text-blue-600" onClick={() => navigate('/')}>
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-start pt-8 px-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow p-4 mb-4 flex flex-row items-center">
        <button onClick={() => navigate('/')} className="mr-2 text-blue-500 hover:text-blue-700">
          ← 返回
        </button>
        <div className="flex-1 text-center font-bold text-blue-700">
          房间 {formattedTitle} · 我是 {selfId.slice(0, 8)}
        </div>
      </div>
      <div className="w-full max-w-2xl flex-1 flex flex-col rounded bg-white p-4 shadow min-h-[500px]">
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto space-y-3 pr-2 border border-gray-100 rounded p-3 bg-slate-50"
        >
          {loading && <div className="text-gray-400 text-center">加载历史记录...</div>}
          {error && <div className="text-red-500 text-center">{error}</div>}
          {!loading && !messages.length && (
            <div className="text-gray-400 text-center">还没有任何消息，快开始聊天吧！</div>
          )}
          {messages.map((message) => {
            const isSelf = message.senderId === selfId;
            const timeLabel = new Date(message.createdAt).toLocaleTimeString();
            if (message.kind === 'system') {
              return (
                <div
                  key={message.id}
                  className="text-center text-xs text-gray-400 flex flex-col gap-1"
                >
                  <span>{`${message.senderId.slice(0, 6)} ${message.content}`}</span>
                  <span>{timeLabel}</span>
                </div>
              );
            }
            return (
              <div
                key={message.id}
                className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-3 py-2 text-sm shadow ${
                    isSelf ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className="text-[11px] opacity-70 mb-1">
                    {isSelf ? '我' : message.senderId.slice(0, 8)} · {timeLabel}
                  </div>
                  <div>{message.content}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2 focus:outline-none focus:ring focus:ring-blue-100"
            placeholder="输入内容..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white rounded px-6 py-2 disabled:opacity-40"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
