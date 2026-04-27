/** Book metadata extracted from a KOReader `.sdr` directory. */
export interface Book {
	/** Book title, from `custom_props` or `doc_props`. */
	title: string;
	/** Author name(s). */
	author: string;
	/** Language code (e.g. `"en"`, `"zh"`). */
	language?: string;
	/** Total page count. */
	pages?: number;
	/** Keywords or tags. */
	keywords?: string;
	/** Book description / summary (raw HTML from EPUB metadata). */
	description?: string;
	/** Series name. */
	series?: string;
	/** Position within the series. */
	seriesIndex?: number;
	/** Absolute path to the source `.sdr` directory. */
	filePath: string;
}

/** A single highlight annotation from a book. */
export interface Highlight {
	/** Highlighted text content. */
	text: string;
	/** User-written note attached to the highlight. */
	note?: string;
	/** Chapter name this highlight belongs to. */
	chapter?: string;
	/** Page number where the highlight appears. */
	page?: number;
	/** Timestamp when the highlight was created (ISO-ish from KOReader). */
	datetime?: string;
	/** Highlight color (e.g. `"yellow"`, `"green"`, `"red"`). */
	color?: string;
	/** Highlight style: `"lighten"`, `"underscore"`, `"strikeout"`, or `"invert"`. */
	drawer?: string;
}

/** Group of highlights under the same chapter heading. */
export interface ChapterGroup {
	/** Chapter name. Empty string for highlights without a chapter. */
	name: string;
	/** Highlights in this chapter, in reading order. */
	highlights: Highlight[];
}

/** Complete parsed data for a single book, ready for template rendering. */
export interface BookData {
	/** Book metadata. */
	book: Book;
	/** All highlights in reading order (flat list). */
	highlights: Highlight[];
	/** Highlights grouped by chapter, in first-appearance order. */
	chapters: ChapterGroup[];
}

/** User-configurable plugin settings. */
export interface PluginSettings {
	/** Absolute filesystem path to the mounted KOReader device. */
	mountPath: string;
	/** Vault folder path where generated notes are written. */
	outputFolder: string;
	/** Nunjucks template string for note rendering. */
	noteTemplate: string;
}
