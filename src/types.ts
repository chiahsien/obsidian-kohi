export interface Book {
	title: string;
	author: string;
	language?: string;
	pages?: number;
	keywords?: string;
	filePath: string;
}

export interface Highlight {
	text: string;
	note?: string;
	chapter?: string;
	page?: number;
	datetime?: string;
	percent?: number;
}

export interface ChapterGroup {
	name: string;
	highlights: Highlight[];
}

export interface BookData {
	book: Book;
	highlights: Highlight[];
	chapters: ChapterGroup[];
}

export interface PluginSettings {
	mountPath: string;
	outputFolder: string;
	noteTemplate: string;
}
