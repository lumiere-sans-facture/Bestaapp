#!/usr/bin/env python3
"""
Synchronisation des produits Deye d'un catalogue en ligne → BestaSolar.

  python3 scripts/scrape_deye.py scrape  [--url URL] [--out deye_import] [--delai 1.5] [--debug]
  python3 scripts/scrape_deye.py images  [--sources deye_import/sources] [--out deye_import/images]

`scrape` (dry-run, ne touche pas à la boutique) :
  - parcourt TOUTES les pages de la catégorie (lien « suivant », ?page=N,
    bouton « charger plus », défilement infini) avec un navigateur headless ;
  - ne garde que les produits de marque Deye ;
  - ouvre chaque fiche : nom, modèle, prix NGN, prix barré, description,
    caractéristiques, catégorie, disponibilité, URL des images, URL source ;
  - convertit les prix : FCFA = NGN × 0,6, arrondi à la centaine supérieure ;
  - rédige une description française à partir des caractéristiques (jamais
    le texte d'origine), sans mention du vendeur source, du pays ni de sa
    monnaie ;
  - écrit products.json, products.csv et rapport.md dans --out.
  Respecte le robots.txt du site et attend --delai secondes entre deux pages.

`images` : pour des photos dont BestaSolar a les droits (médiathèque
officielle Deye, photos maison), rangées dans --sources/<modele>/ :
fond uni remplacé par le bleu BestaSolar #0D3483 (détourage, sans liseré
sur les contours), carré 1000×1000 produit centré, export WebP + JPG nommés
deye-<modele>-<n>. Le script ne retire aucun filigrane ni logo, et ne
télécharge pas les photos du site source : il en note seulement les adresses
dans le CSV, pour savoir quelles photos réunir.

Dépendances : pip install -r scripts/requirements-deye.txt
Chromium : celui de Playwright, ou PLAYWRIGHT_CHROMIUM=/chemin/vers/chrome.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field, asdict
from pathlib import Path
from urllib.parse import urljoin, urlparse, urlencode, parse_qsl, urlunparse
from urllib import robotparser

URL_DEFAUT = 'https://fouanistore.com/nigeria-fr/shop?category_id=121&category_name=deye'
TAUX_NGN_FCFA = 0.6
BLEU_BESTASOLAR = (0x0D, 0x34, 0x83)
TAILLE_IMAGE = 1000
AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141 Safari/537.36 BestaSolarSync/1.0'

# Mentions à ne jamais reprendre dans nos textes.
INTERDITS = re.compile(r'fouani|nig[eé]ria|naira|₦|\bNGN\b|lagos|abuja', re.I)


# --------------------------------------------------------------------------
#  Prix
# --------------------------------------------------------------------------

def lire_prix(texte: str | None) -> int | None:
    """« ₦950,000.00 », « NGN 950 000 », « 950000 » → 950000 (entier, naira)."""
    if texte is None:
        return None
    if isinstance(texte, (int, float)):
        return int(round(texte))
    t = str(texte).replace(' ', ' ').replace('\xa0', ' ')
    m = re.search(r'(\d[\d\s.,]*)', t)
    if not m:
        return None
    brut = m.group(1).strip()
    # Décimales éventuelles : « 950,000.00 » / « 950.000,00 » / « 950 000 ».
    brut = re.sub(r'[.,](\d{1,2})$', '', brut)
    chiffres = re.sub(r'\D', '', brut)
    return int(chiffres) if chiffres else None


def ngn_vers_fcfa(ngn: int | None) -> int | None:
    """FCFA = NGN × 0,6, arrondi à la centaine SUPÉRIEURE (950 000 → 570 000)."""
    if not ngn:
        return None
    return int(math.ceil(ngn * TAUX_NGN_FCFA / 100.0 - 1e-9) * 100)


def format_fcfa(v: int | None) -> str:
    return '' if v is None else f"{v:,}".replace(',', ' ') + ' F'


# --------------------------------------------------------------------------
#  Modèle, catégorie, caractéristiques
# --------------------------------------------------------------------------

RE_MODELE = re.compile(
    r'\b(SUN-[A-Z0-9]+(?:-[A-Z0-9]+)*|SE-[A-Z0-9.]+(?:\s?PRO)?(?:-[A-Z0-9]+)*|RW-[A-Z0-9.]+(?:-[A-Z0-9]+)*'
    r'|BOS-[A-Z0-9]+(?:-[A-Z0-9]+)*|GB-[A-Z0-9]+(?:-[A-Z0-9]+)*|AI-W[0-9.]+(?:-[A-Z0-9]+)*'
    r'|SUN-M[0-9]+G[0-9]+(?:-[A-Z0-9]+)*)\b', re.I)

CATEGORIES = [
    # (catégorie BestaSolar, motif) — l'ordre compte : un « kit » contient
    # souvent le mot « onduleur », un onduleur parle de « battery voltage ».
    ('kits', re.compile(r'\bkit\b|\bbundle\b|\bpack\b', re.I)),
    ('onduleurs', re.compile(r'inverter|onduleur|micro.?inverter|\bSUN-', re.I)),
    ('batteries', re.compile(r'batter|lifepo4|lithium|\bkwh\b|\bBOS-|\bSE-G|\bRW-|\bAI-W|\bGB-', re.I)),
    ('controleurs', re.compile(r'charge controller|contr[ôo]leur|mppt controller|r[ée]gulateur', re.I)),
]


def categorie_de(nom: str, specs: dict) -> str:
    """Le NOM du produit décide d'abord ; le tableau de caractéristiques
    seulement s'il ne dit rien (un onduleur y affiche « Battery voltage »)."""
    for texte in (nom, ' '.join(f'{k} {v}' for k, v in specs.items())):
        for cat, motif in CATEGORIES:
            if motif.search(texte or ''):
                return cat
    return 'accessoires'


