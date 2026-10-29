#!/usr/bin/env python3
"""
generate-context.py

Generates an XML-structured context document from the CList repository,
targeted for an ~250k token budget. Includes system directives, git history,
and robust XML escaping.

Pipes clean XML directly to stdout by default:
    ./generate-context.py > clist-context.xml
"""

import sys
import argparse
import fnmatch
import subprocess
import re
from pathlib import Path
from collections import defaultdict

# Directories to ignore
IGNORE_DIRS = {
    ".git",
    "__pycache__",
    "node_modules",
    ".vscode",
    ".idea",
    "CList Model",
    "CList_Annotation_Service_Integration_files",
    "CList_Education_and_Learning_files",
    "CList_Federated_Annotation_Service_Architecture_files",
    "Extending_CList_for_Learning_and_Development_files",
}

# Bloated files and exports
IGNORE_FILES = {
    "files.txt",
    "generate-context.py",
    # 717 KB Word export:
    "introduction.html",
    # ~500 KB Word exports:
    "CList_Annotation_Service_Integration.htm",
    "CList_Education_and_Learning.htm",
    "CList_Federated_Annotation_Service_Architecture.htm",
    "Extending_CList_for_Learning_and_Development.htm",
}

# Binary & non-code extensions (including .htm office exports)
IGNORE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
    ".pptx", ".thmx", ".zip", ".tar", ".gz",
    ".exe", ".bin", ".pyc", ".woff", ".woff2", ".ttf", ".eot",
    ".htm",  # .htm files in this repo are exclusively Word exports
}

# High-priority files to position first in the prompt context
PRIORITY_ORDER = [
    "CLAUDE.md",
    "AGENTS.md",
    "README.md",
    "pondering.md",
]


def is_binary(file_path: Path) -> bool:
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(1024)
            return b"\0" in chunk
    except Exception:
        return True


def should_include_file(file_path: Path, max_size_bytes: int, skip_css: bool, skip_extension: bool) -> bool:
    name = file_path.name
    suffix = file_path.suffix.lower()

    if name in IGNORE_FILES:
        return False
    if name.startswith("."):
        return False
    if suffix in IGNORE_EXTENSIONS:
        return False
    if skip_css and suffix == ".css":
        return False
    if any(part in IGNORE_DIRS for part in file_path.parts):
        return False
    if skip_extension and "extension" in file_path.parts:
        return False

    if max_size_bytes > 0:
        try:
            if file_path.stat().st_size > max_size_bytes:
                return False
        except OSError:
            return False

    if is_binary(file_path):
        return False

    return True


def file_sort_key(rel_path: str) -> tuple:
    """Sort order for optimal LLM priming"""
    if rel_path in PRIORITY_ORDER:
        return (0, PRIORITY_ORDER.index(rel_path), rel_path)
    if rel_path.startswith("docs/"):
        return (1, 0, rel_path)
    if rel_path in ("index.html", "runtime-config.js", "launcher.py"):
        return (2, 0, rel_path)
    if rel_path.startswith("js/"):
        return (3, 0, rel_path)
    if rel_path.startswith("extension/") or rel_path.startswith("wordpress/"):
        return (4, 0, rel_path)
    if rel_path.startswith("css/"):
        return (5, 0, rel_path)
    return (6, 0, rel_path)


def generate_tree(root_dir: Path, included_rel_paths: set) -> str:
    lines = [f"{root_dir.name}/"]

    def walk_tree(dir_path: Path, prefix: str = ""):
        items = sorted(list(dir_path.iterdir()), key=lambda p: (not p.is_dir(), p.name.lower()))
        filtered_items = []
        for item in items:
            if item.name.startswith(".") or item.name in IGNORE_DIRS:
                continue
            rel = item.relative_to(root_dir).as_posix()
            if item.is_dir():
                if any(p == rel or p.startswith(f"{rel}/") for p in included_rel_paths):
                    filtered_items.append(item)
            else:
                if rel in included_rel_paths:
                    filtered_items.append(item)

        count = len(filtered_items)
        for i, item in enumerate(filtered_items):
            is_last = i == (count - 1)
            connector = "└── " if is_last else "├── "
            child_prefix = "    " if is_last else "│   "

            if item.is_dir():
                lines.append(f"{prefix}{connector}{item.name}/")
                walk_tree(item, prefix + child_prefix)
            else:
                lines.append(f"{prefix}{connector}{item.name}")

    walk_tree(root_dir)
    return "\n".join(lines)


