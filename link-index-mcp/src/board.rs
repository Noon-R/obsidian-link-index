use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone)]
pub struct Board {
    pub version: u32,
    pub viewport: Viewport,
    pub nodes: Vec<BoardNode>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Viewport {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

/// Uses serde's internally-tagged enum so JSON gets `"type": "card"` etc.
#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum BoardNode {
    #[serde(rename = "card")]
    Card {
        id: String,
        card_id: String,
        x: f64,
        y: f64,
        w: f64,
        h: f64,
        z: i32,
    },
    #[serde(rename = "frame")]
    Frame {
        id: String,
        label: String,
        x: f64,
        y: f64,
        w: f64,
        h: f64,
        color: String,
        #[serde(default)]
        system: bool,
    },
    #[serde(rename = "text")]
    Text {
        id: String,
        text: String,
        x: f64,
        y: f64,
        w: f64,
        h: f64,
    },
}

impl Board {
    pub fn empty() -> Self {
        let mut board = Board {
            version: 1,
            viewport: Viewport { x: 0.0, y: 0.0, zoom: 1.0 },
            nodes: vec![],
        };
        ensure_system_frames(&mut board);
        board
    }

    pub fn load(vault_path: &Path) -> Self {
        let board_path = vault_path.join("LinkIndex/board.json");
        match fs::read_to_string(&board_path) {
            Ok(raw) => match serde_json::from_str::<Board>(&raw) {
                Ok(mut board) => {
                    ensure_system_frames(&mut board);
                    board
                }
                Err(e) => {
                    eprintln!("board.json parse error: {e}");
                    let ts = chrono::Utc::now().format("%Y%m%dT%H%M%S");
                    let broken = vault_path.join(format!("LinkIndex/board.broken-{ts}.json"));
                    fs::rename(&board_path, broken).ok();
                    Board::empty()
                }
            },
            Err(_) => Board::empty(),
        }
    }

    pub fn save(&self, vault_path: &Path) -> Result<(), String> {
        let dir = vault_path.join("LinkIndex");
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

        let board_path = dir.join("board.json");
        let tmp_path = dir.join("board.json.tmp");

        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(&tmp_path, json).map_err(|e| e.to_string())?;
        fs::rename(&tmp_path, &board_path).map_err(|e| e.to_string())
    }
}

pub fn ensure_system_frames(board: &mut Board) {
    let has_inbox = board.nodes.iter().any(|n| {
        matches!(n, BoardNode::Frame { label, system, .. } if label == "AI Inbox" && *system)
    });
    if !has_inbox {
        board.nodes.push(BoardNode::Frame {
            id: "n_inbox".to_string(),
            label: "AI Inbox".to_string(),
            x: -1200.0,
            y: -400.0,
            w: 1000.0,
            h: 600.0,
            color: "#6688cc".to_string(),
            system: true,
        });
    }
}