def modele_de(*textes: str) -> str:
    for t in textes:
        m = RE_MODELE.search(t or '')
        if m:
            return re.sub(r'\s+', '', m.group(1).upper())
    return ''


def slug(texte: str) -> str:
    t = unicodedata.normalize('NFKD', texte).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')


def lire_specs_texte(texte: str) -> dict:
    """Caractéristiques reconnaissables dans un texte libre (nom, description)."""
    t = texte or ''
    specs = {}
    if m := re.search(r'(\d+(?:[.,]\d+)?)\s*kw(?!h)', t, re.I):
        specs['puissance_kw'] = float(m.group(1).replace(',', '.'))
    elif m := re.search(r'SUN-(\d+(?:\.\d+)?)K', t, re.I):
        specs['puissance_kw'] = float(m.group(1))
    if m := re.search(r'(\d+(?:[.,]\d+)?)\s*kwh', t, re.I):
        specs['capacite_kwh'] = float(m.group(1).replace(',', '.'))
    if m := re.search(r'(\d+(?:[.,]\d+)?)\s*ah\b', t, re.I):
        specs['capacite_ah'] = float(m.group(1).replace(',', '.'))
    if m := re.search(r'(\d{2,4}(?:[.,]\d)?)\s*v(?:dc|ac)?\b', t, re.I):
        specs['tension_v'] = float(m.group(1).replace(',', '.'))
    # « 2 MPPT » ou « MPPT : 2 » / « Number of MPPT 2 » (pas « MPPT 60A »).
    if m := (re.search(r'(\d+)\s*mppt', t, re.I) or re.search(r'mppt\D{0,15}?(\d{1,2})\b(?!\s*a\b)', t, re.I)):
        if int(m.group(1)) <= 16:
            specs['mppt'] = int(m.group(1))
    if re.search(r'three.?phase|triphas|\bLP3\b|HP3|\b3P\b', t, re.I):
        specs['phases'] = 3
    elif re.search(r'single.?phase|monophas|\bLP1\b|\b1P\b', t, re.I):
        specs['phases'] = 1
    if re.search(r'\bhigh.?voltage\b|\bHV\b|\bHP3\b', t, re.I):
        specs['haute_tension'] = True
    return specs


