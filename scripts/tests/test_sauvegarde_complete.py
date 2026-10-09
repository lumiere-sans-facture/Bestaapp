import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parents[1] / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


backup = load("backup", "sauvegarde-complete.py")
restore = load("restore", "dechiffrer-sauvegarde.py")


class BackupTests(unittest.TestCase):
    def test_secret_errors_do_not_leak_command_or_output(self):
        with patch.object(backup.subprocess, "run", return_value=SimpleNamespace(
                returncode=1, stdout=b"secret-fictif", stderr=b"mot-de-passe-fictif")):
            with self.assertRaises(RuntimeError) as error:
                backup.run_private(["supabase", "--db-url", "secret-fictif"])
            self.assertNotIn("secret-fictif", str(error.exception))
            self.assertNotIn("mot-de-passe", str(error.exception))

    def test_rejects_weak_phrase_before_creating_archive(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for phrase in ("trop-court", "a" * 40 + "\n"):
                with self.assertRaises(RuntimeError):
                    backup.seal(root / "payload", root / "encrypted", phrase)
            self.assertEqual(list(root.iterdir()), [])

    def test_storage_failure_does_not_publish_partial_backup(self):
        class Unavailable:
            def json(self, endpoint):
                return [{"id": "bucket"}]
            def objects(self, bucket):
                yield {"id": "one", "name": "photo", "bucket": bucket}
            def download(self, item, file):
                raise RuntimeError("indisponible")
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with self.assertRaises(RuntimeError):
                backup.export_storage(Unavailable(), root)
            self.assertFalse((root / "storage.json").exists())
            self.assertFalse((root / "completes-chiffrees").exists())

    def test_auth_requires_users_identities_and_password_hashes(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "data.sql"
            file.write_text('COPY "auth"."users" (id, encrypted_password) FROM stdin;\nuid\thash\n\\.\nCOPY "auth"."identities" (id) FROM stdin;\nidentity\n\\.\n', encoding="utf-8")
            self.assertEqual(backup.auth_counts(file), {"users": 1, "identities": 1})
            for invalid in ('COPY auth.users (id) FROM stdin;\n\\.\n', 'COPY auth.users (id, encrypted_password) FROM stdin;\nuid\thash\n', ''):
                file.write_text(invalid, encoding="utf-8")
                with self.assertRaises(RuntimeError):
                    backup.auth_counts(file)

    def test_retention_daily_and_weekly_across_year(self):
        dates = [(dt.date(2027, 1, 12) - dt.timedelta(days=i)).isoformat() for i in range(45)]
        keep = backup.retained_dates(dates + ["README.md", ".pending", "archive.sql"])
        self.assertTrue(set(dates[:7]) <= keep)
        self.assertIn("2026-12-27", keep)
        self.assertNotIn("2026-12-20", keep)
        self.assertLessEqual(len(keep), 11)

    def test_parts_roundtrip_corruption_and_path_traversal(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / "encrypted.gpg"
            source.write_bytes(b"ciphertext" * 100)
            parts = root / "parts"
            manifest = backup.split_archive(source, parts, chunk_size=31)
            (parts / "manifest.json").write_text(json.dumps(manifest))
            assembled = root / "joined"
            restore.verify_parts(parts, assembled)
            self.assertEqual(source.read_bytes(), assembled.read_bytes())
            (parts / manifest["parts"][0]["file"]).write_bytes(b"x" * 31)
            with self.assertRaises(ValueError):
                restore.verify_parts(parts, root / "corrupt")
            manifest["parts"][0]["file"] = "../secret"
            (parts / "manifest.json").write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                restore.verify_parts(parts, root / "traversal")

    def test_storage_recursion_and_pagination(self):
        class Fake(backup.Storage):
            def __init__(self):
                self.calls = []
            def json(self, endpoint, body=None):
                self.calls.append(body)
                if body["prefix"] == "nested/":
                    return [{"id": "nested-id", "name": "photo.jpg"}]
                if body["offset"] == 0:
                    return [{"id": None, "name": "nested"}] + [{"id": str(i), "name": str(i)} for i in range(999)]
                return [{"id": "last", "name": "last"}]
        storage = Fake()
        objects = list(storage.objects("photos"))
        self.assertEqual(len(objects), 1001)
        self.assertEqual(objects[0]["name"], "nested/photo.jpg")
        self.assertEqual(storage.calls[-1]["offset"], 1000)

    def test_no_plaintext_published_and_real_gpg_roundtrip(self):
        gpg = shutil.which("gpg") or os.environ.get("TEST_GPG")
        if not gpg:
            self.skipTest("GnuPG indisponible localement; obligatoire dans le workflow")
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            payload = root / "payload"
            payload.mkdir()
            (payload / "data.sql").write_text("DONNEE-SENSIBLE-TEST", encoding="utf-8")
            encrypted = root / "archive.gpg"
            # Le GPG fourni avec Git Windows attend des chemins MSYS (/c/...).
            # Le workflow de production utilise directement le GPG natif Linux.
            original_run = backup.run_private
            def run_test_tool(args, **kwargs):
                if os.name == "nt" and "Git" in gpg:
                    args = ["/" + arg[0].lower() + arg[2:].replace("\\", "/")
                            if len(arg) > 2 and arg[1] == ":" else arg for arg in args[1:]]
                    args.insert(0, gpg)
                return original_run(args, **kwargs)
            with patch.object(backup, "run_private", side_effect=run_test_tool):
                backup.seal(payload, encrypted, "phrase-de-test-uniquement-01234567890123456789", gpg=gpg)
            self.assertNotIn(b"DONNEE-SENSIBLE-TEST", encrypted.read_bytes())
            output = root / "destination"
            output.mkdir()
            (output / "bestasolar-sauvegarde-ancienne.json").write_text("conserver")
            backup.publish_local(output, encrypted, {"decryption_verified": True}, dt.datetime(2026, 10, 8, tzinfo=dt.timezone.utc))
            self.assertTrue((output / "bestasolar-sauvegarde-ancienne.json").exists())
            self.assertFalse(list((output / "completes-chiffrees").rglob("*.sql")))
            self.assertTrue((output / "completes-chiffrees/2026-10-08/manifest.json").exists())


if __name__ == "__main__":
    unittest.main()
