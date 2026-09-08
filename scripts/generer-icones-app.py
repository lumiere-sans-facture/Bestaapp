#!/usr/bin/env python3
"""Icônes des applications natives, engendrées depuis le logo Besta.

POURQUOI CE SCRIPT. `public/` porte les icônes du WEB ; les applications
natives ont les leurs, ailleurs — `android/app/src/main/res/mipmap-*`,
les `drawable-*/splash.png` et `ios/.../AppIcon.appiconset`. Remplacer les
unes ne touche pas les autres : l'APK a porté l'icône par défaut de
Capacitor (une étoile bleue), écran de démarrage compris, pendant que le
site affichait déjà le B de Besta.

    python3 scripts/generer-icones-app.py        (nécessite Pillow)

Source : public/besta-solar-icon-navy.png — le B marine sur fond transparent.
En Python et non en Node : c'est un outil de maintenance ponctuel, et il ne
vaut pas d'ajouter une dépendance native au paquet de l'application.
"""
from pathlib import Path
from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parent.parent
SOURCE = RACINE / 'public/besta-solar-icon-navy.png'
RES = RACINE / 'android/app/src/main/res'
IOS = RACINE / 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'

# Densités Android : dossier -> taille de l'icône héritée, en pixels.
DENSITES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}


def logo(taille):
    """Le logo détouré de ses marges, à `taille` pixels dans sa plus grande dimension."""
    im = Image.open(SOURCE).convert('RGBA')
    im = im.crop(im.split()[3].getbbox())          # marges transparentes retirées
    ratio = taille / max(im.size)
    return im.resize((max(1, round(im.width * ratio)), max(1, round(im.height * ratio))), Image.LANCZOS)


def centrer(fond, dessus):
    fond.paste(dessus, ((fond.width - dessus.width) // 2, (fond.height - dessus.height) // 2), dessus)
    return fond


# Hauteur du logo, en fraction de la toile. Le B est plus haut que large
# (158 × 210) : c'est sa DIAGONALE qui décide de ce qui rentre dans un masque
# rond, pas sa largeur. D'où des valeurs plus basses qu'il n'y paraît.
PART_CARREE = 0.72     # icône héritée et iOS : cadrage proche de l'icône du site
PART_AVANT_PLAN = 0.46  # adaptative : la demi-diagonale reste dans les 66 dp sûrs


def carree(taille):
    """Logo centré sur fond blanc — le fond adaptatif est blanc lui aussi."""
    return centrer(Image.new('RGBA', (taille, taille), (255, 255, 255, 255)),
                   logo(round(taille * PART_CARREE)))


def ronde(taille):
    """Même icône, découpée en cercle (ic_launcher_round)."""
    base = carree(taille)
    masque = Image.new('L', (taille, taille), 0)
    ImageDraw.Draw(masque).ellipse((0, 0, taille - 1, taille - 1), fill=255)
    base.putalpha(masque)
    return base


def avant_plan(taille):
    """Avant-plan adaptatif (Android 8+).

    La toile fait 108 dp, mais les lanceurs en rognent les bords : seuls les
    66 dp du centre sont GARANTIS visibles. Le logo doit tenir dans le CERCLE
    de 66 dp, pas dans le carré : à 46 % de hauteur, sa demi-diagonale vaut
    0,288 de la toile contre 0,306 pour le rayon sûr. Une valeur plus généreuse
    faisait toucher le bord sur les téléphones qui découpent en rond.
    """
    return centrer(Image.new('RGBA', (taille, taille), (0, 0, 0, 0)),
                   logo(round(taille * PART_AVANT_PLAN)))


def ecrire(chemin, image):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    image.save(chemin, 'PNG')


for densite, taille in DENSITES.items():
    dossier = RES / f'mipmap-{densite}'
    ecrire(dossier / 'ic_launcher.png', carree(taille))
    ecrire(dossier / 'ic_launcher_round.png', ronde(taille))
    # L'avant-plan se dessine sur 108 dp, soit 2,25 fois l'icône héritée.
    ecrire(dossier / 'ic_launcher_foreground.png', avant_plan(round(taille * 2.25)))

# iOS : une seule image de 1024 px, SANS transparence — l'App Store la refuse.
ecrire(IOS, carree(1024).convert('RGB'))


def demarrage(largeur, hauteur):
    """Écran de démarrage : logo centré sur blanc, discret.

    Il s'affiche une fraction de seconde, en plein écran et dans les deux
    orientations : le logo se cale sur la PLUS PETITE dimension, sinon il
    devient énorme en paysage et minuscule en portrait.
    """
    fond = Image.new('RGBA', (largeur, hauteur), (255, 255, 255, 255))
    return centrer(fond, logo(round(min(largeur, hauteur) * 0.28))).convert('RGB')


# Les écrans de démarrage existent déjà, à des tailles fixées par Capacitor :
# on les réécrit une à une en gardant EXACTEMENT leurs dimensions.
demarrages = sorted(RES.glob('drawable*/splash.png'))
for chemin in demarrages:
    with Image.open(chemin) as im:
        taille = im.size
    ecrire(chemin, demarrage(*taille))

print(f'Icônes engendrées depuis {SOURCE.name} : {len(DENSITES)} densités Android, '
      f'{len(demarrages)} écrans de démarrage, iOS 1024 px.')