# --------------------------------------------------------------------------
#  Description française (rédigée depuis les caractéristiques)
# --------------------------------------------------------------------------

def description_fr(p: 'Produit') -> str:
    s = {**lire_specs_texte(f"{p.nom} {p.description_source}"), **p.specs_normalisees}
    nb = lambda v: (f"{v:g}".replace('.', ',')) if isinstance(v, float) else str(v)
    phases = {1: 'monophasé', 3: 'triphasé'}.get(s.get('phases'))
    morceaux = []
    if p.categorie == 'onduleurs':
        tete = 'Onduleur hybride Deye'
        if s.get('puissance_kw'):
            tete += f" de {nb(s['puissance_kw'])} kW"
        if phases:
            tete += f", {phases}"
        morceaux.append(tete + '.')
        if s.get('mppt'):
            morceaux.append(f"{s['mppt']} entrées MPPT pour raccorder les panneaux sur plusieurs orientations.")
        morceaux.append('Il gère ensemble panneaux solaires, batteries et réseau (ou groupe électrogène) : '
                        'le courant reste disponible pendant les coupures, et l’énergie solaire est utilisée en priorité.')
    elif p.categorie == 'batteries':
        tete = 'Batterie lithium Deye'
        if s.get('capacite_kwh'):
            tete += f" de {nb(s['capacite_kwh'])} kWh"
        if s.get('tension_v'):
            tete += f" ({nb(s['tension_v'])} V)"
        morceaux.append(tete + '.')
        morceaux.append('Technologie LiFePO4 : longue durée de vie, recharge rapide et grande profondeur de décharge, '
                        'pour stocker l’énergie solaire de la journée et l’utiliser le soir.')
        if s.get('haute_tension'):
            morceaux.append('Batterie haute tension, à associer à un onduleur Deye haute tension.')
    elif p.categorie == 'kits':
        morceaux.append('Kit solaire Deye prêt à poser : onduleur, stockage et accessoires assortis, '
                        'pour une installation cohérente et rapide.')
    else:
        morceaux.append(f"Équipement Deye : {p.nom_fr}.")
    morceaux.append('Conseil, pose et service après-vente par BestaSolar au Bénin, au Togo et en Côte d’Ivoire.')
    texte = ' '.join(morceaux)
    return INTERDITS.sub('', texte).strip()


def nom_fr(nom: str) -> str:
    """Nom commercial en français, sans mention du vendeur source."""
    t = INTERDITS.sub('', nom or '').strip(' -–|')
    remplacements = [
        (r'\bhybrid inverter\b', 'Onduleur hybride'), (r'\binverter\b', 'Onduleur'),
        (r'\blithium battery\b', 'Batterie lithium'), (r'\bbattery\b', 'Batterie'),
        (r'\bthree phase\b', 'triphasé'), (r'\bsingle phase\b', 'monophasé'),
        (r'\bhigh voltage\b', 'haute tension'), (r'\blow voltage\b', 'basse tension'),
        (r'\bcharge controller\b', 'Contrôleur de charge'),
    ]
    for motif, rempl in remplacements:
        t = re.sub(motif, rempl, t, flags=re.I)
    return re.sub(r'\s{2,}', ' ', t).strip()


# --------------------------------------------------------------------------
#  Extraction d'une fiche produit (HTML rendu)
# --------------------------------------------------------------------------

@dataclass
class Produit:
    url: str
    nom: str = ''
    nom_fr: str = ''
    marque: str = ''
    modele: str = ''
    sku: str = ''
    categorie: str = ''
    prix_ngn: int | None = None
    prix_barre_ngn: int | None = None
    prix_fcfa: int | None = None
    prix_barre_fcfa: int | None = None
    disponibilite: str = ''
    description_source: str = ''
    description_fr: str = ''
    specs: dict = field(default_factory=dict)
    specs_normalisees: dict = field(default_factory=dict)
    images_source: list = field(default_factory=list)


