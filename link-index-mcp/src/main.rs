// link-index-mcp -- MCP server for the Obsidian Link Index plugin
// Usage: link-index-mcp --vault /path/to/obsidian/vault

use std::env;
use std::io::{self, BufRead, Write};
use std::path::PathBuf;

mod board;
mod card_md;
mod layout;
mod mcp;
mod ogp;
mod tools;

fn main() {
    let args: Vec<String> = env::args().collect();
    let vault_path = parse_vault_arg(&args).unwrap_or_else(|| {
        eprintln!("Usage: link-index-mcp --vault <vault-path>");
        std::process::exit(1);
    });

    let ctx = mcp::McpContext { vault_path };
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = stdout.lock();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                eprintln!("stdin error: {e}");
                break;
            }
        };
        if line.trim().is_empty() {
            continue;
        }
        if let Some(response) = mcp::dispatch(&line, &ctx) {
            writeln!(out, "{response}").ok();
            out.flush().ok();
        }
    }
}

fn parse_vault_arg(args: &[String]) -> Option<PathBuf> {
    let pos = args.iter().position(|a| a == "--vault")?;
    args.get(pos + 1).map(PathBuf::from)
}
