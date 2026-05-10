# Obsidian Link Index Plugin — 設計計画 v3（実装進捗反映版）

PureRef風の無限キャンバスでリンクカードを俯瞰・配置でき、最終的に MCP 経由で Claude Code から登録できるインデックスプラグイン。

**最終更新: 2026-05-11 / Phase 0〜8 完了**

---

## 確定事項（v2からの変更）

| 項目 | 決定 |
|---|---|
| ボード | **シングルボード**（`LinkIndex/board.json`）。複数ボード対応はしない |
| ボード破損時 | `.broken-<timestamp>.json` にリネームして空ボードで起動 |
| MCP登録時の配置 | group指定あり→該当フレーム、なし→**「AI Inbox」フレーム** |
| iPad/モバイル対応 | **対象外** |

---

## 1. データモデル

### 1.1 カード（SSOT）

`LinkIndex/cards/<ulid>.md`：

```markdown
---
id: "01HXYZ..."
type: "web"
url: "https://example.com/article"
title: "記事のタイトル"
description: "OGP description"
favicon: "https://.../favicon.ico"
thumbnail: "LinkIndex/thumbnails/01HXYZ.png"
domain: "example.com"
tags: [rust, async]
added: "2026-05-10T14:30:00.000Z"
status: "unread"
source: "mcp"
---

## メモ
```

> **注**: 各フィールドは `JSON.stringify()` でシリアライズ（文字列はダブルクォート）。tags のみ `[item1, item2]` 形式（クォートなし）。Rust MCP server も同一フォーマットを生成する。

### 1.2 ボード（単一）

`LinkIndex/board.json`：

```json
{
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1.0 },
  "nodes": [
    { "id": "n_01HX...", "type": "card", "card_id": "01HXYZ...", "x": 320, "y": 180, "w": 280, "h": 200, "z": 1 },
    { "id": "n_inbox", "type": "frame", "label": "AI Inbox", "x": -1200, "y": -400, "w": 1000, "h": 600, "color": "#6688cc", "system": true },
    { "id": "n_frame_async", "type": "frame", "label": "async/await", "x": 100, "y": 100, "w": 800, "h": 600, "color": "#88aaff" }
  ]
}
```

### 1.3 ディレクトリ構成

```
vault/
└── LinkIndex/
    ├── cards/                           # SSOT（カードごとに .md）
    ├── board.json                       # 単一ボード
    ├── board.json.tmp                   # atomic write 用一時ファイル
    ├── board.broken-<timestamp>.json    # 破損時退避
    └── thumbnails/                      # OGP / PDF サムネイル
```

---

## 2. プラグイン構成（実装済み）

```
src/
├── main.ts
├── types.ts
├── domain/
│   ├── CardRepository.ts    # vault API でCRUD、ULID採番、frontmatter シリアライズ
│   ├── BoardRepository.ts   # atomic write、破損リカバリ、AI Inbox 自己治癒
│   ├── Index.ts             # 起動時スキャン、modify/delete で差分更新
│   ├── Layout.ts            # placeInFrame、ensureSystemFrames 等（純関数）
│   └── AutoLayout.ts        # タグ別グルーピング格子整列
├── ingest/
│   ├── UrlIngestor.ts       # OGP fetch（requestUrl）、サムネDL
│   ├── PdfIngestor.ts       # pdfjs-dist stub（npm install で有効化）
│   └── PathNormalizer.ts    # ドラッグパス → vault相対パス変換
├── canvas/
│   ├── CanvasView.ts        # ItemView 本体、イベントハブ
│   ├── Viewport.ts          # screenToWorld / worldToScreen / fitToContent
│   ├── Renderer.ts          # Canvas 2D 描画 + ビューポートカリング
│   ├── HitTest.ts           # ノード・リサイズハンドルのヒットテスト
│   ├── ImageCache.ts        # vault画像の非同期ロード・createImageBitmap
│   ├── SearchOverlay.ts     # Ctrl+F 絞り込みオーバーレイ
│   ├── FrameEditModal.ts    # フレームラベル・カラー編集モーダル
│   ├── QuickAddModal.ts     # URL/パス入力モーダル
│   └── interactions/
│       ├── PanZoom.ts
│       ├── Selection.ts
│       ├── DragMove.ts
│       ├── Resize.ts
│       └── PasteDrop.ts     # Ctrl+V URL検出 + ファイルD&D
├── commands/
│   └── registerCommands.ts
└── settings/
    └── SettingsTab.ts
```

---

## 3. キーバインド一覧

