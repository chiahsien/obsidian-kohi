# Obsidian KOReader Highlights — 實作計畫

## 概要

Obsidian plugin，從 KOReader（Kobo eReader）的 `.sdr` metadata 目錄讀取劃線重點與書本資訊，以書本為單位在 vault 中建立筆記。

## Plugin 結構

```
obsidian-kohi/
├── main.ts                  # 入口，註冊 commands
├── settings.ts              # Settings tab + 型別定義
├── scanner.ts               # 掃描 .sdr 目錄
├── lua-parser.ts            # Lua table literal → JS object
├── book-parser.ts           # 從解析結果萃取 Book + Annotation
├── note-generator.ts        # Nunjucks template → Markdown
├── note-writer.ts           # 檔名清理 + 寫入 vault
├── multi-select-modal.ts    # 書本選擇 UI
└── types.ts                 # 共用型別
```

## 型別定義

```typescript
interface Book {
  title: string;
  author: string;
  language?: string;
  pages?: number;
  keywords?: string;
  filePath: string;          // .sdr 的來源路徑
}

interface Highlight {
  text: string;
  note?: string;
  chapter?: string;
  page?: number;
  datetime?: string;
  percent?: number;
}

interface ChapterGroup {
  name: string;              // chapter 名稱，無 chapter 時為 ""
  highlights: Highlight[];
}

interface BookData {
  book: Book;
  highlights: Highlight[];   // flat, 原始順序
  chapters: ChapterGroup[];  // 按章節分組，組內保持順序
}

interface PluginSettings {
  mountPath: string;
  outputFolder: string;
  noteTemplate: string;      // Nunjucks template
}
```

## 模組設計

### 1. Scanner — `scanner.ts`

```
scan(mountPath) → string[]  (所有找到的 .sdr 目錄路徑)
```

**三段式掃描：**

1. `<mount>/koreader/docsettings/` — 遞迴找 `*.sdr`
2. `<mount>/koreader/hashdocsettings/` — 遞迴找 `*.sdr`
3. `<mount>/` — 遞迴找 `*.sdr`，排除黑名單目錄

**排除清單**（取自 KOReader 原始碼）：

```typescript
const EXCLUDE_DIRS = new Set([
  '.adds', '.kobo', '.kobo-images',
  'koreader',                    // 階段 1 & 2 已單獨處理
  '.fseventsd', '.Trashes', '.Spotlight-V100',  // macOS
  '.Trash', 'RECYCLED', 'RECYCLER', '$Recycle.Bin',
  'System Volume Information',   // Windows
]);
```

**去重：** 同一個 .sdr 可能在階段 1/2 和階段 3 同時被找到 → 用 absolute path 去重。

**效能：** 跳過黑名單後，掃描範圍只剩書本目錄。幾百本書 = 幾百個 .sdr，秒級完成。

### 2. Lua Parser — `lua-parser.ts`

```
parseLuaTable(source: string) → Record<string, unknown>
```

**Recursive descent parser，處理以下語法：**

| Token | 範例 |
|---|---|
| String | `"hello"`, `'world'`, `[[long string]]` |
| Number | `42`, `3.14`, `-1` |
| Boolean | `true`, `false` |
| Nil | `nil` |
| Table | `{ ["key"] = value, ... }` |
| Array index | `[1] = value` |
| 註解 | `-- line`, `--[[ block ]]` |
| 入口 | `return { ... }` |

**不處理的：** 函數呼叫、變數引用、運算式 — KOReader 的 metadata 檔不會用到這些。

預估 ~250 行 TypeScript。格式固定，不需要完整的 Lua VM。

### 3. Book Parser — `book-parser.ts`

```
parseBookData(sdrPath: string) → BookData | null
```

1. 找到 `.sdr` 內的 `metadata.*.lua`（glob `metadata.*.lua`）
2. 讀取檔案內容 → 餵入 Lua Parser
3. 從解析結果萃取：
   - `doc_props` / `custom_props` → `Book`（custom 優先覆蓋 doc）
   - `annotations` array → `Highlight[]`（保持原始順序）
   - 按 `chapter` 欄位分組 → `ChapterGroup[]`

**分組邏輯：**

- 有 `chapter` → 歸到對應的 `ChapterGroup`
- 無 `chapter` → 歸到 `name: ""` 的群組
- 群組順序 = 第一個 highlight 出現的順序（保持閱讀順序）

### 4. Note Generator — `note-generator.ts`

```
renderNote(bookData: BookData, template: string, importDate: string) → string
```

**Nunjucks 環境設定：**

- `autoescape: false`（產出 Markdown，不是 HTML）
- 自訂 filter: `date`（格式化 datetime）、`percent`（格式化百分比）

**提供給 template 的變數：**

```typescript
{
  // Book level
  title, author, language, pages, keywords, imported,
  
  // Two ways to access highlights
  highlights,   // Highlight[] — flat, ordered
  chapters,     // ChapterGroup[] — grouped
}
```

**預設 template：**

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

### 5. Note Writer — `note-writer.ts`

```
writeNote(app: App, outputFolder: string, book: Book, content: string) → void
```

**檔名清理：**