def _jsonld_produits(soup) -> list[dict]:
    trouves = []
    for balise in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(balise.string or balise.get_text() or '{}')
        except (json.JSONDecodeError, TypeError):
            continue
        pile = data if isinstance(data, list) else [data]
        while pile:
            d = pile.pop()
            if isinstance(d, dict):
                if '@graph' in d:
                    pile.extend(d['@graph'] if isinstance(d['@graph'], list) else [d['@graph']])
                t = d.get('@type')
                if t == 'Product' or (isinstance(t, list) and 'Product' in t):
                    trouves.append(d)
    return trouves


def _meilleure_image(img) -> str | None:
    """Plus grande résolution disponible d'une balise <img>."""
    for attr in ('data-zoom-image', 'data-large_image', 'data-full', 'data-src-large', 'data-original'):
        if img.get(attr):
            return img[attr]
    srcset = img.get('srcset') or img.get('data-srcset')
    if srcset:
        candidats = []
        for part in srcset.split(','):
            bits = part.strip().split()
            if not bits:
                continue
            largeur = int(re.sub(r'\D', '', bits[1])) if len(bits) > 1 and re.search(r'\d', bits[1]) else 0
            candidats.append((largeur, bits[0]))
        if candidats:
            return max(candidats)[1]
    return img.get('data-src') or img.get('src')


def extraire_fiche(html: str, url: str) -> Produit:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    p = Produit(url=url)

    for d in _jsonld_produits(soup):
        p.nom = p.nom or str(d.get('name') or '').strip()
        marque = d.get('brand')
        p.marque = p.marque or (marque.get('name') if isinstance(marque, dict) else str(marque or ''))
        p.sku = p.sku or str(d.get('sku') or d.get('mpn') or '')
        p.description_source = p.description_source or str(d.get('description') or '')
        imgs = d.get('image') or []
        for im in (imgs if isinstance(imgs, list) else [imgs]):
            src = im.get('url') if isinstance(im, dict) else im
            if src:
                p.images_source.append(urljoin(url, src))
        offres = d.get('offers') or {}
        offres = offres[0] if isinstance(offres, list) and offres else offres
        if isinstance(offres, dict):
            p.prix_ngn = p.prix_ngn or lire_prix(offres.get('price') or offres.get('lowPrice'))
            dispo = str(offres.get('availability') or '')
            p.disponibilite = p.disponibilite or ('en stock' if 'InStock' in dispo else 'rupture' if 'OutOfStock' in dispo else dispo)

    meta = lambda prop: (soup.find('meta', attrs={'property': prop}) or soup.find('meta', attrs={'name': prop}) or {}).get('content')
    p.nom = p.nom or (soup.find('h1').get_text(' ', strip=True) if soup.find('h1') else '') or (meta('og:title') or '')
    p.prix_ngn = p.prix_ngn or lire_prix(meta('product:price:amount'))
    if meta('og:image'):
        p.images_source.append(urljoin(url, meta('og:image')))

    # Prix affichés (repli) : le premier montant en naira hors prix barré.
    if not p.prix_ngn or not p.prix_barre_ngn:
        barre = soup.select_one('del, s, .old-price, .price-old, .regular-price, [class*="old"][class*="price"], [class*="strike"]')
        if barre:
            p.prix_barre_ngn = p.prix_barre_ngn or lire_prix(barre.get_text(' ', strip=True))
        if not p.prix_ngn:
            for el in soup.select('[class*="price"], [itemprop="price"]'):
                if el.find_parent(['del', 's']) or el.name in ('del', 's'):
                    continue
                v = lire_prix(el.get('content') or el.get_text(' ', strip=True))
                if v:
                    p.prix_ngn = v
                    break
    if p.prix_barre_ngn and p.prix_ngn and p.prix_barre_ngn <= p.prix_ngn:
        p.prix_barre_ngn = None

    # Caractéristiques : tableaux, listes de définitions, « clé : valeur ».
    for tr in soup.select('table tr'):
        cellules = [c.get_text(' ', strip=True) for c in tr.find_all(['th', 'td'])]
        if len(cellules) == 2 and cellules[0] and cellules[1] and len(cellules[0]) < 60:
            p.specs[cellules[0]] = cellules[1]
    for dl in soup.find_all('dl'):
        for dt, dd in zip(dl.find_all('dt'), dl.find_all('dd')):
            p.specs[dt.get_text(' ', strip=True)] = dd.get_text(' ', strip=True)
    zone = soup.select_one('[class*="description"], #description, [id*="description"], [class*="specification"]')
    if zone:
        if not p.description_source:
            p.description_source = zone.get_text(' ', strip=True)
        for li in zone.find_all('li'):
            m = re.match(r'^\s*([^:]{2,50})\s*:\s*(.+)$', li.get_text(' ', strip=True))
            if m:
                p.specs.setdefault(m.group(1).strip(), m.group(2).strip())

    # Disponibilité (repli).
    if not p.disponibilite:
        texte = soup.get_text(' ', strip=True)
        if re.search(r'out of stock|rupture|indisponible|sold out', texte, re.I):
            p.disponibilite = 'rupture'
        elif re.search(r'in stock|en stock|disponible', texte, re.I):
            p.disponibilite = 'en stock'

    # Images de la galerie, meilleure résolution, sans doublon.
    for img in soup.select('[class*="gallery"] img, [class*="product"] img, [class*="slider"] img, [class*="zoom"] img'):
        src = _meilleure_image(img)
        if src and not src.startswith('data:') and not re.search(r'logo|icon|placeholder|sprite', src, re.I):
            p.images_source.append(urljoin(url, src))
    vus = set()
    p.images_source = [u for u in p.images_source if not (u in vus or vus.add(u))]

    # Normalisation.
    texte_specs = ' '.join(f'{k} {v}' for k, v in p.specs.items())
    p.specs_normalisees = lire_specs_texte(f"{p.nom} {texte_specs}")
    p.modele = modele_de(p.sku, p.nom, texte_specs, p.description_source)
    p.marque = p.marque or ('Deye' if re.search(r'\bdeye\b', p.nom, re.I) else '')
    p.categorie = categorie_de(p.nom, p.specs)
    p.nom_fr = nom_fr(p.nom)
    p.description_fr = description_fr(p)
    p.prix_fcfa = ngn_vers_fcfa(p.prix_ngn)
    p.prix_barre_fcfa = ngn_vers_fcfa(p.prix_barre_ngn)
    return p


