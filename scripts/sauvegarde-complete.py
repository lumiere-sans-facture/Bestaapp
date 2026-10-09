"""Export Supabase Auth + métier + Storage, chiffré avant toute publication.

Les commandes de restauration ne sont JAMAIS exécutées par ce programme.
Python standard, Supabase CLI, Docker et GnuPG uniquement.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request

PROJECT = "ujllvzkhqlabxpoyidor"
POOLER = "aws-0-eu-west-1.pooler.supabase.com"
CHUNK_SIZE = 40 * 1024 * 1024
MAX_BYTES = 2 * 1024 * 1024 * 1024


def digest(file):
    with open(file, "rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def run_private(args, *, env=None, input_bytes=None):
    # Aucun argument, stderr ou stdout de ces outils n'est renvoyé dans les logs.
    # Ils peuvent contenir une URL PostgreSQL, un mot de passe ou des lignes SQL.
    try:
        result = subprocess.run(args, input=input_bytes, capture_output=True,
                                env=env, timeout=1800, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise RuntimeError(f"Outil {Path(args[0]).name} indisponible ou délai dépassé") from None
    if result.returncode:
        raise RuntimeError(f"Échec de {Path(args[0]).name} (code {result.returncode}); vérifier les accès et versions")


def auth_counts(data_file):
    """Contrôle l'inclusion des identités ET des hashes dans un dump COPY."""
    counts = {}
    current = None
    with open(data_file, encoding="utf-8") as stream:
        for line in stream:
            if current:
                if line.rstrip("\r\n") == "\\.":
                    current = None
                else:
                    counts[current] += 1
                continue
            match = re.match(r'^COPY "?auth"?\."?(users|identities)"? \((.+)\) FROM stdin;', line)
            if match:
                current = match[1]
                if current == "users" and "encrypted_password" not in match[2]:
                    raise RuntimeError("Export Auth sans hashes de mots de passe")
                counts[current] = 0
    if current or set(counts) != {"users", "identities"}:
        raise RuntimeError("Export Auth incomplet : users/identities absents ou COPY tronqué")
    return counts


def export_database(work, password):
    if not password or password.startswith("[YOUR-"):
        raise RuntimeError("BACKUP_DB_PASSWORD absent ou exemple non remplacé")
    encoded = urllib.parse.quote(password, safe="")
    db_url = f"postgresql://postgres.{PROJECT}:{encoded}@{POOLER}:5432/postgres?sslmode=require"
    commands = [
        ("roles.sql", ["--role-only"]),
        ("schema.sql", []),
        ("data.sql", ["--data-only", "--use-copy", "-x", "storage.buckets_vectors", "-x", "storage.vector_indexes"]),
        # Référence des personnalisations des schémas gérés, à revoir à la restauration.
        ("managed-schema.sql", ["--schema", "auth,storage"]),
    ]
    for filename, flags in commands:
        print(f"Export PostgreSQL : {filename}", flush=True)
        run_private(["supabase", "db", "dump", "--db-url", db_url,
                     "--file", str(work / filename), *flags])
        if not (work / filename).is_file() or not (work / filename).stat().st_size:
            raise RuntimeError(f"Export vide : {filename}")
    counts = auth_counts(work / "data.sql")
    print(f"Auth inclus : {counts['users']} comptes, {counts['identities']} identités", flush=True)
    return counts


