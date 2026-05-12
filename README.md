# Link Index Plugin

PureRef風の無限キャンバスでWebリンクやファイルを管理するObsidianプラグイン。MCP経由でClaudeやGitHub CopilotなどのAIから直接カードを追加できます。

## 機能

- URLペースト／ドラッグ&ドロップでOGPカードを自動生成
- タグ別オートレイアウト、フレーム管理
- ズーム連動描画密度（サムネイル・ファビコン表示）
- Ctrl+F による絞り込み検索
- MCP経由でAIから操作可能

## AIとの連携（MCP Server）

`link-index-mcp` はMCP標準プロトコル（JSON-RPC 2.0 over stdio）で動作するRustサーバーです。ClaudeとGitHub Copilotの両方から同じサーバーを利用します。

### 前提条件

- [Rust](https://rustup.rs/) がインストールされていること

### ビルド

```sh
cd link-index-mcp
cargo build --release
```

バイナリが `link-index-mcp/target/release/link-index-mcp(.exe)` に生成されます。

---

### GitHub Copilot（VS Code）

`.vscode/mcp.json` が設定済みです。

1. VS Code でこのフォルダーをワークスペースとして開く
2. GitHub Copilot Chat を開く
3. 初回接続時に VS Code が **Obsidian vault のパス** を入力プロンプトで尋ねます

環境変数 `OBSIDIAN_VAULT` を vault のパスに設定しておくと自動入力されます。

```sh
# PowerShell
$env:OBSIDIAN_VAULT = "D:\path\to\your\vault"

# bash / zsh
export OBSIDIAN_VAULT="/path/to/your/vault"
```

Copilot Chat で以下のように話しかけると Link Index を操作できます:

```
Link Index に https://example.com を追加して
AI Inbox のカード一覧を見せて
フレーム一覧を表示して
```

---

### Claude Desktop

`claude_desktop_config.json`（`%APPDATA%\Claude\` または `~/Library/Application Support/Claude/`）の `mcpServers` に追加します:

```json
{
  "mcpServers": {
    "link-index": {
      "command": "D:\\path\\to\\link-index-mcp\\target\\release\\link-index-mcp.exe",
      "args": ["--vault", "D:\\path\\to\\your\\vault"]
    }
  }
}
```

macOS / Linux の場合はパスを適宜変更し、`.exe` は不要です。

---

### Claude Code（CLI）

```sh
claude mcp add link-index \
  "D:/path/to/link-index-mcp/target/release/link-index-mcp" \
  --args "--vault" "D:/path/to/your/vault"
```

---

### 利用可能なMCPツール

| ツール名 | 説明 | 主なパラメータ |
|---|---|---|
| `add_link` | URLをOGP取得してカード追加 | `url`（必須）, `group`, `title`, `tags` |
| `list_frames` | フレーム一覧とカード数を表示 | なし |
| `list_cards` | フレーム内のカード一覧を表示 | `frame`（省略時: AI Inbox） |
| `remove_card` | カードをボードから削除 | `id`（必須、ULID） |

---

## キーボードショートカット

| キー | 動作 |
|---|---|
| `Ctrl+V` | URLペースト → OGPカード追加 |
| `Ctrl+N` | クイック追加モーダル |
| `Ctrl+F` | 絞り込み検索 |
| `Ctrl+Shift+L` | 自動レイアウト |
| `Ctrl+A` | 全選択 |
| `Delete` / `Backspace` | 選択ノード削除 |
| `F` | 全体をフィット表示 |
| `Escape` | 選択解除 / 検索を閉じる |
| `Alt+ドラッグ` / 中クリック | パン |
| `Ctrl+ホイール` | ズーム |

## 開発

```sh
npm install
npm run build   # esbuild でバンドル
npm test        # vitest で単体テスト
```
