import { useEffect, useMemo, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import './index.css';
import { getOrCreateId } from './lib/user';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

type RoomSummary = {
  roomId: string;
  lastMessageAt: number | null;
  messageCount: number;
  participants: { userId: string; joinedAt: number }[];
};

export default function App() {
  const [uid] = useState<string>(() => getOrCreateId());
  const roomLink = useMemo(() => `${window.location.origin}/#/chat/${uid}`, [uid]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let aborted = false;
    async function loadRooms() {
      setLoadingRooms(true);
      setError('');
      try {
        const response = await fetch(`${API_BASE}/api/users/${uid}/rooms`);
        if (!response.ok) throw new Error('加载失败');
        const data = await response.json();
        if (!aborted) setRooms(data.rooms ?? []);
      } catch (err) {
        if (!aborted) setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        if (!aborted) setLoadingRooms(false);
      }
    }
    loadRooms();
    return () => {
      aborted = true;
    };
  }, [uid]);

  const formatTime = (ts?: number | null) => {
    if (!ts) return '暂无消息';
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
        <h1 className="text-2xl font-bold mb-4 text-blue-600">匿名二维码聊天</h1>
        <p className="mb-2 text-gray-600">每位访客随机分配匿名身份</p>

        <QRCodeCanvas value={roomLink} size={180} className="mb-4 shadow-md rounded bg-white" />

        <div className="mb-2 text-gray-400 text-xs">你的匿名ID：</div>
        <div className="mb-4 font-mono text-blue-700 text-sm break-all select-all">
          {uid}
        </div>

        <div className="text-center text-gray-500 mb-3">
          <span className="inline-block">
            通过扫码或分享二维码，<br />
            马上开始 1 对 1 匿名聊天。
          </span>
        </div>

        <a
          className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded w-full text-center font-medium transition"
          href={`#/chat/${uid}`}
        >
          进入我的聊天
        </a>
      </div>

      <div className="w-full max-w-2xl mt-8">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-blue-600">我的历史会话</h2>
            <button
              className="text-sm text-blue-500 hover:text-blue-700"
              onClick={() => {
                // 重新触发 useEffect
                setRooms([]);
                setError('');
                setLoadingRooms(true);
                fetch(`${API_BASE}/api/users/${uid}/rooms`)
                  .then((res) => res.json())
                  .then((data) => setRooms(data.rooms ?? []))
                  .catch(() => setError('加载失败'))
                  .finally(() => setLoadingRooms(false));
              }}
            >
              刷新
            </button>
          </div>

          {loadingRooms && <div className="text-gray-500">加载中...</div>}
          {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
          {!loadingRooms && !rooms.length && <div className="text-gray-400">暂无会话记录</div>}

          <ul className="divide-y">
            {rooms.map((room) => (
              <li key={room.roomId} className="py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-800">房间 {room.roomId.slice(0, 8)}</div>
                  <div className="text-xs text-gray-500">{formatTime(room.lastMessageAt)}</div>
                </div>
                <div className="text-sm text-gray-500">
                  消息数：{room.messageCount}，参与者：
                  {room.participants.map((p) => p.userId.slice(0, 6)).join('、') || '暂无'}
                </div>
                <a
                  className="text-sm text-blue-500 hover:text-blue-700 self-end"
                  href={`#/chat/${room.roomId}`}
                >
                  查看对话 →
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
