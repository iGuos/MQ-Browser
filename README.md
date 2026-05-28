# MQ Browser

Tauri + TypeScript desktop app to manage RabbitMQ connections and browse exchanges, queues, and messages.

UI mirrors [MCP-Browser](https://github.com/unicorngithub/MCP-Browser): multi-workspace tabs, connection sidebar, detail panel, dark mode, i18n (en / zh-CN).

## Tech stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Zustand + i18next
- **Shell**: Tauri 2 (Rust)
- **AMQP**: [lapin](https://github.com/amqp-rs/lapin) for publish / basic.get / purge
- **Management**: RabbitMQ Management HTTP API (port 15672) for topology — queues / exchanges / bindings / vhosts

## Develop

```bash
pnpm install
pnpm tauri:dev
```

You need a working Rust toolchain (`rustup`) and platform-specific Tauri prerequisites — see https://v2.tauri.app/start/prerequisites/.

## Build

```bash
pnpm tauri:build
```

## Project layout

```
src/                    React UI (mirrors MCP-Browser shell)
shared/                 Types and constants shared with the rest of the TS code
src-tauri/              Rust backend (Tauri commands, lapin AMQP client, mgmt HTTP)
```

## License

MIT
