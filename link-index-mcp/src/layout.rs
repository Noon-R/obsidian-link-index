use crate::board::{Board, BoardNode, Viewport};

const CARD_W: f64 = 280.0;
const CARD_H: f64 = 200.0;
const CARD_GAP: f64 = 16.0;
const FRAME_LABEL_H: f64 = 32.0;

/// Place a new card in the target frame (creating one if `group` is new).
/// Mutates `board.nodes` in place (may grow the frame height).
/// Returns the new CardNode to push onto `board.nodes`.
pub fn place_new_card(board: &mut Board, card_id: &str, group: Option<&str>) -> BoardNode {
    ensure_frame(board, group);
    place_in_frame(board, card_id, group)
}

/// Ensure a frame with the given label exists.
/// `group = None` targets the AI Inbox system frame (always present after `ensure_system_frames`).
fn ensure_frame(board: &mut Board, group: Option<&str>) {
    if let Some(g) = group {
        let exists = board.nodes.iter().any(|n| {
            matches!(n, BoardNode::Frame { label, .. } if label == g)
        });
        if !exists {
            let viewport = board.viewport.clone();
            board.nodes.push(new_frame(&viewport, g));
        }
    }
}

fn new_frame(vp: &Viewport, label: &str) -> BoardNode {
    BoardNode::Frame {
        id: format!("n_frame_{}", chrono::Utc::now().timestamp_millis()),
        label: label.to_string(),
        x: vp.x + (1200.0 / vp.zoom).round(),
        y: vp.y,
        w: 1000.0,
        h: 600.0,
        color: "#88aaff".to_string(),
        system: false,
    }
}

fn place_in_frame(board: &mut Board, card_id: &str, group: Option<&str>) -> BoardNode {
    // Find target frame geometry (immutable borrow ends after this block)
    let (frame_idx, fx, fy, fw, fh) = board
        .nodes
        .iter()
        .enumerate()
        .find_map(|(i, n)| {
            if let BoardNode::Frame { x, y, w, h, label, system, .. } = n {
                let matched = match group {
                    Some(g) => label == g,
                    None    => label == "AI Inbox" && *system,
                };
                if matched {
                    return Some((i, *x, *y, *w, *h));
                }
            }
            None
        })
        .expect("target frame must exist after ensure_frame");

    // Count cards overlapping the target frame
    let count = board.nodes.iter().filter(|n| {
        if let BoardNode::Card { x, y, w, h, .. } = n {
            *x >= fx && *y >= fy && (*x + *w) <= (fx + fw) && (*y + *h) <= (fy + fh)
        } else {
            false
        }
    }).count();

    // Compute grid position
    let cols = ((fw - CARD_GAP) / (CARD_W + CARD_GAP)).max(1.0).floor() as usize;
    let col  = count % cols;
    let row  = count / cols;

    // Expand frame height if needed
    let needed_h = FRAME_LABEL_H + CARD_GAP + (row + 1) as f64 * (CARD_H + CARD_GAP);
    if needed_h > fh {
        if let BoardNode::Frame { h, .. } = &mut board.nodes[frame_idx] {
            *h = needed_h;
        }
    }

    BoardNode::Card {
        id:      format!("n_{card_id}"),
        card_id: card_id.to_string(),
        x: fx + CARD_GAP + col as f64 * (CARD_W + CARD_GAP),
        y: fy + FRAME_LABEL_H + CARD_GAP + row as f64 * (CARD_H + CARD_GAP),
        w: CARD_W,
        h: CARD_H,
        z: 1,
    }
}
