// Logo BESTA SOLAR — encodé en data-URI pour être inliné dans les documents
// HTML générés (fiche de dimensionnement). Ces documents sont ouverts via
// `document.write` dans un `about:blank` : aucune URL relative ne s'y résout,
// le logo DOIT donc être embarqué.
//
// ⚠️ REMPLACEMENT PAR LE LOGO OFFICIEL — une seule ligne à changer :
//   1. déposer le fichier officiel (PNG ou SVG) dans src/assets/ ;
//   2. l'encoder en base64 :  base64 -w0 src/assets/logo-bestasolar.png
//   3. coller le résultat ci-dessous, en adaptant le préfixe de type MIME
//      ('data:image/png;base64,' ou 'data:image/svg+xml;base64,').
// Le reste du code n'a pas à bouger : la fiche lit uniquement LOGO_BESTASOLAR.
//
// La version ci-dessous est une reprise vectorielle de la marque (typographie
// approchée) en attendant le fichier officiel.

export const LOGO_BESTASOLAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MjAgMTI4IiB3aWR0aD0iNTIwIiBoZWlnaHQ9IjEyOCI+CiAgPGcgZmlsbD0iIzBhMjQ3MiIgZm9udC1mYW1pbHk9IkhlbHZldGljYSxBcmlhbCxzYW5zLXNlcmlmIiBmb250LXdlaWdodD0iNzAwIj4KICAgIDx0ZXh0IHg9IjAiIHk9IjcyIiBmb250LXNpemU9IjcyIiBsZXR0ZXItc3BhY2luZz0iLTIiPkJFU1RBPC90ZXh0PgogIDwvZz4KICA8ZyBmb250LWZhbWlseT0iSGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI3MDAiPgogICAgPHRleHQgeD0iMjEyIiB5PSI3MiIgZm9udC1zaXplPSI3MiIgZmlsbD0iI2Y1YTYyMyIgbGV0dGVyLXNwYWNpbmc9Ii0yIj5TPC90ZXh0PgogICAgPHRleHQgeD0iMjk4IiB5PSI3MiIgZm9udC1zaXplPSI3MiIgZmlsbD0iI2Y1YTYyMyIgbGV0dGVyLXNwYWNpbmc9Ii0yIj5MQVI8L3RleHQ+CiAgPC9nPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDI2OCw0OCkiPgogICAgPGNpcmNsZSBjeD0iMCIgY3k9IjAiIHI9IjIwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmNWE2MjMiIHN0cm9rZS13aWR0aD0iNyIvPgogICAgPGcgc3Ryb2tlPSIjZjVhNjIzIiBzdHJva2Utd2lkdGg9IjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCI+CiAgICAgIDxsaW5lIHgxPSIwIiB5MT0iLTMwIiB4Mj0iMCIgeTI9Ii0yNSIvPjxsaW5lIHgxPSIwIiB5MT0iMjUiIHgyPSIwIiB5Mj0iMzAiLz4KICAgICAgPGxpbmUgeDE9Ii0zMCIgeTE9IjAiIHgyPSItMjUiIHkyPSIwIi8+PGxpbmUgeDE9IjI1IiB5MT0iMCIgeDI9IjMwIiB5Mj0iMCIvPgogICAgICA8bGluZSB4MT0iLTIxIiB5MT0iLTIxIiB4Mj0iLTE4IiB5Mj0iLTE4Ii8+PGxpbmUgeDE9IjE4IiB5MT0iMTgiIHgyPSIyMSIgeTI9IjIxIi8+CiAgICAgIDxsaW5lIHgxPSItMjEiIHkxPSIyMSIgeDI9Ii0xOCIgeTI9IjE4Ii8+PGxpbmUgeDE9IjE4IiB5MT0iLTE4IiB4Mj0iMjEiIHkyPSItMjEiLz4KICAgIDwvZz4KICA8L2c+CiAgPHJlY3QgeD0iMCIgeT0iOTIiIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgZmlsbD0iI2Y1YTYyMyIvPgogIDx0ZXh0IHg9IjI0IiB5PSIxMDUiIGZvbnQtZmFtaWx5PSJIZWx2ZXRpY2EsQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMSIgZm9udC13ZWlnaHQ9IjUwMCIgZmlsbD0iIzBhMjQ3MiIgbGV0dGVyLXNwYWNpbmc9IjMuNCI+bHVtaWVyZSBzYW5zIGZhY3R1cmU8L3RleHQ+Cjwvc3ZnPgo=';

/** Proportions du logo — hauteur d'affichage 32px sur les documents. */
export const LOGO_RATIO = 520 / 128;
