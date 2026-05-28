# MQ Browser

基于 Tauri + TypeScript 的桌面应用，用于管理 RabbitMQ 连接，浏览 Exchange、队列、绑定与消息。

界面镜像 [MCP-Browser](https://github.com/unicorngithub/MCP-Browser)：多工作区 Tab、连接侧栏、详情面板、深色模式、中英双语。

## 技术栈

- **前端**：React 18 + TypeScript + Tailwind CSS + Zustand + i18next
- **外壳**：Tauri 2（Rust）
- **AMQP**：使用 [lapin](https://github.com/amqp-rs/lapin) 进行 publish / basic.get / purge
- **管理 API**：RabbitMQ Management HTTP API（默认端口 15672），用于读取 queues / exchanges / bindings / vhosts

## 开发

```bash
pnpm install
pnpm tauri:dev
```

需要本机已安装 Rust 工具链（`rustup`）以及 Tauri 对应平台的依赖，参考 https://v2.tauri.app/start/prerequisites/。

## 构建

```bash
pnpm tauri:build
```

## 目录结构

```
src/                    React 前端（镜像 MCP-Browser 外壳）
shared/                 跨文件复用的类型与常量
src-tauri/              Rust 后端（Tauri 命令、lapin AMQP、管理 HTTP）
```

## License

MIT
