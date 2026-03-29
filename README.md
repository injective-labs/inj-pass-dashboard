# INJ Dashboard

独立的 React / Next 管理后台项目，用于管理 INJ Pass 用户。

## 功能

- 用户列表与搜索
- 查看用户完整资料
- 查看 AI 用量与最近 AI 日志
- 手动调整 NINJA 积分

## 环境变量

创建 `.env.local` 或 `.env`：

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_ADMIN_API_KEY=replace-with-your-admin-secret
```

也可以直接从模板复制：

```bash
cp .env.example .env.local
```

后端同时需要：

```bash
ADMIN_API_KEY=your-admin-secret
ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
```

## 启动

```bash
cd inj-dashboard
pnpm install
pnpm dev
```

默认运行在 `http://localhost:3002`。
