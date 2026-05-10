use std::path::PathBuf;
use serde_json::{json, Value};
use crate::tools;

pub struct McpContext {
    pub vault_path: PathBuf,
}

/// Dispatch a raw JSON-RPC 2.0 line from stdin.
/// Returns None for notifications (which get no response).
pub fn dispatch(line: &str, ctx: &McpContext) -> Option<String> {
    let req: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(e) => {
            return Some(error_response(Value::Null, -32700, &format!("Parse error: {e}")));
        }
    };

    // Notifications have no "id" field — no response needed
    if req.get("id").is_none() {
        return None;
    }

    let id = req["id"].clone();
    let method = req.get("method").and_then(Value::as_str).unwrap_or("");
    let params = req.get("params").cloned().unwrap_or(Value::Null);

    let result = match method {
        "initialize" => handle_initialize(&params),
        "ping" => Ok(json!({})),
        "tools/list" => handle_tools_list(),
        "tools/call" => tools::handle_call(&params, ctx),
        _ => Err(format!("Method not found: {method}")),
    };

    let resp = match result {
        Ok(v) => json!({ "jsonrpc": "2.0", "id": id, "result": v }),
        Err(e) => json!({
            "jsonrpc": "2.0", "id": id,
            "error": { "code": -32603, "message": e }
        }),
    };

    Some(serde_json::to_string(&resp).unwrap())
}

fn error_response(id: Value, code: i32, message: &str) -> String {
    serde_json::to_string(&json!({
        "jsonrpc": "2.0", "id": id,
        "error": { "code": code, "message": message }
    }))
    .unwrap()
}

fn handle_initialize(params: &Value) -> Result<Value, String> {
    let proto = params
        .get("protocolVersion")
        .and_then(Value::as_str)
        .unwrap_or("2024-11-05");
    Ok(json!({
        "protocolVersion": proto,
        "capabilities": { "tools": {} },
        "serverInfo": { "name": "link-index-mcp", "version": "0.1.0" }
    }))
}

fn handle_tools_list() -> Result<Value, String> {
    Ok(json!({
        "tools": [
            {
                "name": "add_link",
                "description": "URLをLink Indexボードに追加します。OGPを取得してカード化します",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "url":   { "type": "string", "description": "追加するURL" },
                        "group": { "type": "string", "description": "追加先フレーム名（省略時はAI Inbox）" },
                        "title": { "type": "string", "description": "タイトル上書き（省略時はOGPから取得）" },
                        "tags": {
                            "type": "array",
                            "items": { "type": "string" },
                            "description": "タグリスト"
                        }
                    },
                    "required": ["url"]
                }
            },
            {
                "name": "list_frames",
                "description": "Link Indexボードのフレーム一覧とカード数を返します",
                "inputSchema": { "type": "object", "properties": {} }
            },
            {
                "name": "list_cards",
                "description": "フレーム内のカード一覧を返します",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "frame": { "type": "string", "description": "フレーム名（省略時はAI Inbox）" }
                    }
                }
            },
            {
                "name": "remove_card",
                "description": "カードをボードと cards/ ディレクトリから削除します",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "id": { "type": "string", "description": "削除するカードのID（ULID）" }
                    },
                    "required": ["id"]
                }
            }
        ]
    }))
}
