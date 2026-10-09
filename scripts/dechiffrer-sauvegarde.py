"""Vérifie et déchiffre une copie locale. Ne se connecte à aucune base."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile


def verify_parts(source, output):
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("format") != "bestasolar-encrypted-v1" or not manifest.get("parts"):
        raise ValueError("Format de sauvegarde inconnu")
    whole = hashlib.sha256()
    with open(output, "xb") as target:
        for index, part in enumerate(manifest["parts"]):
            if part.get("file") != f"archive.gpg.part{index:04d}" or not re.fullmatch(r"[a-f0-9]{64}", part.get("sha256", "")):
                raise ValueError("Nom ou empreinte de fragment invalide")
            file = source / part["file"]
            if file.is_symlink() or file.stat().st_size != part["bytes"]:
                raise ValueError("Fragment absent ou taille invalide")
            checksum = hashlib.sha256()
            with open(file, "rb") as stream:
                while block := stream.read(1024 * 1024):
                    checksum.update(block)
                    whole.update(block)
                    target.write(block)
            if checksum.hexdigest() != part["sha256"]:
                raise ValueError("Fragment corrompu")
    if whole.hexdigest() != manifest["archive_sha256"]:
        raise ValueError("Archive corrompue")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-dir", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if output.exists():
        raise ValueError("Choisir un dossier de sortie qui n'existe pas encore")
    phrase = os.environ.get("BACKUP_ENCRYPTION_PASSPHRASE")
    if not phrase:
        from getpass import getpass
        phrase = getpass("Phrase de déchiffrement : ")
    with tempfile.TemporaryDirectory(prefix="besta-decrypt-") as temporary:
        root = Path(temporary)
        encrypted = root / "archive.gpg"
        verify_parts(Path(args.archive_dir).resolve(), encrypted)
        plain = root / "archive.tar.gz"
        home = root / "gnupg"
        home.mkdir(mode=0o700)
        result = subprocess.run(["gpg", "--homedir", home.as_posix(), "--batch", "--no-symkey-cache",
            "--pinentry-mode", "loopback", "--passphrase-fd", "0", "--output", plain.as_posix(),
            "--decrypt", encrypted.as_posix()], input=(phrase + "\n").encode(), capture_output=True, timeout=1800)
        if result.returncode:
            raise ValueError("Déchiffrement refusé : phrase incorrecte ou archive endommagée")
        with tarfile.open(plain, "r:gz") as archive:
            # Les archives produites ne comportent ni lien ni périphérique.
            members = archive.getmembers()
            for member in members:
                if not (member.isdir() or member.isfile()) or member.name.startswith("/") or ".." in Path(member.name).parts:
                    raise ValueError("Chemin dangereux dans l'archive")
            output.mkdir(parents=True, mode=0o700)
            archive.extractall(output, filter="data")
    print("Archive vérifiée et déchiffrée. Lire backup/RESTAURATION.md avant toute importation.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, ValueError) else f"Échec ({type(error).__name__})")
        raise SystemExit(1)