def est_deye(p: Produit) -> bool:
    return bool(re.search(r'\bdeye\b', f"{p.marque} {p.nom}", re.I))


# --------------------------------------------------------------------------
#  Navigation : catégorie paginée → liens produits → fiches
# --------------------------------------------------------------------------

def robots_autorise(url: str) -> bool:
    import requests
    base = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
    rp = robotparser.RobotFileParser()
    try:
        r = requests.get(base + '/robots.txt', headers={'User-Agent': AGENT}, timeout=20)
        rp.parse(r.text.splitlines() if r.status_code == 200 else [])
    except Exception as e:  # réseau coupé : on s'arrête plutôt que de deviner
        raise SystemExit(f"robots.txt illisible ({e}) : rien n'est parcouru.")
    return rp.can_fetch(AGENT, url)


def _page_suivante(url: str, n: int) -> str:
    u = urlparse(url)
    q = dict(parse_qsl(u.query))
    q['page'] = str(n)
    return urlunparse(u._replace(query=urlencode(q)))


RE_LIEN_PRODUIT = re.compile(r'/product|/products/|/p/|product_id=|/item/|/shop/[^?]+$', re.I)


def liens_produits(page, base_url: str) -> list[str]:
    hrefs = page.eval_on_selector_all('a[href]', 'els => els.map(e => e.href)')
    hote = urlparse(base_url).netloc
    return [h.split('#')[0] for h in hrefs if urlparse(h).netloc == hote and RE_LIEN_PRODUIT.search(urlparse(h).path + '?' + urlparse(h).query)
            and 'category_id' not in h]


