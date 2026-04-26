export class Plugin {
	onload(): void {}
	onunload(): void {}
}
export class Notice {
	setMessage(): void {}
	hide(): void {}
}
export class TFile {}
export class TFolder {}
export function normalizePath(path: string): string {
	return path;
}
