use serde_json::{json, Value};
use ulid::Ulid;

use crate::board::{Board, BoardNode};
use crate::card_md::Card;
use crate::layout::place_new_card;
use crate::mcp::McpContext;
use crate::ogp;

pub fn handle_call(params: &Value, ctx: &McpContext) -> Result<Value, String> {
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .ok_or("Missing tool name")?;
    let args = params.get("arguments").cloned().unwrap_or(json!({}));

    let text = match name {
        "add_link"    => add_link(&args, ctx)?,
        "list_frames" => list_frames(ctx)?,
        "list_cards"  => list_cards(&args, ctx)?,
        "remove_card" => remove_card(&args, ctx)?,
        _ => return Err(format!("Unknown tool: {name}")),
    };

    Ok(json!({ "content": [{ "type": "text", "text": text }] }))
}

// ─────────────── add_link ───────────────

fn add_link(args: &Value, ctx: &McpContext) -> Result<String, String> {
    let url = args.get("url").and_then(Value::as_str).ok_or("Missing url")?;
    let group = args.get("group").and_then(Value::as_str);
    let override_title = args.get("title").and_then(Value::as_str);
    let tags: Vec<String> = args
        .get("tags")
        .and_then(Value::as_array)
        .map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect())
        .unwrap_or_default();

    let ogp_data = ogp::fetch(url);

    let title = override_title
        .map(str::to_string)
        .or(ogp_data.title)
        .unwrap_or_else(|| url.to_string());

    let id  = Ulid::new().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let card = Card {
        id: id.clone(),
        card_type: "web".to_string(),
        url: Some(url.to_string()),
        path: None,
        title: title.clone(),
        description: ogp_data.description,
        favicon: ogp_data.favicon,
        thumbnail: None,
        domain: ogp_data.domain,
        tags,
        added: now,
        status: "unread".to_string(),
        source: "mcp".to_string(),
        mime: None,
    };

    card.save(&ctx.vault_path)?;

    let mut board = Board::load(&ctx.vault_path);
    let node = place_new_card(&mut board, &id, group);
    board.nodes.push(node);
    board.save(&ctx.vault_path)?;

    Ok(format!("追加しました: \"{title}\" (ID: {id})"))
}

// ─────────────── list_frames ───────────────

fn list_frames(ctx: &McpContext) -> Result<String, String> {
    let board = Board::load(&ctx.vault_path);
    let mut lines = vec!["## フレーム一覧".to_string()];

    for node in &board.nodes {
        let (fid, flabel, fx, fy, fw, fh, fsys) = match node {
            BoardNode::Frame { id, label, x, y, w, h, system, .. } => {
                (id.as_str(), label.as_str(), *x, *y, *w, *h, *system)
            }
            _ => continue,
        };

        // Count cards whose bounding box is inside this frame
        let count = board.nodes.iter().filter(|n| match *n {
            BoardNode::Card { x, y, w, h, .. } => {
                *x >= fx && *y >= fy && (*x + *w) <= (fx + fw) && (*y + *h) <= (fy + fh)
            }
            _ => false,
        }).count();

        let sys_tag = if fsys { " [system]" } else { "" };
        lines.push(format!("- **{flabel}**{sys_tag}: {count} カード (id: `{fid}`)"));
    }

    if lines.len() == 1 {
        lines.push("フレームなし".to_string());
    }
    Ok(lines.join("\n"))
}

// ─────────────── list_cards ───────────────

fn list_cards(args: &Value, ctx: &McpContext) -> Result<String, String> {
    let frame_name = args
        .get("frame")
        .and_then(Value::as_str)
        .unwrap_or("AI Inbox");

    let board = Board::load(&ctx.vault_path);

    let (fx, fy, fw, fh) = board
        .nodes
        .iter()
        .find_map(|n| match n {
            BoardNode::Frame { label, x, y, w, h, .. } if label == frame_name => {
                Some((*x, *y, *w, *h))
            }
            _ => None,
        })
        .ok_or_else(|| format!("フレーム '{frame_name}' が見つかりません"))?;

    let card_ids: Vec<String> = board
        .nodes
        .iter()
        .filter_map(|n| match n {
            BoardNode::Card { card_id, x, y, w, h, .. }
                if *x >= fx && *y >= fy && (*x + *w) <= (fx + fw) && (*y + *h) <= (fy + fh) =>
            {
                Some(card_id.clone())
            }
            _ => None,
        })
        .collect();

    let mut lines = vec![format!(
        "## 「{frame_name}」のカード ({} 件)",
        card_ids.len()
    )];

    for id in &card_ids {
        if let Some(card) = Card::load(&ctx.vault_path, id) {
            let url_hint = card.url.as_deref().unwrap_or("-");
            lines.push(format!(
                "- `[{}]` **{}** — {} (id: `{}`)",
                card.status, card.title, url_hint, card.id
            ));
        }
    }

    Ok(lines.join("\n"))
}

// ─────────────── remove_card ───────────────

fn remove_card(args: &Value, ctx: &McpContext) -> Result<String, String> {
    let id = args.get("id").and_then(Value::as_str).ok_or("Missing id")?;

    let mut board = Board::load(&ctx.vault_path);
    let before = board.nodes.len();

    board.nodes.retain(|n| {
        !matches!(n, BoardNode::Card { card_id, .. } if card_id == id)
    });

    if board.nodes.len() == before {
        return Err(format!("カード ID '{id}' がボード上に見つかりません"));
    }

    board.save(&ctx.vault_path)?;
    Card::delete(&ctx.vault_path, id)?;

    Ok(format!("削除しました: {id}"))
}