def get_changed_files_since(git_ref: str) -> set:
    """Returns a set of files changed since a specific git commit or 'yesterday'."""
    try:
        cmd = ["git", "diff", "--name-only", "@{yesterday}" if git_ref.lower() == "yesterday" else git_ref, "HEAD"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            return set(line.strip() for line in res.stdout.splitlines() if line.strip())
    except Exception as e:
        print(f"Warning: Failed to fetch diff for '--since {git_ref}': {e}", file=sys.stderr)
    return set()


def build_git_history_xml() -> str:
    """Fetches the recent git history to give the LLM temporal context."""
    lines = []
    try:
        fmt = "--pretty=format:---COMMIT---%n%cd | [%h] %s"
        result = subprocess.run(
            ["git", "log", "-n", "10", "--name-status", fmt, "--date=format:%Y-%m-%d %H:%M"],
            capture_output=True, text=True, check=True
        )
        if not result.stdout.strip():
            lines.append("No git history found.")
        else:
            commits = result.stdout.strip().split("---COMMIT---")
            for commit in commits:
                commit = commit.strip()
                if not commit: continue
                parts = commit.split('\n')
                lines.append(f"{parts[0]}")
                for body_line in parts[1:]:
                    body_line = body_line.strip()
                    if not body_line: continue
                    if re.match(r'^[A-Z]\s+(.+)', body_line):
                        lines.append(f"  - {body_line}")
                lines.append("")
    except Exception as e:
        lines.append(f"(Could not read git history: {e})")

    content = "\n".join(lines)
    return f"    <recent_git_history>\n{wrap_cdata(content)}\n    </recent_git_history>"


def build_system_directives_xml() -> str:
    """Injects CList-specific rules to force the LLM to write good code."""
    directives = """
    CRITICAL AI CODING REQUIREMENTS FOR CLIST:
    1. Architecture: CList is 100% client-side HTML/CSS/JS. There is NO server-side logic (except isolated services).
    2. Token Efficiency: DO NOT use decorative comment blocks (e.g. // -------). Keep comments dense and semantic.
    3. Complete Files: ALWAYS provide complete file content in your responses — NEVER use truncated snippets or diffs.
    4. Error Handling: NEVER use alert(), confirm(), or prompt(). You MUST use showServiceError(), showStatusMessage(), or showErrorModal() from ui.js.
    5. Async Handling: Every async call MUST be wrapped in a try/catch or have a .catch(). Every catch block must produce visible UI feedback.
    6. Account Parsing: ALWAYS use parseAccountValue(account) instead of bare JSON.parse(account.value) to handle corrupt entries.
    7. Styling: Use standard classes (.btn, .btn-small, .clist-action-btn). DO NOT add inline styles or invent new UI classes.
    8. Commit Message: Provide a standard git commit message at the end of your response stating the WHY and GOAL of your code changes.
    """
    return f"  <system_directives>\n{directives}  </system_directives>"


def wrap_cdata(content: str) -> str:
    """Safely escapes content for XML CDATA blocks by splitting nested ']]>' sequences."""
    safe_content = content.replace("]]>", "]]]]><![CDATA[>")
    return f"<![CDATA[\n{safe_content}\n]]>"


def main():
    parser = argparse.ArgumentParser(
        description="Generate an XML context document for LLMs (~250k token budget). Defaults to stdout."
    )
    parser.add_argument("-o", "--output", default=None, help="Optional: write directly to file instead of stdout")
    parser.add_argument("--root", default=".", help="Root directory of the project (default: current directory)")
    parser.add_argument("--since", help="Only bundle files modified since a commit SHA or 'yesterday'.")
    parser.add_argument("--max-size-kb", type=int, default=220, help="Skip files larger than this size in KB (default: 220 KB)")
    parser.add_argument("--skip-css", action="store_true", help="Exclude CSS stylesheets")
    parser.add_argument("--skip-extension", action="store_true", help="Exclude browser extension files")
    parser.add_argument("--docs-only", action="store_true", help="Only include markdown documentation")
    parser.add_argument("--core-only", action="store_true", help="Only include primary code files and docs")
    parser.add_argument("--include", nargs="+", help="Only include files matching glob patterns (e.g. 'js/*.js')")

    args = parser.parse_args()
    root_dir = Path(args.root).resolve()
    max_size_bytes = args.max_size_kb * 1024 if args.max_size_kb > 0 else 0
    output_filename = Path(args.output).name if args.output else None

    CORE_FILES = {
        "index.html", "runtime-config.js", "CLAUDE.md", "AGENTS.md", "README.md",
        "docs/architecture.md", "docs/accounts-structure.md", "docs/editors_structure.md",
        "docs/adding-a-service.md", "docs/error-handling.md"
    }

    # Handle --since filtering
    changed_files = get_changed_files_since(args.since) if args.since else None

    # 1. Discover files
    discovered_files = []
    for path in root_dir.rglob("*"):
        if not path.is_file():
            continue
        if output_filename and path.name == output_filename:
            continue
        if args.docs_only and path.suffix.lower() != ".md":
            continue

        if should_include_file(path, max_size_bytes, args.skip_css, args.skip_extension):
            rel_path = path.relative_to(root_dir).as_posix()

            # Filter by --since (always include docs/markdown even if unchanged, to give context)
            if changed_files is not None and rel_path not in changed_files and not rel_path.endswith(".md"):
                continue

            # Filter by --core-only
            if args.core_only:
                if not (rel_path in CORE_FILES or rel_path.startswith("js/")):
                    continue

            # Filter by --include (glob patterns)
            if args.include:
                if not any(fnmatch.fnmatch(rel_path, pat) for pat in args.include):
                    continue

            discovered_files.append((rel_path, path))

    # 2. Sort files according to priority
    discovered_files.sort(key=lambda item: file_sort_key(item[0]))
    included_rel_paths = {rel_path for rel_path, _ in discovered_files}

    # 3. Generate directory tree
    tree_str = generate_tree(root_dir, included_rel_paths)

    # 4. Build XML document
    xml_parts = []
    xml_parts.append('<?xml version="1.0" encoding="UTF-8"?>')
    xml_parts.append('<project_context name="CList">')

    # Inject Directives
    xml_parts.append(build_system_directives_xml())

    # Inject Project State (Tree + Git History)
    xml_parts.append('  <project_state>')
    xml_parts.append('    <directory_map>')
    xml_parts.append(wrap_cdata(tree_str))
    xml_parts.append('    </directory_map>')
    xml_parts.append(build_git_history_xml())
    xml_parts.append('  </project_state>')

    # Inject Files
    xml_parts.append('  <files>')

    total_chars = 0
    category_tokens = defaultdict(int)

    for rel_path, abs_path in discovered_files:
        try:
            content = abs_path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            print(f"[WARN] Could not read {rel_path}: {e}", file=sys.stderr)
            continue

        # Basic safeguard against dumping hardcoded RSA private keys just in case
        if "-----BEGIN PRIVATE KEY-----" in content:
            print(f"[WARN] Skipped {rel_path} due to suspicious secret pattern.", file=sys.stderr)
            continue

        chars = len(content)
        total_chars += chars
        est_file_tokens = chars // 4

        top_folder = rel_path.split("/")[0] if "/" in rel_path else "root"
        category_tokens[top_folder] += est_file_tokens

        ext = abs_path.suffix.lstrip(".").lower() or "txt"
        xml_parts.append(f'    <file path="{rel_path}" language="{ext}">')
        xml_parts.append(wrap_cdata(content))
        xml_parts.append('    </file>')

    xml_parts.append('  </files>')
    xml_parts.append('</project_context>\n')

    final_xml = "\n".join(xml_parts)
    est_total_tokens = total_chars // 4

    # 5. Diagnostic Output to stderr (keeps piped stdout clean)
    print("\n--- Context Generation Summary ---", file=sys.stderr)
    print(f"Files bundled:    {len(discovered_files)}", file=sys.stderr)
    print(f"Total characters: {total_chars:,}", file=sys.stderr)
    print(f"Est. Tokens:      ~{est_total_tokens:,} tokens", file=sys.stderr)
    if args.since:
        print(f"Filtered by:      --since {args.since}", file=sys.stderr)
    print("\nToken distribution by folder:", file=sys.stderr)
    for folder, tokens in sorted(category_tokens.items(), key=lambda x: x[1], reverse=True):
        print(f"  • {folder:12s} ~{tokens:,} tokens", file=sys.stderr)
    print("----------------------------------\n", file=sys.stderr)

    # 6. Output Handling
    if args.output:
        out_path = Path(args.output).resolve()
        out_path.write_text(final_xml, encoding="utf-8")
        print(f"Written to: {out_path}\n", file=sys.stderr)
    else:
        sys.stdout.write(final_xml)

if __name__ == "__main__":
    main()