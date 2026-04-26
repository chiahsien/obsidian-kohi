# KOHi — KOReader Highlights for Obsidian

Import highlights and notes from [KOReader](https://koreader.rocks/) into your [Obsidian](https://obsidian.md/) vault.

KOHi scans your KOReader device for `.sdr` metadata directories, parses the Lua-serialized annotations, and generates one Markdown note per book — with full control over the output format via Nunjucks templates.

## Features

- **Auto-detect all 3 KOReader storage modes** — book folder, `koreader/docsettings`, and `koreader/hashdocsettings`
- **Customizable templates** — Nunjucks-based templates with access to book metadata, highlights, and chapter grouping
- **Selective import** — import all books at once, or pick specific ones via fuzzy search
- **Clean filenames** — illegal characters are sanitized automatically
- **Overwrite on re-import** — simple, predictable behavior

## Usage

1. Connect your Kobo (or other KOReader device) via USB
2. Open Obsidian → Command Palette
3. Run **KOHi: Import all highlights** or **KOHi: Import selected highlights**
4. Notes appear in your configured output folder

## Settings

| Setting | Description | Default |
|---|---|---|
| Mount path | Path to your KOReader device | — |
| Output folder | Vault folder for generated notes | `KOReader Highlights` |
| Note template | Nunjucks template for note output | See below |

## Template

Notes are generated using [Nunjucks](https://mozilla.github.io/nunjucks/) templates. You can customize the output format in plugin settings.

### Available variables

**Book level:**

| Variable | Description |
|---|---|
| `{{title}}` | Book title |
| `{{author}}` | Author name |
| `{{language}}` | Language code |
| `{{pages}}` | Total pages |
| `{{keywords}}` | Keywords / tags |
| `{{imported}}` | Import date |

**Highlight level** (within loops):

| Variable | Description |
|---|---|
| `{{h.text}}` | Highlighted text |
| `{{h.note}}` | User note (if any) |
| `{{h.chapter}}` | Chapter name |
| `{{h.page}}` | Page number |
| `{{h.datetime}}` | Highlight timestamp |
| `{{h.percent}}` | Reading progress |

Two data structures are provided for flexibility:

- `highlights` — flat array, original reading order
- `chapters` — grouped by chapter, each with a `name` and `highlights` array

### Default template

```nunjucks
---
title: "{{title}}"
author: "{{author}}"
{% if language %}language: {{language}}{% endif %}
{% if pages %}pages: {{pages}}{% endif %}
imported: {{imported}}
---
{% for chapter in chapters %}
{% if chapter.name %}
## {{chapter.name}}
{% endif %}
{% for h in chapter.highlights %}
> {{h.text}}
{% if h.note %}

**Note:** {{h.note}}
{% endif %}

{% endfor %}
{% endfor %}
```

### Flat list (no chapter grouping)

```nunjucks
---
title: "{{title}}"
author: "{{author}}"
imported: {{imported}}
---
{% for h in highlights %}
> {{h.text}} (p.{{h.page}})
{% if h.note %}

**Note:** {{h.note}}
{% endif %}

{% endfor %}
```

## Development

See [PLAN.md](PLAN.md) for architecture and implementation details.

## License

MIT
