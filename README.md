# Random-note
一个基于 Cloudflare Workers 和 Pages 构建的记录管理系统。

## 功能特性

- 🔐 用户认证（JWT 令牌）
- 📊 动态表格管理
- 💾 数据持久化（KV 存储）
- 🌙 深色/浅色主题切换
- 📱 响应式设计

## 技术栈

- **前端**: HTML + CSS + JavaScript
- **后端**: Cloudflare Workers
- **部署**: Cloudflare Pages + Workers
- **存储**: Cloudflare KV

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/sseson/random-note.git
cd random-note
```

### 2. 配置 Cloudflare Workers

复制示例配置文件

```bash
cp wrangler.example.toml wrangler.toml
```

使用以下命令创建KV，记住KV ID
```bash
wrangler kv namespace create "RECORDS_STORE"
```

使用以下命令生成32位密钥，记住密钥
```bash
openssl rand -base64 32
```

编辑 wrangler.toml 填写对应项

```toml
[[kv_namespaces]]
binding = "RECORDS_STORE"
id = "your-kv-id"   //填入KV ID

[vars]
ALLOWED_ORIGIN = "https://your.worker.url"
JWT_SECRET = "your-secret"     //填入密钥
```

### 3. 安装依赖

```bash
npm install
```

### 4. 部署后端到 Cloudflare Workers

执行下面命令部署后端
```bash
wrangler deploy
```

执行完成后将会生成 Workers 地址，将地址配置到前端，复制示例配置文件

```bash
cp public/config.example.js public/config.js
```

编辑 public/config.js，将地址填入 WORKER_URL

```toml
WORKER_URL: 'https://your.worker.url'    //填入Workers地址
```

### 5. 部署前端到 Cloudflare Pages

执行以下命令打包前端文件
```bash
cd public
zip -r ../pages.zip *
cd ..
```

在 Cloudflare Dashboard 上传

- 登录 Cloudflare Dashboard：https://dash.cloudflare.com
- 进入 Pages
- 点击 Drag and drop your files
- 输入项目名称，点击 Create project
- 选择 pages.zip 文件上传，点击 Deploy

配置前端CORS地址，编辑 wrangler.toml，将前端地址填入ALLOWED_ORIGIN

```toml
[vars]
ALLOWED_ORIGIN = "https://your.worker.url"
```

重新部署使配置生效

```bash
wrangler deploy
```

至此部署全部完成。

## 默认账户

初次登录时系统会自动创建管理员账户，使用提供的用户名和密码登录即可。

## 文件结构

```
records-app/
├── src/
│   ├── worker.js          # Worker 入口
│   ├── auth.js            # 认证逻辑
│   ├── config.js          # 配置操作
│   ├── cors.js            # CORS公共页面
├── public/
│   ├── index.html         # 前端页面
│   ├── app.js             # 前端应用
│   ├── styles.css         # 样式
│   ├── config.example.js  # Worker URL配置示例
├── wrangler.example.toml  # Worker 配置示例
└── .gitignore             # Git 忽略文件
```

## 安全建议

- 不要将 `wrangler.toml` 提交到 Git
- 定期更新 JWT_SECRET
- 使用 HTTPS 部署
- 定期备份 KV 数据

## 许可证

MIT

## 问题反馈

如有问题，请提交 Issue 或 Pull Request。
