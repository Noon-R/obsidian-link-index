use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Clone, Debug)]
pub struct Card {
    pub id: String,
    pub card_type: String,
    pub url: Option<String>,
    pub path: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub favicon: Option<String>,
    pub thumbnail: Option<String>,
    pub domain: Option<String>,
    pub tags: Vec<String>,
    pub added: String,
    pub status: String,
    pub source: String,
    pub mime: Option<String>,
}

impl Card {
    /// Serialize to the same frontmatter format as the TypeScript CardRepository.
    pub fn serialize(&self) -> String {
        let mut lines: Vec<String> = Vec::new();

        lines.push(format!("id: {}", js(self.id.as_str())));
        lines.push(format!("type: {}", js(self.card_type.as_str())));
        if let Some(u) = &self.url       { lines.push(format!("url: {}", js(u))); }
        if let Some(p) = &self.path      { lines.push(format!("path: {}", js(p))); }
        lines.push(format!("title: {}", js(self.title.as_str())));
        if let Some(d) = &self.description { lines.push(format!("description: {}", js(d))); }
        if let Some(f) = &self.favicon    { lines.push(format!("favicon: {}", js(f))); }
        if let Some(t) = &self.thumbnail  { lines.push(format!("thumbnail: {}", js(t))); }
        if let Some(d) = &self.domain     { lines.push(format!("domain: {}", js(d))); }
        lines.push(format!("tags: [{}]", self.tags.join(", ")));
        lines.push(format!("added: {}", js(self.added.as_str())));
        lines.push(format!("status: {}", js(self.status.as_str())));
        lines.push(format!("source: {}", js(self.source.as_str())));
        if let Some(m) = &self.mime      { lines.push(format!("mime: {}", js(m))); }

        format!("---\n{}\n---\n\n## メモ\n", lines.join("\n"))
    }

    pub fn parse(raw: &str) -> Option<Self> {
        let body = raw.strip_prefix("---\n")?;
        let end = body.find("\n---")?;
        let fm = &body[..end];

        let mut map: HashMap<String, String> = HashMap::new();
        for line in fm.lines() {
            let colon = match line.find(':') {
                Some(c) => c,
                None => continue,
            };
            let key = line[..colon].trim().to_string();
            let val = line[colon + 1..].trim().to_string();
            map.insert(key, val);
        }

        let id    = map.get("id").and_then(|s| parse_str(s))?;
        let title = map.get("title").and_then(|s| parse_str(s))?;
        let card_type = map
            .get("type")
            .and_then(|s| parse_str(s))
            .unwrap_or_else(|| "web".to_string());
        let tags = map
            .get("tags")
            .map(|s| parse_array(s))
            .unwrap_or_default();

        Some(Card {
            id,
            card_type,
            url:         map.get("url").and_then(|s| parse_str(s)),
            path:        map.get("path").and_then(|s| parse_str(s)),
            title,
            description: map.get("description").and_then(|s| parse_str(s)),
            favicon:     map.get("favicon").and_then(|s| parse_str(s)),
            thumbnail:   map.get("thumbnail").and_then(|s| parse_str(s)),
            domain:      map.get("domain").and_then(|s| parse_str(s)),
            tags,
            added:  map.get("added").and_then(|s| parse_str(s)).unwrap_or_default(),
            status: map.get("status").and_then(|s| parse_str(s)).unwrap_or_else(|| "unread".to_string()),
            source: map.get("source").and_then(|s| parse_str(s)).unwrap_or_else(|| "mcp".to_string()),
            mime:   map.get("mime").and_then(|s| parse_str(s)),
        })
    }

    pub fn save(&self, vault_path: &Path) -> Result<(), String> {
        let dir = vault_path.join("LinkIndex/cards");
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::write(dir.join(format!("{}.md", self.id)), self.serialize())
            .map_err(|e| e.to_string())
    }

    pub fn load(vault_path: &Path, id: &str) -> Option<Self> {
        let path = vault_path.join(format!("LinkIndex/cards/{id}.md"));
        let raw = fs::read_to_string(path).ok()?;
        Self::parse(&raw)
    }

    pub fn delete(vault_path: &Path, id: &str) -> Result<(), String> {
        let path = vault_path.join(format!("LinkIndex/cards/{id}.md"));
        match fs::remove_file(&path) {
            Ok(_) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn list(vault_path: &Path) -> Vec<Self> {
        let dir = vault_path.join("LinkIndex/cards");
        let Ok(entries) = fs::read_dir(&dir) else {
            return vec![];
        };
        entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().is_some_and(|x| x == "md"))
            .filter_map(|e| {
                let raw = fs::read_to_string(e.path()).ok()?;
                Self::parse(&raw)
            })
            .collect()
    }
}

/// JSON-stringify a string (adds surrounding quotes).
fn js(s: &str) -> String {
    serde_json::to_string(s).unwrap()
}

/// Parse a JSON-stringified value: `"hello"` → `hello`, or bare `hello` → `hello`.
fn parse_str(s: &str) -> Option<String> {
    if s.starts_with('"') {
        serde_json::from_str::<String>(s).ok()
    } else if s.is_empty() {
        None
    } else {
        Some(s.to_string())
    }
}

/// Parse `[item1, item2]` array notation used in card frontmatter.
fn parse_array(s: &str) -> Vec<String> {
    if s.starts_with('[') && s.ends_with(']') {
        s[1..s.len() - 1]
            .split(',')
            .map(|x| x.trim().to_string())
            .filter(|x| !x.is_empty())
            .collect()
    } else {
        vec![]
    }
}