class Storage:
    def __init__(self, url, key):
        if url.rstrip("/") != f"https://{PROJECT}.supabase.co" or not key:
            raise RuntimeError("URL/clé Storage absente ou projet différent de la production")
        self.url = url.rstrip("/")
        self.headers = {"apikey": key, "Content-Type": "application/json"}
        if not key.startswith("sb_secret_"):
            self.headers["Authorization"] = f"Bearer {key}"

    def request(self, endpoint, body=None):
        request = urllib.request.Request(self.url + "/storage/v1/" + endpoint,
            data=json.dumps(body).encode() if body is not None else None,
            headers=self.headers)
        try:
            return urllib.request.urlopen(request, timeout=120)
        except (urllib.error.URLError, TimeoutError):
            raise RuntimeError("Lecture Storage impossible; aucune sauvegarde partielle ne sera publiée") from None

    def json(self, endpoint, body=None):
        with self.request(endpoint, body) as response:
            return json.load(response)

    def objects(self, bucket, prefix="", seen=None):
        seen = set() if seen is None else seen
        if prefix in seen:
            raise RuntimeError("Pagination Storage incohérente")
        seen.add(prefix)
        offset = 0
        while True:
            page = self.json("object/list/" + urllib.parse.quote(bucket, safe=""),
                {"prefix": prefix, "limit": 1000, "offset": offset,
                 "sortBy": {"column": "name", "order": "asc"}})
            if not isinstance(page, list):
                raise RuntimeError("Réponse Storage inattendue")
            for item in page:
                name = prefix + item["name"]
                if item.get("id") is None:
                    yield from self.objects(bucket, name + "/", seen)
                else:
                    yield {**item, "name": name, "bucket": bucket}
            if len(page) < 1000:
                break
            offset += len(page)

    def download(self, item, destination):
        endpoint = "object/" + urllib.parse.quote(item["bucket"], safe="") + "/" + urllib.parse.quote(item["name"], safe="/")
        size = 0
        with self.request(endpoint) as response, open(destination, "xb") as output:
            while block := response.read(1024 * 1024):
                size += len(block)
                if size > MAX_BYTES:
                    raise RuntimeError("Fichier Storage trop volumineux pour cette destination")
                output.write(block)
        expected = (item.get("metadata") or {}).get("size")
        if expected is not None and int(expected) != size:
            raise RuntimeError("Fichier Storage modifié pendant la copie; relancer la sauvegarde")
        return size


def export_storage(storage, work):
    buckets = storage.json("bucket")
    if not isinstance(buckets, list):
        raise RuntimeError("Liste des buckets Storage illisible")
    directory = work / "storage"
    directory.mkdir()
    objects, total, keys = [], 0, set()
    for bucket in buckets:
        for item in storage.objects(bucket["id"]):
            # Aucun nom client n'est utilisé comme chemin disque (traversée impossible).
            key = json.dumps([item["bucket"], item["name"]], ensure_ascii=False)
            file_id = hashlib.sha256(key.encode()).hexdigest()
            if file_id in keys:
                raise RuntimeError("Objet Storage dupliqué pendant la pagination")
            keys.add(file_id)
            file = directory / file_id
            total += storage.download(item, file)
            if total > MAX_BYTES:
                raise RuntimeError("Storage dépasse 2 Gio; choisir un stockage de sauvegarde adapté")
            objects.append({**item, "file": f"storage/{file_id}", "sha256": digest(file)})
    (work / "storage.json").write_text(json.dumps({"buckets": buckets, "objects": objects}, ensure_ascii=False), encoding="utf-8")
    print(f"Storage : {len(buckets)} buckets, {len(objects)} fichiers copiés", flush=True)
    return {"buckets": len(buckets), "files": len(objects), "bytes": total}


def seal(work, encrypted, phrase, gpg="gpg"):
    if len(phrase) < 32 or "\n" in phrase or "\r" in phrase:
        raise RuntimeError("BACKUP_ENCRYPTION_PASSPHRASE doit contenir au moins 32 caractères sur une ligne")
    archive = work.parent / "archive.tar.gz"
    with tarfile.open(archive, "w:gz") as output:
        output.add(work, arcname="backup", recursive=True)
    # Dossier de trousseau isolé et éphémère; aucun agent GPG utilisateur modifié.
    home = work.parent / "gnupg"
    home.mkdir(mode=0o700)
    common = [gpg, "--homedir", home.as_posix(), "--batch", "--yes", "--no-symkey-cache",
              "--pinentry-mode", "loopback", "--passphrase-fd", "0"]
    run_private([*common, "--symmetric", "--cipher-algo", "AES256", "--s2k-mode", "3",
                 "--s2k-count", "65011712", "--output", encrypted.as_posix(), archive.as_posix()],
                input_bytes=(phrase + "\n").encode())
    restored = work.parent / "verification.tar.gz"
    run_private([*common, "--decrypt", "--output", restored.as_posix(), encrypted.as_posix()],
                input_bytes=(phrase + "\n").encode())
    if digest(restored) != digest(archive):
        raise RuntimeError("La vérification du déchiffrement a échoué")


def split_archive(archive, destination, chunk_size=CHUNK_SIZE):
    destination.mkdir(parents=True, exist_ok=False)
    parts = []
    with open(archive, "rb") as source:
        while block := source.read(chunk_size):
            name = f"archive.gpg.part{len(parts):04d}"
            part = destination / name
            part.write_bytes(block)
            parts.append({"file": name, "bytes": len(block), "sha256": digest(part)})
    if not parts:
        raise RuntimeError("Archive chiffrée vide")
    return {"format": "bestasolar-encrypted-v1", "archive_sha256": digest(archive), "parts": parts}


