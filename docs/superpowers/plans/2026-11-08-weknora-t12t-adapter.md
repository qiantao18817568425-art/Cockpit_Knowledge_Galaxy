# WeKnora T12T Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a small adapter that turns the user's local 21-skill T12T family into one WeKnora ZIP without publishing the original skills.

**Architecture:** A Python standard-library CLI validates the local source tree, preserves all original Markdown bytes under `references/skills/`, adds one WeKnora root `SKILL.md` and a hash manifest, then writes a deterministic ZIP. GitHub holds only the builder, tests, instructions and design/plan; the generated ZIP stays local.

**Tech Stack:** Python 3 standard library (`pathlib`, `zipfile`, `hashlib`, `argparse`, `unittest`).

**Spec:** `docs/superpowers/specs/2026-11-08-weknora-t12t-adapter-design.md`

## Global Constraints

- Public repository: `qiantao18817568425-art/Cockpit_Knowledge_Galaxy`.
- No original T12T skill text, reference text, raw logs or generated ZIP in GitHub commits.
- Source is an explicit local directory; do not mix the F-drive family with backup copies.
- Exactly the named 21 skill entrypoints must be present; all packaged local Markdown links must resolve.
- Root ZIP entry is `SKILL.md`; original family lives under `references/skills/<skill-name>/`.
- Same input bytes produce the same ZIP bytes. Missing or unsafe inputs fail before output is written.

## Review Focus

- An extra skill directory: ignore it, so the package remains scoped to the named 21.
- A source file or directory that is a symlink: fail without following it.
- A Markdown link that escapes the source tree: fail.
- A ZIP target that already exists: replace atomically only after a complete build.
- A builder run from an unrelated current directory: use only explicit absolute or resolved CLI paths.

---

### Task 1: Validate and collect the local family

**Files:**
- Create: `weknora/t12t-adapter/build_bundle.py`
- Create: `weknora/t12t-adapter/tests/test_build_bundle.py`

**Interfaces:**
- `SKILL_NAMES: tuple[str, ...]` is the exact ordered list of 21 names.
- `collect_source(source: Path) -> dict[str, bytes]` returns source-root-relative POSIX paths and original bytes, or raises `ValueError`.

- [ ] Write `test_collects_exact_family` with 21 synthetic entrypoints, references, and an unrelated extra directory.
- [ ] Run `python -m unittest discover -s weknora/t12t-adapter/tests -v`; confirm expected failure because the function is absent.
- [ ] Implement `SKILL_NAMES` and `collect_source` in `build_bundle.py`.
- [ ] Run the focused test and confirm pass.
- [ ] Add tests for missing entrypoint, missing relative reference, escaping relative reference, and symlink input; confirm each fails before the corresponding validation.
- [ ] Implement only the validation needed by those tests; run the suite and confirm pass.

### Task 2: Create the one-skill ZIP

**Files:**
- Modify: `weknora/t12t-adapter/build_bundle.py`
- Modify: `weknora/t12t-adapter/tests/test_build_bundle.py`

**Interfaces:**
- `build_bundle(source: Path, output: Path) -> dict` writes the ZIP and returns the source manifest.
- `main(argv: list[str] | None = None) -> int` supplies `--source` and `--output`.
- `SKILL.md` is the WeKnora root; `references/source-manifest.json` contains relative path, byte count and SHA-256 for every original file.

- [ ] Write `test_zip_has_one_root_and_21_entries`, `test_hashes_match_originals`, and `test_same_input_same_zip_bytes`.
- [ ] Run the suite and confirm those tests fail because ZIP output is absent.
- [ ] Implement deterministic, sorted ZIP entries with fixed timestamps, root router text, and hash manifest.
- [ ] Run the suite and confirm pass.
- [ ] Write `test_cli_builds_from_other_working_directory` and `test_failure_keeps_existing_output`, then confirm expected failures.
- [ ] Implement CLI and atomic output replacement; run the suite and confirm pass.

### Task 3: Document, validate on the real source, and publish

**Files:**
- Create: `weknora/t12t-adapter/README.md`
- Create: `weknora/t12t-adapter/.gitignore`

- [ ] Document PowerShell invocation, ZIP import into WeKnora intelligent reasoning mode, the required sandbox/skill selection, and two behavior checks: architecture answer and log evidence gap.
- [ ] Run `python -m unittest discover -s weknora/t12t-adapter/tests -v` and inspect output.
- [ ] Run the CLI against the F-drive source into a local ignored output; inspect ZIP entry count, root frontmatter, source hashes, and duplicate-build SHA-256.
- [ ] Check the intended GitHub diff contains only code, tests, docs and ignore rules.
- [ ] Commit the adapter on the existing design branch, open a draft PR, and verify the PR file list and status.

The user approved the design and implementation in the current chat. Execute natively in this session without another approval request.
