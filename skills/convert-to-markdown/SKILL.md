---
name: convert-to-markdown
description: Use when the user references a local PDF, Office document, spreadsheet, presentation, HTML file, CSV/data file, or ovd-workflow knowledge-vault document and the agent should convert it to clean Markdown before reading to reduce tokens and preserve structure. Uses Microsoft's MarkItDown when available; falls back gracefully when Python/MarkItDown is unavailable.
---

# Convert To Markdown

Use this skill before reading local documents that are likely to be expensive or awkward in their native format: PDF, DOCX, PPTX, XLSX, HTML, CSV/TSV, JSON, XML, or similar reference files.

The goal is simple: create a clean Markdown version first, then read the Markdown instead of dumping raw binary/native document content into context.

## When To Use

- The user points to a local PDF, Word document, PowerPoint, spreadsheet, HTML export, CSV, or data file.
- ovd-workflow knowledge vault is ingesting non-Markdown references from `.overdrive/knowledge/`.
- The task is summarization, extraction, comparison, source review, requirements analysis, or context preparation.
- A model/native file upload would consume unnecessary tokens or obscure tables/headings.

Do not use this skill for tiny plain-text files, source code, images that need visual inspection, or files where exact layout fidelity matters more than text/structure.

## Preferred Tool

Use Microsoft MarkItDown when available:

```bash
markitdown "/path/to/source.pdf" -o "/path/to/source.md"
```

If MarkItDown is missing and the user wants setup help:

```bash
python3 -m pip install 'markitdown[all]'
```

Use a project virtual environment when possible. The base package is lighter, but `[all]` is the practical install for PDF/Office/spreadsheet coverage.

## Workflow

1. Identify the source file and pick a safe output path beside it or under a local cache folder.
2. Check whether `markitdown` exists:

```bash
command -v markitdown
```

3. Convert with `markitdown input -o output`.
4. Read the Markdown output, not the raw original, unless conversion failed or layout/visual fidelity is the point.
5. Report conversion caveats briefly: missing tables, OCR limits, unsupported format, or skipped images.
6. Never overwrite an original file. If an output path exists, use a cache path or ask before replacing it.

## ovd-workflow Knowledge Vault

For `.overdrive/knowledge/`, prefer the runtime command:

```bash
overdrive knowledge --apply
```

This refreshes `.overdrive/knowledge-index.json`, converts supported non-Markdown files to cached Markdown where possible, and leaves summaries/topics for the agent to fill in later.

When using the vault during a task, inspect `knowledge-index.json` first, then load only the relevant original file or `markdownCache`. Do not dump the full vault into context.

## Fallbacks

- If MarkItDown is unavailable, ask whether to install it or read the file natively.
- For simple `.txt`, `.csv`, `.json`, `.html`, `.xml`, or log files, a plain fenced Markdown cache is acceptable.
- For web pages, use `defuddle` or normal browser/web-fetch workflows instead of forcing MarkItDown.
- If a PDF is scanned/image-only, note that OCR may be needed and do not pretend conversion captured all content.

## Honesty Boundary

Overdrive cannot intercept every native file ingestion path inside Claude, Codex, Cursor, Gemini, or Antigravity. This skill is instruction-led: convert local files before reading when possible. ovd-workflow also uses the same idea during knowledge-vault ingest.

## Security

MarkItDown runs with the permissions of the current process. Convert only files the user provided or that are already in the project/workspace, avoid untrusted remote URLs, and never expose secrets found in converted documents.

## Attribution

Built around Microsoft's MarkItDown project: https://github.com/microsoft/markitdown