| 操作 | キー |
|---|---|
| URL ペースト → カード追加 | `Ctrl+V` |
| クイック追加モーダル | `Ctrl+N` |
| 選択ノード削除 | `Delete` / `Backspace` |
| fit-to-content | `F` |
| 選択解除 | `Escape` |
| 全選択 | `Ctrl+A` |
| パン | `Alt+ドラッグ` / 中クリック |
| ズーム | `Ctrl+ホイール` |
| 絞り込み検索 | `Ctrl+F` |
| 自動レイアウト | `Ctrl+Shift+L` |
| 右クリック | コンテキストメニュー |

---

## 4. Renderer 描画密度（ズーム別）

| zoom | モード | 描画内容 |
|---|---|---|
| < 0.2 | dot | ステータス色の丸のみ |
| 0.2〜0.45 | compact | タイトル1行 + ステータスドット |
| 0.45〜0.8 | normal | ドメイン + タイトル + サムネイル |
| ≥ 0.8 | full | ドメイン + タイトル3行 + サムネイル + 説明文 + バッジ |

---

## 5. MCP からのカード追加と配置

### 5.1 Rust MCP server のツール

| ツール名 | 説明 |
|---|---|
| `add_link` | URL → OGP取得 → カード生成 → ボード配置 |
| `list_frames` | フレーム一覧（カード数付き） |
| `list_cards` | フレーム内カード一覧 |
| `remove_card` | カードをボード＋cards/から削除 |

### 5.2 配置ロジック（TypeScript / Rust 共通）

- `group` 未指定 → AI Inbox フレーム内に格子スタック
- `group` 指定 → ラベル一致フレームを探す。なければビューポート右側に新規作成
- フレームから溢れたら `frame.h` を自動拡張

### 5.3 board.json 競合書き込み

- MCP server: read-modify-write を原子的に（tmp → rename）
- プラグイン側: `vault.on('modify', 'LinkIndex/board.json')` で変更を検知して再読み込み

---

## 6. Rust MCP server 構成（`link-index-mcp/`）

```
link-index-mcp/
├── Cargo.toml              # serde_json, ureq, scraper, ulid, chrono, url
└── src/
    ├── main.rs             # stdin ループ、--vault 引数
    ├── mcp.rs              # JSON-RPC 2.0 dispatch
    ├── board.rs            # Board/BoardNode serde + atomic 読み書き
    ├── card_md.rs          # frontmatter パース/シリアライズ（TS互換）
    ├── layout.rs           # placeInFrame（Layout.ts 移植）
    ├── ogp.rs              # OGP フェッチ（ureq + scraper）
    └── tools.rs            # 4ツールの実装
```

**ビルド手順**（Rust 未インストールの場合）:
```powershell
winget install Rustlang.Rustup   # または https://rustup.rs/
# 新しいターミナルで:
cd link-index-mcp
cargo build --release
# → target\release\link-index-mcp.exe
```

**Claude Code への登録**（`~/.claude/settings.json`）:
```json
{
  "mcpServers": {
    "link-index": {
      "command": "C:\\path\\to\\link-index-mcp\\target\\release\\link-index-mcp.exe",
      "args": ["--vault", "D:\\path\\to\\your\\vault"]
    }
  }
}
```

---

## 7. 実装フェーズ進捗

| Phase | 内容 | 状態 |
|---|---|---|
| 0 | スキャフォールド（manifest, main.ts, esbuild） | ✅ 完了 |
| 1 | ドメイン層（CardRepository, BoardRepository, Index, Layout） | ✅ 完了 |
| 2 | 最小キャンバスView（Viewport, 静的描画） | ✅ 完了 |
| 3 | インタラクション（選択・ドラッグ・リサイズ・保存） | ✅ 完了 |
| 4 | カード追加（Ctrl+V, D&D, クイック追加, OGP） | ✅ 完了 |
| 5 | サムネイル・リッチ表示（ImageCache, PDF stub, zoom別密度） | ✅ 完了 |
| 6 | 整列・検索・フレーム編集（AutoLayout, SearchOverlay, コンテキストメニュー） | ✅ 完了 |
| 7 | パフォーマンス（ビューポートカリング, 検索キャッシュ） | ✅ 完了 |
| 8 | Rust MCP server（`link-index-mcp/`） | ✅ ソース完了（要 Rust インストール＆ビルド） |
| 9 | Claude Desktop / Claude Code への MCP 登録・動作確認 | 🔲 未着手 |

---

## 8. Done definition

- `npm run build` が通る ✅
- `npm test` で 16 件パス ✅
- 既存機能を壊さない（手動確認: CanvasView 起動 → カード追加 → ドラッグ → 保存 → 再起動で復元）
