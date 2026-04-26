/** Error thrown when Lua source cannot be parsed. */
export class LuaParseError extends Error {
	/** Character offset where the parse error occurred. */
	readonly position: number;

	constructor(message: string, position: number) {
		super(`${message} (at position ${position})`);
		this.name = "LuaParseError";
		this.position = position;
	}
}

/**
 * Parse a KOReader Lua metadata file into a JavaScript object.
 *
 * Handles the `return { ... }` wrapper, string/number/boolean/nil literals,
 * nested tables, comments, BOM, and long bracket strings (`[==[...]==]`).
 * Tables with consecutive integer keys starting at 1 are auto-converted
 * to arrays.
 *
 * @throws {LuaParseError} If the source is not valid KOReader Lua metadata.
 */
export function parseLuaTable(source: string): Record<string, unknown> {
	let pos = 0;

	if (source.charCodeAt(0) === 0xfeff) pos = 1;

	function error(msg: string): never {
		throw new LuaParseError(msg, pos);
	}

	function isDigit(c: string): boolean {
		return c >= "0" && c <= "9";
	}

	function isAlpha(c: string): boolean {
		return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
	}

	function isAlphaNum(c: string): boolean {
		return isAlpha(c) || isDigit(c);
	}

	function isHexDigit(c: string): boolean {
		return isDigit(c) || (c >= "a" && c <= "f") || (c >= "A" && c <= "F");
	}

	// Detect Lua long bracket level: `[===[` → 3, `[[` → 0, not a bracket → -1
	function longBracketLevel(): number {
		if (source[pos] !== "[") return -1;
		let i = pos + 1;
		let level = 0;
		while (i < source.length && source[i] === "=") {
			level++;
			i++;
		}
		return source[i] === "[" ? level : -1;
	}

	function readLongString(level: number): string {
		pos += 2 + level;
		if (source[pos] === "\n") pos++;
		else if (source[pos] === "\r") {
			pos++;
			if (source[pos] === "\n") pos++;
		}
		const close = "]" + "=".repeat(level) + "]";
		const end = source.indexOf(close, pos);
		if (end === -1) error("Unterminated long string");
		const str = source.slice(pos, end);
		pos = end + close.length;
		return str;
	}

	function skipWhitespace(): void {
		while (pos < source.length) {
			const c = source[pos]!;
			if (c === " " || c === "\t" || c === "\n" || c === "\r") {
				pos++;
				continue;
			}
			if (c === "-" && source[pos + 1] === "-") {
				pos += 2;
				if (source[pos] === "[") {
					const level = longBracketLevel();
					if (level >= 0) {
						readLongString(level);
						continue;
					}
				}
				while (pos < source.length && source[pos] !== "\n") pos++;
				continue;
			}
			break;
		}
	}

	function expect(ch: string): void {
		skipWhitespace();
		if (source[pos] !== ch)
			error(`Expected '${ch}', got '${source[pos] ?? "EOF"}'`);
		pos++;
	}

	function parseString(): string {
		const quote = source[pos]!;
		if (quote === "[") {
			const level = longBracketLevel();
			if (level >= 0) return readLongString(level);
			error("Invalid long string");
		}

		pos++;
		let result = "";
		while (pos < source.length) {
			const c = source[pos]!;
			if (c === quote) {
				pos++;
				return result;
			}
			if (c === "\\") {
				pos++;
				if (pos >= source.length) error("Unterminated string escape");
				const esc = source[pos]!;
				pos++;
				switch (esc) {
					case "n":
						result += "\n";
						break;
					case "t":
						result += "\t";
						break;
					case "r":
						result += "\r";
						break;
					case "\\":
						result += "\\";
						break;
					case '"':
						result += '"';
						break;
					case "'":
						result += "'";
						break;
					case "a":
						result += "\x07";
						break;
					case "b":
						result += "\b";
						break;
					case "f":
						result += "\f";
						break;
					case "v":
						result += "\v";
						break;
					case "\n":
						result += "\n";
						break;
					case "\r":
						if (source[pos] === "\n") pos++;
						result += "\n";
						break;
					default:
						if (isDigit(esc)) {
							let numStr = esc;
							for (
								let i = 0;
								i < 2 &&
								pos < source.length &&
								isDigit(source[pos]!);
								i++
							) {
								numStr += source[pos];
								pos++;
							}
							result += String.fromCharCode(Number(numStr));
						} else {
							result += esc;
						}
				}
			} else {
				result += c;
				pos++;
			}
		}
		error("Unterminated string");
	}

	function parseNumber(): number {
		const start = pos;
		if (source[pos] === "-") pos++;
		if (
			source[pos] === "0" &&
			(source[pos + 1] === "x" || source[pos + 1] === "X")
		) {
			pos += 2;
			while (pos < source.length && isHexDigit(source[pos]!)) pos++;
		} else {
			while (pos < source.length && isDigit(source[pos]!)) pos++;
			if (source[pos] === ".") {
				pos++;
				while (pos < source.length && isDigit(source[pos]!)) pos++;
			}
			if (source[pos] === "e" || source[pos] === "E") {
				pos++;
				if (source[pos] === "+" || source[pos] === "-") pos++;
				while (pos < source.length && isDigit(source[pos]!)) pos++;
			}
		}
		const num = Number(source.slice(start, pos));
		if (isNaN(num)) error("Invalid number");
		return num;
	}

	function parseValue(): unknown {
		skipWhitespace();
		if (pos >= source.length) error("Unexpected end of input");
		const c = source[pos]!;

		if (c === '"' || c === "'") return parseString();
		if (c === "[" && longBracketLevel() >= 0) return parseString();
		if (c === "{") return parseTable();
		if (
			c === "-" &&
			pos + 1 < source.length &&
			(isDigit(source[pos + 1]!) || source[pos + 1] === ".")
		)
			return parseNumber();
		if (isDigit(c)) return parseNumber();

		if (isAlpha(c)) {
			const start = pos;
			while (pos < source.length && isAlphaNum(source[pos]!)) pos++;
			const word = source.slice(start, pos);
			if (word === "true") return true;
			if (word === "false") return false;
			if (word === "nil") return null;
			error(`Unexpected identifier '${word}'`);
		}

		error(`Unexpected character '${c}'`);
	}

	// If all keys are consecutive integers 1..N, return as JS array; otherwise as object
	function parseTable(): Record<string, unknown> | unknown[] {
		pos++;
		const entries: { key: string; value: unknown }[] = [];
		let implicitIndex = 1;

		while (true) {
			skipWhitespace();
			if (pos >= source.length) error("Unterminated table");
			if (source[pos] === "}") {
				pos++;
				break;
			}

			let key: string | undefined;

			if (source[pos] === "[" && longBracketLevel() < 0) {
				pos++;
				skipWhitespace();
				const k = parseValue();
				skipWhitespace();
				expect("]");
				skipWhitespace();
				expect("=");
				key = String(k);
			} else if (isAlpha(source[pos]!)) {
				const saved = pos;
				const start = pos;
				while (pos < source.length && isAlphaNum(source[pos]!)) pos++;
				const word = source.slice(start, pos);
				skipWhitespace();
				if (source[pos] === "=") {
					pos++;
					key = word;
				} else {
					pos = saved;
				}
			}

			if (key !== undefined) {
				entries.push({ key, value: parseValue() });
			} else {
				entries.push({
					key: String(implicitIndex++),
					value: parseValue(),
				});
			}

			skipWhitespace();
			if (source[pos] === "," || source[pos] === ";") pos++;
		}

		if (
			entries.length > 0 &&
			entries.every((e, i) => e.key === String(i + 1))
		) {
			return entries.map((e) => e.value);
		}

		const obj: Record<string, unknown> = {};
		for (const { key, value } of entries) obj[key] = value;
		return obj;
	}

	skipWhitespace();
	if (
		pos + 6 <= source.length &&
		source.slice(pos, pos + 6) === "return" &&
		(pos + 6 >= source.length || !isAlphaNum(source[pos + 6]!))
	) {
		pos += 6;
	}
	skipWhitespace();

	if (source[pos] !== "{")
		error(`Expected '{', got '${source[pos] ?? "EOF"}'`);

	const result = parseTable();
	if (Array.isArray(result)) error("Top-level value must be a table");
	return result;
}
