# Link Index Plugin

## Tech
- Obsidian Plugin API (TypeScript), esbuild
- 単体テスト: vitest（純関数のみ対象）

## Hard Rules
- ファイルI/Oは `app.vault` 経由のみ。Node `fs` 禁止
- ネットワークは `requestUrl` のみ。`fetch` 禁止
- ID は ULID（`ulid` パッケージ）
- ボードJSONはatomic write（一時ファイル → rename）
- ボードJSONが破損したら `.broken-<timestamp>.json` にリネームして空ボードで起動
- 1ファイルの責務は1つ。300行を超えそうなら分割提案

## Domain Rules
- ボードは単一（`LinkIndex/board.json`）
- 「AI Inbox」フレームはシステム予約。起動時に存在確認・自己治癒
- MCP登録時：group指定あり→該当フレーム周辺、なし→AI Inbox

## Layout

```
src/
├── main.ts
├── types.ts
├── domain/
│   ├── CardRepository.ts
│   ├── BoardRepository.ts
│   ├── Index.ts
│   └── Layout.ts
├── ingest/
│   ├── UrlIngestor.ts
│   ├── PdfIngestor.ts
│   └── PathNormalizer.ts
├── canvas/
│   ├── CanvasView.ts
│   ├── Viewport.ts
│   ├── Renderer.ts
│   ├── HitTest.ts
│   ├── interactions/
│   │   ├── PanZoom.ts
│   │   ├── Selection.ts
│   │   ├── DragMove.ts
│   │   ├── Resize.ts
│   │   └── PasteDrop.ts
│   └── nodes/
│       ├── CardNode.ts
│       ├── FrameNode.ts
│       └── TextNode.ts
├── commands/
│   └── registerCommands.ts
└── settings/
    └── SettingsTab.ts
```

## Done definition
- npm run build が通る
- 影響範囲のテストが通る
- 既存機能を壊さない（手動確認手順を回答に含める）