def parcourir_categorie(page, url: str, delai: float, journal) -> list[str]:
    """Tous les liens produits de la catégorie, toutes pages confondues."""
    vus: list[str] = []
    ajouter = lambda liste: [vus.append(h) for h in liste if h not in vus]
    page.goto(url, wait_until='networkidle', timeout=60000)
    for n in range(2, 200):
        # Défilement infini et bouton « charger plus » : jusqu'à stabilité.
        for _ in range(30):
            avant = len(set(liens_produits(page, url)))
            page.mouse.wheel(0, 20000)
            time.sleep(delai)
            bouton = page.locator('button, a').filter(has_text=re.compile(r'load more|charger plus|voir plus|afficher plus', re.I))
            if bouton.count() and bouton.first.is_visible():
                bouton.first.click()
                page.wait_for_load_state('networkidle')
            if len(set(liens_produits(page, url))) == avant:
                break
        nouveaux = [h for h in liens_produits(page, url) if h not in vus]
        ajouter(nouveaux)
        journal(f"  page {n - 1} : {len(nouveaux)} produit(s) — total {len(vus)}")
        # Page suivante : lien rel=next / « suivant », sinon ?page=N.
        suivant = page.locator('a[rel="next"], a[aria-label*="next" i], a:has-text("Suivant"), a:has-text("Next"), .pagination a:has-text("›")')
        cible = suivant.first.get_attribute('href') if suivant.count() else None
        cible = urljoin(page.url, cible) if cible else _page_suivante(url, n)
        time.sleep(delai)
        page.goto(cible, wait_until='networkidle', timeout=60000)
        if not [h for h in liens_produits(page, url) if h not in vus]:
            break
    return vus


def commande_scrape(args) -> None:
    from playwright.sync_api import sync_playwright
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    journal = lambda m: print(m, flush=True)
    if not robots_autorise(args.url):
        raise SystemExit('robots.txt interdit le parcours de cette catégorie : arrêt.')
    produits: list[Produit] = []
    ecartes: list[str] = []
    with sync_playwright() as pw:
        navigateur = pw.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM') or None, headless=True)
        page = navigateur.new_page(user_agent=AGENT)
        journal(f"Catégorie : {args.url}")
        liens = parcourir_categorie(page, args.url, args.delai, journal)
        journal(f"{len(liens)} fiche(s) à ouvrir")
        for i, lien in enumerate(liens, 1):
            time.sleep(args.delai)
            try:
                page.goto(lien, wait_until='networkidle', timeout=60000)
                html = page.content()
                if args.debug:
                    (out / 'debug').mkdir(exist_ok=True)
                    (out / 'debug' / f"{i:03d}-{slug(lien)[-60:]}.html").write_text(html, encoding='utf-8')
                p = extraire_fiche(html, lien)
            except Exception as e:  # une fiche cassée n'arrête pas la synchro
                ecartes.append(f"{lien} — échec : {e}")
                continue
            if not est_deye(p):
                ecartes.append(f"{lien} — pas Deye : {p.nom}")
                continue
            produits.append(p)
            journal(f"  [{i}/{len(liens)}] {p.nom} — {p.prix_ngn or '?'} NGN → {format_fcfa(p.prix_fcfa)}")
        navigateur.close()
    ecrire_sorties(produits, ecartes, out)


def ecrire_sorties(produits: list[Produit], ecartes: list[str], out: Path) -> None:
    for p in produits:
        p.sku = f"DEYE-{p.modele or slug(p.nom).upper()}"
    (out / 'products.json').write_text(json.dumps([asdict(p) for p in produits], ensure_ascii=False, indent=2), encoding='utf-8')
    colonnes = ['sku', 'nom_fr', 'modele', 'categorie', 'prix_ngn', 'prix_barre_ngn', 'prix_fcfa', 'prix_barre_fcfa',
                'disponibilite', 'description_fr', 'specs', 'nb_images', 'images_source', 'url']
    with open(out / 'products.csv', 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=colonnes, delimiter=';')
        w.writeheader()
        for p in produits:
            w.writerow({**{k: getattr(p, k) for k in colonnes if hasattr(p, k)},
                        'specs': json.dumps(p.specs, ensure_ascii=False), 'nb_images': len(p.images_source),
                        'images_source': ' '.join(p.images_source)})
    lignes = ['# Import Deye — dry-run', '', f"{len(produits)} produit(s) Deye retenu(s), {len(ecartes)} écarté(s).", '',
              '| Nom | Prix NGN | Prix FCFA | Prix barré FCFA | Images |', '|---|---:|---:|---:|---:|']
    for p in produits:
        lignes.append(f"| {p.nom_fr} | {p.prix_ngn or '—'} | {format_fcfa(p.prix_fcfa) or '—'} | {format_fcfa(p.prix_barre_fcfa) or '—'} | {len(p.images_source)} |")
    if ecartes:
        lignes += ['', '## Écartés', ''] + [f"- {e}" for e in ecartes]
    (out / 'rapport.md').write_text('\n'.join(lignes) + '\n', encoding='utf-8')
    print(f"\n{len(produits)} produit(s) → {out}/products.csv, products.json, rapport.md")


