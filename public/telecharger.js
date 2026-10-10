/* Page /telecharger?ref=CODE : l'APK téléchargé au nom d'un partenaire.
 *
 * Un APK installé ne sait pas par quel lien il est arrivé. Au toucher du
 * bouton, cette page copie donc « Code partenaire BestaSolar : CODE » dans le
 * presse-papiers, puis lance le téléchargement ; l'application installée le
 * lit à son premier lancement (src/lib/parrainageInstallation.js).
 *
 * Ce texte doit rester celui de src/utils/referral.js → texteParrainageApp :
 * un test unitaire y veille.
 */
(function () {
  var PREFIXE = 'Code partenaire BestaSolar : ';
  var code = (new URLSearchParams(location.search).get('ref') || '').trim().toUpperCase();
  // Sans code valable, rien à transmettre : téléchargement direct.
  if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(code)) {
    location.replace('/telecharger');
    return;
  }

  var etat = document.getElementById('etat');
  document.getElementById('code').textContent = code;
  document.getElementById('web').href = '/?ref=' + encodeURIComponent(code);

  // Repli des navigateurs sans API presse-papiers (ou adresse non sécurisée).
  function copierAncien(texte) {
    var zone = document.createElement('textarea');
    zone.value = texte;
    zone.setAttribute('readonly', '');
    zone.style.position = 'fixed';
    zone.style.opacity = '0';
    document.body.appendChild(zone);
    zone.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(zone);
    return ok;
  }

  function copier(texte) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texte).then(
        function () { return true; },
        function () { return copierAncien(texte); }
      );
    }
    return Promise.resolve(copierAncien(texte));
  }

  document.getElementById('telecharger').addEventListener('click', function () {
    copier(PREFIXE + code).then(function (ok) {
      etat.className = 'etat ' + (ok ? 'ok' : 'alerte');
      etat.textContent = ok
        ? 'Code retenu. Le téléchargement démarre…'
        : 'Le téléchargement démarre. Notez le code : vous le saisirez à l’inscription.';
      document.documentElement.dataset.codeCopie = ok ? 'oui' : 'non';
      // /telecharger sans code : Vercel renvoie directement vers l'APK.
      location.href = '/telecharger';
    });
  });
})();