def retained_dates(names):
    """7 jours les plus récents + dernière copie de chacune des 4 dernières semaines."""
    dates = sorted({n for n in names if re.fullmatch(r"\d{4}-\d{2}-\d{2}", n)}, reverse=True)
    for name in dates:
        dt.date.fromisoformat(name)
    keep = set(dates[:7])
    weeks = set()
    for date in dates:
        week = dt.date.fromisoformat(date).isocalendar()[:2]
        if week not in weeks:
            weeks.add(week)
            if len(weeks) <= 4:
                keep.add(date)
    return keep


def publish_local(output, archive, summary, now):
    # Ne touche qu'au sous-dossier spécifique de cette deuxième sauvegarde.
    root = output / "completes-chiffrees"
    if root.is_symlink():
        raise RuntimeError("Destination de sauvegarde liée à un autre dossier")
    root.mkdir(parents=True, exist_ok=True)
    date = now.date().isoformat()
    staging = root / f".pending-{date}"
    if staging.exists():
        raise RuntimeError("Dossier temporaire de publication déjà présent")
    manifest = split_archive(archive, staging)
    manifest.update(summary)
    (staging / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    target = root / date
    if target.is_symlink() or (root / "DERNIERE.json").is_symlink():
        raise RuntimeError("Lien inattendu dans la destination de sauvegarde")
    if target.exists():
        shutil.rmtree(target)
    staging.rename(target)
    names = [p.name for p in root.iterdir() if p.is_dir() and not p.is_symlink()]
    keep = retained_dates(names)
    for name in names:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", name) and name not in keep:
            shutil.rmtree(root / name)
    (root / "DERNIERE.json").write_text(json.dumps({"date": date, **summary}, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    required = ["BACKUP_DB_PASSWORD", "BACKUP_ENCRYPTION_PASSPHRASE", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    for name in required:
        if not os.environ.get(name):
            raise RuntimeError(f"Secret absent : {name}")
    phrase = os.environ["BACKUP_ENCRYPTION_PASSPHRASE"]
    if len(phrase) < 32 or "\n" in phrase or "\r" in phrase:
        raise RuntimeError("Phrase de chiffrement invalide (32 caractères minimum, une ligne)")
    now = dt.datetime.now(dt.timezone.utc)
    # Hors du checkout : jamais de SQL en clair dans le dépôt de sauvegarde.
    with tempfile.TemporaryDirectory(prefix="besta-backup-") as temporary:
        root = Path(temporary)
        work = root / "payload"
        work.mkdir(mode=0o700)
        counts = export_database(work, os.environ["BACKUP_DB_PASSWORD"])
        storage = export_storage(Storage(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]), work)
        repo = Path(__file__).resolve().parent.parent
        shutil.copytree(repo / "supabase", work / "supabase-source", ignore=shutil.ignore_patterns(".temp", ".branches", ".env*"))
        shutil.copyfile(repo / "SAUVEGARDE-COMPLETE.md", work / "RESTAURATION.md")
        recovery_config = os.environ.get("BACKUP_RECOVERY_CONFIG_JSON")
        if recovery_config:
            json.loads(recovery_config)  # refuser une configuration tronquée
            (work / "recovery-config.json").write_text(recovery_config, encoding="utf-8")
        manifest = {"created_at": now.isoformat(), "project": PROJECT,
            "commit": os.environ.get("GITHUB_SHA", "local"), "auth": counts, "storage": storage,
            "recovery_config_included": bool(recovery_config),
            "restore_tested": False,
            "limits": ["Pas de snapshot atomique entre PostgreSQL et Storage",
                       "Vault/pgsodium et clés de chiffrement plateforme exclus par le CLI",
                       "Schéma auth/storage personnalisé à réappliquer après revue",
                       "Historique supabase_migrations non exporté par défaut; migrations source incluses",
                       "Paramètres OAuth/SMTP/Vercel et secrets Edge à conserver séparément"]}
        (work / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        archive = root / "archive.gpg"
        seal(work, archive, phrase)
        publish_local(Path(args.output).resolve(), archive,
                      {"created_at": now.isoformat(), "decryption_verified": True,
                       "restore_tested": False, "recovery_config_included": bool(recovery_config)}, now)
    print("Export et déchiffrement vérifiés. Restauration applicative encore à tester.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Les erreurs connues ne contiennent pas de données; les autres ne sont pas imprimées.
        print(str(error) if isinstance(error, RuntimeError) else f"Échec de sauvegarde ({type(error).__name__})", flush=True)
        raise SystemExit(1)