# --------------------------------------------------------------------------
#  Images : fond uni → bleu BestaSolar, carré 1000 × 1000
# --------------------------------------------------------------------------

def masque_produit(rgb):
    """Alpha (0..1) du produit sur un fond UNI : couleur du fond lue sur les
    bords de l'image, transition douce sur les contours. rembg, s'il est
    installé, détoure à la place (meilleur sur un fond chargé)."""
    import numpy as np
    try:
        from rembg import remove  # facultatif
        from PIL import Image
        alpha = np.asarray(remove(Image.fromarray(rgb), only_mask=True), dtype=np.float32) / 255.0
        return alpha
    except Exception:
        pass
    h, w, _ = rgb.shape
    bord = np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3), rgb[:, :4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3)])
    fond = np.median(bord, axis=0)
    ecart = np.sqrt(((rgb.astype(np.float32) - fond) ** 2).sum(axis=2))
    bruit = np.percentile(np.sqrt(((bord.astype(np.float32) - fond) ** 2).sum(axis=1)), 98)
    bas, haut = max(12.0, bruit * 1.5), max(40.0, bruit * 4)
    alpha = np.clip((ecart - bas) / (haut - bas), 0.0, 1.0)
    # Seul le fond RELIÉ au bord de l'image est du fond : un blanc intérieur
    # (clayettes, façade) sur une photo à fond blanc appartient au produit.
    # Sur un fond vert, les trous intérieurs verts restent du fond : aucun
    # produit Deye n'a ce vert, et il ne doit pas en rester sur le bleu.
    vert = fond[1] > fond[0] + 20 and fond[1] > fond[2] + 20
    if not vert:
        from scipy import ndimage
        candidats = alpha < 0.5
        etiquettes, _ = ndimage.label(candidats)
        au_bord = set(np.unique(np.concatenate([etiquettes[0], etiquettes[-1], etiquettes[:, 0], etiquettes[:, -1]]))) - {0}
        relie = np.isin(etiquettes, list(au_bord))
        alpha = np.where(candidats & ~relie, 1.0, alpha)
    return alpha, fond


def _dilater(masque, n):
    """Dilatation binaire 3×3, n fois (numpy seul)."""
    import numpy as np
    m = masque.copy()
    for _ in range(n):
        p = np.pad(m, 1)
        m = (p[:-2, :-2] | p[:-2, 1:-1] | p[:-2, 2:] | p[1:-1, :-2] | p[1:-1, 2:]
             | p[2:, :-2] | p[2:, 1:-1] | p[2:, 2:] | m)
    return m


def _flou3(a):
    """Moyenne 3×3 (adoucit le contour du masque)."""
    import numpy as np
    p = np.pad(a, 1, mode='edge')
    return sum(p[i:i + a.shape[0], j:j + a.shape[1]] for i in range(3) for j in range(3)) / 9.0


