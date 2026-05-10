use scraper::{Html, Selector};

pub struct OgpData {
    pub title: Option<String>,
    pub description: Option<String>,
    pub favicon: Option<String>,
    pub domain: Option<String>,
}

pub fn fetch(url: &str) -> OgpData {
    let domain = extract_domain(url);

    let resp = ureq::get(url)
        .set("User-Agent", "Mozilla/5.0 (compatible; link-index-mcp/0.1; +https://github.com)")
        .set("Accept", "text/html,application/xhtml+xml")
        .call();

    let response = match resp {
        Ok(r) => r,
        Err(e) => {
            eprintln!("OGP fetch error for {url}: {e}");
            return OgpData { title: None, description: None, favicon: None, domain };
        }
    };
    let body = match response.into_string() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("OGP body read error for {url}: {e}");
            return OgpData { title: None, description: None, favicon: None, domain };
        }
    };

    let doc = Html::parse_document(&body);

    OgpData {
        title:       og_meta(&doc, "og:title").or_else(|| page_title(&doc)),
        description: og_meta(&doc, "og:description")
            .or_else(|| meta_name(&doc, "description")),
        favicon:     find_favicon(&doc, url),
        domain,
    }
}

fn og_meta(doc: &Html, property: &str) -> Option<String> {
    let sel = Selector::parse(&format!(r#"meta[property="{property}"]"#)).ok()?;
    doc.select(&sel)
        .next()?
        .value()
        .attr("content")
        .map(str::to_string)
}

fn meta_name(doc: &Html, name: &str) -> Option<String> {
    let sel = Selector::parse(&format!(r#"meta[name="{name}"]"#)).ok()?;
    doc.select(&sel)
        .next()?
        .value()
        .attr("content")
        .map(str::to_string)
}

fn page_title(doc: &Html) -> Option<String> {
    let sel = Selector::parse("title").ok()?;
    let text: String = doc.select(&sel).next()?.text().collect();
    let t = text.trim().to_string();
    if t.is_empty() { None } else { Some(t) }
}

fn find_favicon(doc: &Html, base_url: &str) -> Option<String> {
    // Prefer apple-touch-icon or standard icon
    let selectors = [
        r#"link[rel="apple-touch-icon"]"#,
        r#"link[rel~="icon"]"#,
        r#"link[rel="shortcut icon"]"#,
    ];
    for s in selectors {
        if let Ok(sel) = Selector::parse(s) {
            if let Some(el) = doc.select(&sel).next() {
                if let Some(href) = el.value().attr("href") {
                    if let Some(abs) = resolve_url(href, base_url) {
                        return Some(abs);
                    }
                }
            }
        }
    }
    // Fallback: /favicon.ico
    extract_origin(base_url).map(|o| format!("{o}/favicon.ico"))
}

fn resolve_url(href: &str, base: &str) -> Option<String> {
    if href.starts_with("http://") || href.starts_with("https://") {
        return Some(href.to_string());
    }
    url::Url::parse(base)
        .ok()?
        .join(href)
        .ok()
        .map(|u| u.to_string())
}

fn extract_domain(url: &str) -> Option<String> {
    url::Url::parse(url)
        .ok()?
        .host_str()
        .map(str::to_string)
}

fn extract_origin(url: &str) -> Option<String> {
    let u = url::Url::parse(url).ok()?;
    Some(format!("{}://{}", u.scheme(), u.host_str()?))
}
