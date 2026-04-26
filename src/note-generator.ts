import * as nunjucks from "nunjucks";
import type { BookData } from "./types";

const env = new nunjucks.Environment(null, { autoescape: false });

env.addFilter("percent", (val: unknown): string => {
	if (val === null || val === undefined) return "";
	return (Number(val) * 100).toFixed(1) + "%";
});

/** Default Nunjucks template: frontmatter + chapter-grouped blockquote highlights. */
export const DEFAULT_TEMPLATE = `---
title: "{{ title }}"
author: "{{ author }}"
{%- if language %}
language: {{ language }}
{%- endif %}
{%- if pages %}
pages: {{ pages }}
{%- endif %}
imported: {{ imported }}
---
{% for chapter in chapters %}
{%- if chapter.name %}

## {{ chapter.name }}

{% endif -%}
{% for h in chapter.highlights %}
> {{ h.text }}
{% if h.note %}
**Note:** {{ h.note }}
{% endif %}
{% endfor %}
{%- endfor %}
`;

/**
 * Render a book's highlights into a Markdown note using a Nunjucks template.
 *
 * Template variables: `title`, `author`, `language`, `pages`, `keywords`,
 * `imported`, `highlights` (flat), `chapters` (grouped).
 * Custom filter: `percent` — converts decimal to `"7.4%"` format.
 *
 * Post-processing collapses 3+ consecutive newlines and trims.
 */
export function renderNote(
	data: BookData,
	template: string,
	importDate: string,
): string {
	const raw = env.renderString(template, {
		title: data.book.title,
		author: data.book.author,
		language: data.book.language,
		pages: data.book.pages,
		keywords: data.book.keywords,
		imported: importDate,
		highlights: data.highlights,
		chapters: data.chapters,
	});
	return raw.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