def sur_fond_bleu(chemin_src: Path, sortie_base: Path) -> None:
    import numpy as np
    from PIL import Image
    img = Image.open(chemin_src).convert('RGB')
    rgb = np.asarray(img)
    res = masque_produit(rgb)
    alpha, fond = (res if isinstance(res, tuple) else (res, None))
    px = rgb.astype(np.float32)
    if fond is not None:
        fond_px = np.asarray(fond, dtype=np.float32)
        hors_produit = alpha < 0.5
        # 1. Contour rogné d'un pixel puis adouci : le pixel de bord, moitié
        #    produit moitié fond, est celui qui fait le liseré.
        bord1 = _dilater(hors_produit, 1) & ~hors_produit
        alpha = np.where(bord1, 0.0, alpha)
        alpha = np.clip(_flou3(alpha) * 1.0, 0, 1)
        # 2. Bande de contour (4 px) : la couleur du fond qui y bave est
        #    retirée — pour un fond vert, le vert ramené au plus fort du
        #    rouge et du bleu (l'intérieur du produit n'est pas touché).
        bande = _dilater(hors_produit, 4) & (alpha > 0)
        vert_dominant = fond_px[1] > fond_px[0] + 20 and fond_px[1] > fond_px[2] + 20
        if vert_dominant:
            limite = np.maximum(px[..., 0], px[..., 2])
            px[..., 1] = np.where(bande, np.minimum(px[..., 1], limite), px[..., 1])
        # 3. Décontamination des pixels semi-transparents (fond quelconque).
        a = alpha[..., None]
        semi = (a > 0.02) & (a < 0.98)
        px = np.where(semi, (px - (1 - a) * fond_px) / np.maximum(a, 0.02), px)
    px = np.clip(px, 0, 255)
    bleu = np.array(BLEU_BESTASOLAR, dtype=np.float32)
    compo = px * alpha[..., None] + bleu * (1 - alpha[..., None])
    # Recadrage sur le produit, carré, produit centré, marge de 6 %.
    ys, xs = np.where(alpha > 0.5)
    if len(xs):
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    else:
        x0, x1, y0, y1 = 0, rgb.shape[1], 0, rgb.shape[0]
    produit = Image.fromarray(compo[y0:y1, x0:x1].astype('uint8'))
    cote = int(max(x1 - x0, y1 - y0) / 0.88)
    carre = Image.new('RGB', (cote, cote), BLEU_BESTASOLAR)
    carre.paste(produit, ((cote - (x1 - x0)) // 2, (cote - (y1 - y0)) // 2))
    carre = carre.resize((TAILLE_IMAGE, TAILLE_IMAGE), Image.LANCZOS)
    carre.save(sortie_base.with_suffix('.webp'), 'WEBP', quality=88)
    carre.save(sortie_base.with_suffix('.jpg'), 'JPEG', quality=88, optimize=True, progressive=True)


def commande_images(args) -> None:
    sources, out = Path(args.sources), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if not sources.exists():
        raise SystemExit(f"Dossier de photos introuvable : {sources} (une sous-dossier par modèle).")
    total = 0
    for dossier in sorted(d for d in sources.iterdir() if d.is_dir()):
        modele = slug(dossier.name)
        fichiers = sorted(f for f in dossier.iterdir() if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp'))
        for n, f in enumerate(fichiers, 1):
            sur_fond_bleu(f, out / f"deye-{modele}-{n}")
            total += 1
    print(f"{total} image(s) → {out} (WebP + JPG, {TAILLE_IMAGE}×{TAILLE_IMAGE}, fond #0D3483)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    sous = ap.add_subparsers(dest='commande', required=True)
    s = sous.add_parser('scrape', help='parcourir la catégorie et écrire le dry-run')
    s.add_argument('--url', default=URL_DEFAUT)
    s.add_argument('--out', default='deye_import')
    s.add_argument('--delai', type=float, default=1.5, help='secondes entre deux pages (1 à 2)')
    s.add_argument('--debug', action='store_true', help='enregistrer le HTML de chaque fiche')
    i = sous.add_parser('images', help='photos autorisées → fond bleu BestaSolar')
    i.add_argument('--sources', default='deye_import/sources')
    i.add_argument('--out', default='deye_import/images')
    args = ap.parse_args()
    {'scrape': commande_scrape, 'images': commande_images}[args.commande](args)


if __name__ == '__main__':
    main()
