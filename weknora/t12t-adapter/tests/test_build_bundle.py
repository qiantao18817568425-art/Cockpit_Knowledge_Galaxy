import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).resolve().parents[1] / "build_bundle.py"
NAMES = (
    "t12t-cockpit-diagnosis",
    "t12t-log-analysis",
    "t12t-platform-architecture",
    "t12t-display-black-freeze",
    "t12t-touch-input",
    "t12t-avm-camera-stream",
    "t12t-power-sleep-str",
    "t12t-audio-path",
    "t12t-stability-crash-reset",
    "t12t-performance-jank",
    "t12t-ethernet-sgmii",
    "t12t-wireless-phone-link",
    "t12t-cross-domain-msg",
    "t12t-boot-hmi",
    "t12t-log-storm",
    "t12t-usb-typec-storage",
    "t12t-virtualization-tee",
    "t12t-db-ke-forensics",
    "t12t-mcu",
    "t12t-tpm-triage",
    "t12t-tpm-5y8d",
)


def load_module():
    if not MODULE_PATH.exists():
        raise AssertionError("build_bundle.py is missing")
    spec = importlib.util.spec_from_file_location("build_bundle", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def make_family(root: Path) -> None:
    for name in NAMES:
        directory = root / name
        directory.mkdir()
        (directory / "SKILL.md").write_text(
            f"---\nname: {name}\ndescription: Test source.\n---\n\n# {name}\n",
            encoding="utf-8",
        )
    architecture_ref = root / NAMES[2] / "references" / "domain-paths.md"
    architecture_ref.parent.mkdir()
    architecture_ref.write_bytes(b"# Domain paths\n")
    (root / NAMES[0] / "SKILL.md").write_text(
        f"---\nname: {NAMES[0]}\ndescription: Test source.\n---\n\n"
        "[architecture](../t12t-platform-architecture/references/domain-paths.md)\n",
        encoding="utf-8",
    )


class CollectSourceTests(unittest.TestCase):
    def test_collects_exact_family_and_ignores_extra_directory(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temp_dir:
            source = Path(temp_dir)
            make_family(source)
            extra = source / "unrelated-skill"
            extra.mkdir()
            (extra / "SKILL.md").write_text("not part of the family", encoding="utf-8")

            files = load_module().collect_source(source)

            self.assertEqual(len(files), 22)
            self.assertEqual(
                {name for name in files if name.endswith("/SKILL.md")},
                {f"{name}/SKILL.md" for name in NAMES},
            )
            self.assertIn("t12t-platform-architecture/references/domain-paths.md", files)
            self.assertNotIn("unrelated-skill/SKILL.md", files)

    def test_rejects_missing_skill_entrypoint(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temp_dir:
            source = Path(temp_dir)
            make_family(source)
            (source / NAMES[-1] / "SKILL.md").unlink()

            with self.assertRaisesRegex(ValueError, "missing skill entrypoint"):
                load_module().collect_source(source)

    def test_rejects_broken_relative_reference(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temp_dir:
            source = Path(temp_dir)
            make_family(source)
            (source / NAMES[0] / "SKILL.md").write_text(
                "[missing](references/does-not-exist.md)\n", encoding="utf-8"
            )

            with self.assertRaisesRegex(ValueError, "missing relative reference"):
                load_module().collect_source(source)

    def test_rejects_reference_escaping_family(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temp_dir:
            source = Path(temp_dir)
            make_family(source)
            (source / NAMES[0] / "SKILL.md").write_text(
                "[outside](../../other.md)\n", encoding="utf-8"
            )

            with self.assertRaisesRegex(ValueError, "reference escapes source"):
                load_module().collect_source(source)

    def test_rejects_symlinked_reference(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temp_dir:
            source = Path(temp_dir)
            make_family(source)
            target = source / NAMES[2] / "references" / "domain-paths.md"
            linked = source / NAMES[0] / "leak.md"
            try:
                linked.symlink_to(target)
            except OSError as exc:
                self.skipTest(f"symlinks unavailable: {exc}")

            with self.assertRaisesRegex(ValueError, "symbolic link"):
                load_module().collect_source(source)

    def test_rejects_junction_directory(self):
        if not hasattr(Path, "is_junction"):
            self.skipTest("junction detection unavailable")
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temp_dir:
            source = Path(temp_dir)
            make_family(source)
            junction = source / NAMES[2] / "references"
            with mock.patch.object(Path, "is_junction", lambda path: path == junction):
                with self.assertRaisesRegex(ValueError, "junction"):
                    load_module().collect_source(source)


class BundleTests(unittest.TestCase):
    def test_zip_has_one_root_and_all_source_entries(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temp_dir:
            work = Path(temp_dir)
            source = work / "source"
            source.mkdir()
            make_family(source)
            output = work / "bundle.zip"

            builder = load_module()
            self.assertTrue(hasattr(builder, "build_bundle"), "bundle builder is missing")
            builder.build_bundle(source, output)

            with zipfile.ZipFile(output) as archive:
                names = set(archive.namelist())
                self.assertEqual(len(names), 24)
                self.assertIn("SKILL.md", names)
                self.assertIn("references/source-manifest.json", names)
                self.assertIn(
                    "references/skills/t12t-platform-architecture/references/domain-paths.md",
                    names,
                )
                for name in NAMES:
                    self.assertIn(f"references/skills/{name}/SKILL.md", names)
                self.assertIn(
                    "name: t12t-cockpit-suite",
                    archive.read("SKILL.md").decode("utf-8"),
                )

    def test_hash_manifest_matches_original_bytes(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temp_dir:
            work = Path(temp_dir)
            source = work / "source"
            source.mkdir()
            make_family(source)
            output = work / "bundle.zip"

            builder = load_module()
            self.assertTrue(hasattr(builder, "build_bundle"), "bundle builder is missing")
            manifest = builder.build_bundle(source, output)

            self.assertEqual(len(manifest["source_files"]), 22)
            architecture = next(
                item for item in manifest["source_files"]
                if item["path"] == "t12t-platform-architecture/references/domain-paths.md"
            )
            self.assertEqual(architecture["size"], 15)
            self.assertEqual(
                architecture["sha256"],
                "ea1b7d959461bbdd4e732648153b7b531b41a50d31210e97510d776270b568a0",
            )
            with zipfile.ZipFile(output) as archive:
                embedded = json.loads(archive.read("references/source-manifest.json"))
                self.assertEqual(embedded, manifest)
                self.assertEqual(
                    archive.read(
                        "references/skills/t12t-platform-architecture/references/domain-paths.md"
                    ),
                    b"# Domain paths\n",
                )

    def test_same_source_produces_identical_zip_bytes(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temp_dir:
            work = Path(temp_dir)
            source = work / "source"
            source.mkdir()
            make_family(source)
            first = work / "first.zip"
            second = work / "second.zip"

            builder = load_module()
            self.assertTrue(hasattr(builder, "build_bundle"), "bundle builder is missing")
            builder.build_bundle(source, first)
            builder.build_bundle(source, second)

            self.assertEqual(first.read_bytes(), second.read_bytes())

    def test_cli_builds_from_unrelated_working_directory(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temp_dir:
            work = Path(temp_dir)
            source = work / "source"
            source.mkdir()
            make_family(source)
            output = work / "output" / "bundle.zip"

            result = subprocess.run(
                [
                    sys.executable, str(MODULE_PATH), "--source", str(source),
                    "--output", str(output),
                ],
                cwd=work,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(output.is_file(), result.stdout + result.stderr)

    def test_invalid_source_keeps_existing_output(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temp_dir:
            work = Path(temp_dir)
            source = work / "source"
            source.mkdir()
            make_family(source)
            output = work / "bundle.zip"
            output.write_bytes(b"previous bundle")
            (source / NAMES[0] / "SKILL.md").write_text(
                "[missing](references/does-not-exist.md)\n", encoding="utf-8"
            )

            with self.assertRaisesRegex(ValueError, "missing relative reference"):
                load_module().build_bundle(source, output)

            self.assertEqual(output.read_bytes(), b"previous bundle")


if __name__ == "__main__":
    unittest.main()

