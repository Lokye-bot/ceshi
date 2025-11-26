# 匿名二维码聊天（Anon QR Chat）

一个极简美观的匿名聊天产品 —— 通过扫码二维码或分享链接，即可与任意身份进行1对1匿名对话，无需注册，无需手机号。

## 产品亮点
- 每位用户进站自动分配身份并生成专属二维码
- 手机扫码/好友转发二维码即可直达聊天，不暴露任何隐私
- 聊天链接格式：`#/chat/<匿名ID>`
- 支持刷新重置匿名身份与二维码
- 页面极简，适配移动端
- React+TypeScript 前端，Node.js+Express+Socket.IO 后端（见 `server/`）

## 本地开发
1. 安装依赖：
   ```bash
   cd server && npm install      # 后端
   cd ../client && npm install   # 前端
   ```
2. 启动服务：
   ```bash
   # 终端 1
   cd server
   npm run dev

   # 终端 2
   cd client
   npm run dev
   ```
3. 浏览器打开 http://localhost:5173/ 使用页面。默认后端地址为 `http://localhost:3001`，如需自定义，可在前端根目录创建 `.env` 并写入：
   ```
   VITE_API_BASE=http://your-host:3001
   VITE_WS_URL=http://your-host:3001
   ```

## 代码结构
```
client/
  src/App.tsx         // 主页：二维码、历史会话列表
  src/pages/ChatPage.tsx // 聊天页：历史记录+实时消息
  src/lib/user.ts     // 匿名 ID 共享工具
  src/main.tsx        // 路由与入口
  ...
```

## 后端/聊天联调
`server/` 目录提供基于 Express + Socket.IO + SQLite 的服务：
- `GET /api/users/:userId/rooms` 查看个人历史会话
- `GET /api/rooms/:roomId/messages` 拉取房间历史记录
- WebSocket 事件 `join/leave/message` 处理多人实时消息

---

> 文案/配色/二维码样式均可自定义。产品体验和文案为可改填充项。如需加内容或微调设计，直接改页面文本和tailwind class即可。
