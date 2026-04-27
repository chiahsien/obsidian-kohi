import * as nunjucks from "nunjucks";
import type { BookData } from "./types";

const env = new nunjucks.Environment(null, { autoescape: false });

/** Default Nunjucks template: frontmatter + chapter-grouped blockquote highlights. */
export const DEFAULT_TEMPLATE = `---
title: "{{ title }}"
author: "{{ author }}"
{%- if language %}
language: {{ language }}
{%- endif %}
{%- if series %}
series: "{{ series }}"
{%- endif %}
{%- if seriesIndex != null %}
series_index: {{ seriesIndex }}
{%- endif %}
{%- if pages != null %}
pages: {{ pages }}
{%- endif %}
imported: {{ imported }}
---
{% if description %}
{{ description }}

---

{% endif -%}
{% for chapter in chapters %}
{%- if chapter.name %}

## {{ chapter.name }}

{% endif -%}
{% for h in chapter.highlights %}
> {{ h.text }}
{%- if h.page %}
>
> — p.{{ h.page }}
{%- endif %}
{% if h.note %}
> [!note]
> {{ h.note }}
{% endif %}
{% endfor %}
{%- endfor %}
`;

/** Alternative Nunjucks template: frontmatter + flat highlight list without chapter grouping. */
export const FLAT_TEMPLATE = `---
title: "{{ title }}"
author: "{{ author }}"
{%- if language %}
language: {{ language }}
{%- endif %}
{%- if series %}
series: "{{ series }}"
{%- endif %}
{%- if seriesIndex != null %}
series_index: {{ seriesIndex }}
{%- endif %}
{%- if pages != null %}
pages: {{ pages }}
{%- endif %}
imported: {{ imported }}
---
{% if description %}
{{ description }}

---

{% endif -%}
{% for h in highlights %}
> {{ h.text }}
{%- if h.page %}
>
> — p.{{ h.page }}
{%- endif %}
{% if h.note %}
> [!note]
> {{ h.note }}
{% endif %}
{% endfor %}
`;

/**
 * Render a book's highlights into a Markdown note using a Nunjucks template.
 *
 * Template variables: `title`, `author`, `language`, `pages`, `keywords`,
 * `description`, `series`, `seriesIndex`, `imported`, `highlights` (flat),
 * `chapters` (grouped).
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
		description: data.book.description,
		series: data.book.series,
		seriesIndex: data.book.seriesIndex,
		imported: importDate,
		highlights: data.highlights,
		chapters: data.chapters,
	});
	return raw.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