```typescript
function sanitizeFilename(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, '-')   // 非法字元 → -
    .replace(/\s+/g, ' ')             // 連續空白 → 單空白
    .replace(/^\.+/, '')              // 開頭的 .
    .replace(/\.+$/, '')              // 結尾的 .
    .trim()
    .slice(0, 200);                   // 長度限制
}
```

**寫入：** `vault.create()` / `vault.modify()`（檔案已存在時覆寫）。

### 6. Multi-Select Modal — `multi-select-modal.ts`

```
openBookSelectModal(app: App, books: BookData[]) → Promise<BookData[]>
```

**UI 結構：**

- 頂部：fuzzy search 輸入框（`prepareFuzzySearch`）
- 中間：已選書本列表 + × 移除按鈕
- 搜尋結果：顯示 `title — author`
- 底部：`[Select All]` `[Cancel]` `[Import]`

基於 Templater 的 `MultiSuggesterModal` 模式，已驗證可處理 100+ 項目。

### 7. Settings — `settings.ts`

| 設定項 | 型別 | 預設值 | UI |
|---|---|---|---|
| Mount path | string | `""` | Text input |
| Output folder | string | `"KOReader Highlights"` | Text input |
| Note template | string | 預設 template | Textarea（大區塊編輯）+ `[Reset to default]` 按鈕 |

### 8. Commands

| Command | 行為 |
|---|---|
| `Import all highlights` | 掃描 → 解析全部 → 產生全部 notes → Notice |
| `Import selected highlights` | 掃描 → 顯示 modal → 使用者勾選 → 產生 notes → Notice |

## 錯誤處理

```
成功：Notice "Imported 12 books successfully"
部分失敗：Notice "Imported 10 books. 2 failed: [Book A] (parse error), [Book B] (write error)"
全部失敗：Notice "Import failed: ..." + 具體錯誤
```

不產生 error log 檔案 — Notice 已足夠，保持簡潔。

## KOReader 資料格式參考

### .sdr 目錄結構

KOReader 為每本書建立 `<book-filename>.sdr` 目錄，內含 Lua serialized tables：

- `metadata.<ext>.lua` — 核心資料（annotations, doc_props）
- `custom_metadata.lua` — 使用者手動修改的 metadata

### .sdr 儲存模式（三種）

1. **book folder**（預設）：`.sdr` 建立在書本檔案旁邊
2. **koreader/docsettings**：所有 `.sdr` 集中在 `koreader/docsettings/` 下
3. **koreader/hashdocsettings**：`.sdr` 以 MD5 hash 命名，集中在 `koreader/hashdocsettings/` 下

### Annotation 資料結構

```lua
annotations = {
    [1] = {
        ["text"]     = "highlighted text",
        ["notes"]    = "user note",
        ["chapter"]  = "Chapter 1",
        ["page"]     = 10,
        ["datetime"] = "2020-02-05 20:18:27",
        ["drawer"]   = "lighten",
        ["percent"]  = 0.074,
        ["pos0"]     = "XPointer...",
        ["pos1"]     = "XPointer...",
    },
}
```

### Book Metadata 結構

```lua
doc_props = {
    ["title"]    = "Alice's Adventures in Wonderland",
    ["authors"]  = "Lewis Carroll",
    ["language"] = "en",
    ["pages"]    = 107,
    ["keywords"] = "Fantasy fiction\nChildren's stories",
}

-- 使用者手動修改的值（優先於 doc_props）
custom_props = {
    ["title"]    = "custom title",
    ["authors"]  = "custom author",
    ...
}
```

## 技術決策

| 決策 | 選擇 | 理由 |
|---|---|---|
| Lua 解析 | 自製 recursive descent parser | KOReader 的 Lua table 格式單純，不需要完整 Lua VM。~250 行 TS |
| Template engine | Nunjucks | 輕量（~8KB）、支援 for/if、obsidian-kindle-plugin 已驗證 |
| 檔名處理 | 替換非法字元 → `-` | 跨平台安全 |
| Chapter 分組 | 提供 `chapters` + `highlights` 兩組資料 | 分組與否由 template 決定，plugin 不硬編碼 |
| .sdr 偵測 | 三段式掃描 + 黑名單排除 | 三種儲存模式通吃，自動偵測 |
| 重複匯入 | 全部覆寫 | 最簡單，不需要 diff 邏輯 |
| Multi-select UI | Fuzzy search + selected list | Templater 驗證過的模式，可處理 100+ 項目 |

## 實作順序

| Phase | 內容 | 依賴 |
|---|---|---|
| **P1** | `types.ts` + `lua-parser.ts` + 測試 | 無 — 核心難點，先搞定 |
| **P2** | `scanner.ts` + `book-parser.ts` | P1 |
| **P3** | `note-generator.ts`（Nunjucks）+ `note-writer.ts` | P2 |
| **P4** | `settings.ts` + `main.ts` + `Import all` command | P3 |
| **P5** | `multi-select-modal.ts` + `Import selected` command | P4 |
| **P6** | Edge cases、錯誤處理、template 微調 | P5 |

**P1–P4 = 最小可用版本（MVP）。P5–P6 = 完整版。**
