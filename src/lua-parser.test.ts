import { describe, it, expect } from "vitest";
import { parseLuaTable, LuaParseError } from "./lua-parser";

describe("parseLuaTable", () => {
	describe("strings", () => {
		it("double-quoted", () => {
			const r = parseLuaTable('return { ["k"] = "hello world" }');
			expect(r["k"]).toBe("hello world");
		});

		it("single-quoted", () => {
			const r = parseLuaTable("return { ['k'] = 'hello world' }");
			expect(r["k"]).toBe("hello world");
		});

		it("escape sequences", () => {
			const r = parseLuaTable(
				'return { ["a"] = "line1\\nline2", ["b"] = "tab\\there", ["c"] = "q\\"uote" }',
			);
			expect(r["a"]).toBe("line1\nline2");
			expect(r["b"]).toBe("tab\there");
			expect(r["c"]).toBe('q"uote');
		});

		it("numeric escape \\ddd", () => {
			const r = parseLuaTable('return { ["k"] = "\\065" }');
			expect(r["k"]).toBe("A");
		});

		it("long string [[...]]", () => {
			const r = parseLuaTable("return { [\"k\"] = [[hello world]] }");
			expect(r["k"]).toBe("hello world");
		});

		it("long string with level [=[...]=]", () => {
			const r = parseLuaTable(
				"return { [\"k\"] = [=[contains ]] brackets]=] }",
			);
			expect(r["k"]).toBe("contains ]] brackets");
		});

		it("long string strips leading newline", () => {
			const r = parseLuaTable("return { [\"k\"] = [[\nhello]] }");
			expect(r["k"]).toBe("hello");
		});

		it("empty string", () => {
			const r = parseLuaTable('return { ["k"] = "" }');
			expect(r["k"]).toBe("");
		});
	});

	describe("numbers", () => {
		it("integer", () => {
			const r = parseLuaTable('return { ["k"] = 42 }');
			expect(r["k"]).toBe(42);
		});

		it("float", () => {
			const r = parseLuaTable('return { ["k"] = 3.14 }');
			expect(r["k"]).toBe(3.14);
		});

		it("negative", () => {
			const r = parseLuaTable(
				'return { ["a"] = -1, ["b"] = -3.14 }',
			);
			expect(r["a"]).toBe(-1);
			expect(r["b"]).toBe(-3.14);
		});

		it("hex", () => {
			const r = parseLuaTable('return { ["k"] = 0xFF }');
			expect(r["k"]).toBe(255);
		});

		it("scientific notation", () => {
			const r = parseLuaTable(
				'return { ["a"] = 1e10, ["b"] = 1.5e-3 }',
			);
			expect(r["a"]).toBe(1e10);
			expect(r["b"]).toBe(1.5e-3);
		});

		it("zero", () => {
			const r = parseLuaTable('return { ["k"] = 0 }');
			expect(r["k"]).toBe(0);
		});
	});

	describe("booleans and nil", () => {
		it("true", () => {
			const r = parseLuaTable('return { ["k"] = true }');
			expect(r["k"]).toBe(true);
		});

		it("false", () => {
			const r = parseLuaTable('return { ["k"] = false }');
			expect(r["k"]).toBe(false);
		});

		it("nil → null", () => {
			const r = parseLuaTable('return { ["k"] = nil }');
			expect(r["k"]).toBeNull();
		});
	});

	describe("tables", () => {
		it("empty table", () => {
			expect(parseLuaTable("return {}")).toEqual({});
		});

		it("string-keyed", () => {
			const r = parseLuaTable(
				'return { ["name"] = "Alice", ["age"] = 30 }',
			);
			expect(r).toEqual({ name: "Alice", age: 30 });
		});

		it("sequential numeric keys → array", () => {
			const r = parseLuaTable(
				'return { ["items"] = { [1] = "a", [2] = "b", [3] = "c" } }',
			);
			expect(r["items"]).toEqual(["a", "b", "c"]);
		});

		it("non-sequential numeric keys → object", () => {
			const r = parseLuaTable(
				'return { ["t"] = { [1] = "a", [3] = "c" } }',
			);
			expect(r["t"]).toEqual({ "1": "a", "3": "c" });
		});

		it("nested", () => {
			const r = parseLuaTable(
				'return { ["a"] = { ["b"] = { ["c"] = 1 } } }',
			);
			expect(r).toEqual({ a: { b: { c: 1 } } });
		});

		it("trailing comma", () => {
			const r = parseLuaTable('return { ["a"] = 1, ["b"] = 2, }');
			expect(r).toEqual({ a: 1, b: 2 });
		});

		it("semicolon separator", () => {
			const r = parseLuaTable('return { ["a"] = 1; ["b"] = 2 }');
			expect(r).toEqual({ a: 1, b: 2 });
		});

		it("bare identifier keys", () => {
			const r = parseLuaTable('return { name = "Alice", age = 30 }');
			expect(r).toEqual({ name: "Alice", age: 30 });
		});

		it("implicit array entries", () => {
			const r = parseLuaTable(
				'return { ["items"] = { "a", "b", "c" } }',
			);
			expect(r["items"]).toEqual(["a", "b", "c"]);
		});
	});

	describe("comments", () => {
		it("line comment", () => {
			const r = parseLuaTable(
				'return {\n-- comment\n["key"] = "value"\n}',
			);
			expect(r["key"]).toBe("value");
		});

		it("block comment", () => {
			const r = parseLuaTable(
				'return { --[[ block ]] ["key"] = "value" }',
			);
			expect(r["key"]).toBe("value");
		});

		it("comment before return", () => {
			const r = parseLuaTable('-- header\nreturn { ["key"] = 1 }');
			expect(r["key"]).toBe(1);
		});

		it("block comment with level", () => {
			const r = parseLuaTable(
				'return { --[=[ contains ]] ]=] ["key"] = 1 }',
			);
			expect(r["key"]).toBe(1);
		});
	});

	describe("KOReader metadata", () => {
		it("full metadata with annotations and doc_props", () => {
			const source = `return {
    ["annotations"] = {
        [1] = {
            ["chapter"] = "1 Down the Rabbit-Hole",
            ["datetime"] = "2024-01-15 10:30:00",
            ["drawer"] = "lighten",
            ["notes"] = "",
            ["page"] = 5,
            ["percent"] = 0.0467,
            ["pos0"] = "/body/DocFragment[2]/body/div/p[3]/text().0",
            ["pos1"] = "/body/DocFragment[2]/body/div/p[3]/text().50",
            ["text"] = "Alice was beginning to get very tired",
        },
        [2] = {
            ["chapter"] = "2 The Pool of Tears",
            ["datetime"] = "2024-01-15 11:00:00",
            ["drawer"] = "lighten",
            ["page"] = 20,
            ["percent"] = 0.187,
            ["pos0"] = "/body/DocFragment[3]/body/div/p[5]/text().0",
            ["pos1"] = "/body/DocFragment[3]/body/div/p[5]/text().40",
            ["text"] = "Curiouser and curiouser!",
        },
    },
    ["doc_props"] = {
        ["authors"] = "Lewis Carroll",
        ["description"] = "",
        ["keywords"] = "Fantasy fiction\\nChildren's stories",
        ["language"] = "en",
        ["pages"] = 107,
        ["title"] = "Alice's Adventures in Wonderland",
    },
    ["custom_props"] = {
        ["title"] = "Alice in Wonderland",
    },
}`;
			const r = parseLuaTable(source);

			const annotations = r["annotations"] as unknown[];
			expect(Array.isArray(annotations)).toBe(true);
			expect(annotations).toHaveLength(2);

			const first = annotations[0] as Record<string, unknown>;
			expect(first["text"]).toBe(
				"Alice was beginning to get very tired",
			);
			expect(first["chapter"]).toBe("1 Down the Rabbit-Hole");
			expect(first["page"]).toBe(5);
			expect(first["percent"]).toBe(0.0467);
			expect(first["notes"]).toBe("");

			const second = annotations[1] as Record<string, unknown>;
			expect(second["text"]).toBe("Curiouser and curiouser!");
			expect(second["chapter"]).toBe("2 The Pool of Tears");

			const docProps = r["doc_props"] as Record<string, unknown>;
			expect(docProps["title"]).toBe(
				"Alice's Adventures in Wonderland",
			);
			expect(docProps["authors"]).toBe("Lewis Carroll");
			expect(docProps["pages"]).toBe(107);
			expect(docProps["language"]).toBe("en");
			expect(docProps["keywords"]).toBe(
				"Fantasy fiction\nChildren's stories",
			);

			const customProps = r["custom_props"] as Record<string, unknown>;
			expect(customProps["title"]).toBe("Alice in Wonderland");
		});

		it("empty annotations", () => {
			const source = `return {
    ["doc_props"] = {
        ["title"] = "Empty Book",
        ["authors"] = "Nobody",
    },
    ["annotations"] = {},
}`;
			const r = parseLuaTable(source);
			expect(r["annotations"]).toEqual({});

			const docProps = r["doc_props"] as Record<string, unknown>;
			expect(docProps["title"]).toBe("Empty Book");
		});
	});

	describe("edge cases", () => {
		it("BOM", () => {
			const r = parseLuaTable('\uFEFFreturn { ["k"] = 1 }');
			expect(r["k"]).toBe(1);
		});

		it("no return keyword", () => {
			const r = parseLuaTable('{ ["k"] = 1 }');
			expect(r["k"]).toBe(1);
		});

		it("generous whitespace", () => {
			const r = parseLuaTable(
				'  \n\n  return  \n  {  \n  ["k"]  \n  =  \n  1  \n  }  \n  ',
			);
			expect(r["k"]).toBe(1);
		});

		it("mixed value types in one table", () => {
			const r = parseLuaTable(
				'return { ["s"] = "text", ["n"] = 42, ["b"] = true, ["x"] = nil }',
			);
			expect(r["s"]).toBe("text");
			expect(r["n"]).toBe(42);
			expect(r["b"]).toBe(true);
			expect(r["x"]).toBeNull();
		});
	});

	describe("errors", () => {
		it("invalid input", () => {
			expect(() => parseLuaTable("invalid")).toThrow(LuaParseError);
		});

		it("unterminated string", () => {
			expect(() =>
				parseLuaTable('return { ["k"] = "unterminated }'),
			).toThrow(LuaParseError);
		});

		it("unterminated table", () => {
			expect(() => parseLuaTable('return { ["k"] = 1')).toThrow(
				LuaParseError,
			);
		});

		it("error includes position", () => {
			try {
				parseLuaTable("return { ??? }");
				expect.fail("Should have thrown");
			} catch (e) {
				expect(e).toBeInstanceOf(LuaParseError);
				expect((e as LuaParseError).position).toBeGreaterThan(0);
			}
		});
	});
});
