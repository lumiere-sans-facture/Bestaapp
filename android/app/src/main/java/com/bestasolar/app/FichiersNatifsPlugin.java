package com.bestasolar.app;

import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Documents PDF produits par l'application (devis, factures, fiches de
 * dimensionnement), côté Android :
 *  - ouvrir : le PDF qu'on vient d'enregistrer s'ouvre aussitôt dans le
 *    lecteur du téléphone ;
 *  - envoyerWhatsApp : le PDF part dans la conversation WhatsApp du CLIENT,
 *    comme la relance, sans menu de partage ni recherche du contact.
 *
 * Côté JavaScript : src/lib/fichiers.js. Ce module est déclaré dans
 * MainActivity ; les paquets WhatsApp sont listés dans AndroidManifest.xml
 * (« queries »), sans quoi Android 11 et plus les cacherait.
 */
@CapacitorPlugin(name = "FichiersNatifs")
public class FichiersNatifsPlugin extends Plugin {

    /** WhatsApp, puis WhatsApp Business. */
    private static final String[] WHATSAPP = { "com.whatsapp", "com.whatsapp.w4b" };

    /** Adresse « content:// » lisible par une autre application (FileProvider). */
    private Uri uriPartageable(String chemin) {
        Uri source = Uri.parse(chemin);
        File fichier = "file".equals(source.getScheme()) ? new File(source.getPath()) : new File(chemin);
        Context contexte = getContext();
        return FileProvider.getUriForFile(contexte, contexte.getPackageName() + ".fileprovider", fichier);
    }

    @PluginMethod
    public void ouvrir(PluginCall call) {
        String chemin = call.getString("chemin");
        if (chemin == null || chemin.isEmpty()) {
            call.reject("Chemin du fichier manquant.", "CHEMIN_MANQUANT");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uriPartageable(chemin), call.getString("type", "application/pdf"));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Aucune application pour ouvrir ce fichier.", "AUCUNE_APPLICATION");
        } catch (Exception e) {
            call.reject("Ouverture du fichier impossible.", "ECHEC", e);
        }
    }

    private boolean installe(String paquet) {
        try {
            getContext().getPackageManager().getPackageInfo(paquet, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private Intent intentWhatsApp(String paquet, Uri uri, String type, String numero, String texte) {
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setPackage(paquet);
        intent.setType(type);
        intent.putExtra(Intent.EXTRA_STREAM, uri);
        if (texte != null && !texte.isEmpty()) intent.putExtra(Intent.EXTRA_TEXT, texte);
        // Conversation du client : identifiant WhatsApp « 22890000000@s.whatsapp.net »
        // (indicatif compris, chiffres seuls). Sans lui, WhatsApp demande le contact.
        if (numero != null && !numero.isEmpty()) intent.putExtra("jid", numero + "@s.whatsapp.net");
        intent.setClipData(ClipData.newRawUri("", uri));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return intent;
    }

    @PluginMethod
    public void envoyerWhatsApp(PluginCall call) {
        String chemin = call.getString("chemin");
        if (chemin == null || chemin.isEmpty()) {
            call.reject("Chemin du fichier manquant.", "CHEMIN_MANQUANT");
            return;
        }
        try {
            Uri uri = uriPartageable(chemin);
            String type = call.getString("type", "application/pdf");
            String numero = call.getString("numero", "");
            String texte = call.getString("texte", "");
            List<Intent> intents = new ArrayList<>();
            for (String paquet : WHATSAPP) {
                if (installe(paquet)) intents.add(intentWhatsApp(paquet, uri, type, numero, texte));
            }
            if (intents.isEmpty()) {
                call.reject("WhatsApp n'est pas installé.", "WHATSAPP_ABSENT");
                return;
            }
            Intent lancement = intents.get(0);
            if (intents.size() > 1) {
                // WhatsApp ET WhatsApp Business : on laisse choisir lequel.
                lancement = Intent.createChooser(intents.get(0), "Envoyer avec");
                lancement.putExtra(Intent.EXTRA_INITIAL_INTENTS, intents.subList(1, intents.size()).toArray(new Intent[0]));
            }
            getActivity().startActivity(lancement);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("WhatsApp n'est pas installé.", "WHATSAPP_ABSENT");
        } catch (Exception e) {
            call.reject("Envoi WhatsApp impossible.", "ECHEC", e);
        }
    }
}
