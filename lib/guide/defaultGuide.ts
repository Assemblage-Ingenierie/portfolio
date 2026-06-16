/**
 * Contenu par défaut du Guide d'utilisation du portfolio.
 *
 * Ce markdown est servi tel quel tant qu'un admin n'a pas enregistré de version
 * personnalisée dans la table Supabase `portfolio_guide` (cf. `/api/guide`).
 * Dès qu'un admin sauvegarde, c'est le contenu Supabase qui prime — ce fichier
 * reste le « fallback » de référence (et la base éditoriale du guide).
 */
export const DEFAULT_GUIDE_MARKDOWN = `# Guide d'utilisation du portfolio

Bienvenue sur l'application **Portfolio d'Assemblage ingénierie**. Cet outil interne centralise toutes nos références projets et permet de produire des documents (fiches PDF, portfolios, tableaux) et de publier les références sur le site internet — le tout à partir d'une **source de données unique**.

Ce guide présente les principales fonctionnalités. Il est consultable par tous et peut être mis à jour par un administrateur.

---

## 1. Une seule donnée, plus de doublons

Toutes les informations d'un projet (nom, maître d'ouvrage, programme, budget, photos, description…) sont stockées **une seule fois**, dans **Airtable**. L'application lit cette source unique.

Concrètement :

- **Fini les doublons** : il n'existe plus dix versions d'une même fiche de référence qui se baladent sur les serveurs et dans les boîtes mail. Il y a *une* donnée, et tout le monde travaille dessus.
- **Mise à jour propagée partout** : si vous corrigez le budget ou le maître d'ouvrage d'un projet, la correction se répercute automatiquement dans la fiche PDF, dans le portfolio, dans le tableau de références **et** sur le site internet la prochaine fois qu'ils sont générés.
- **Cohérence garantie** : un projet présenté dans un appel d'offres affiche exactement les mêmes chiffres que celui publié sur le site.

> En résumé : on saisit l'information au bon endroit (Airtable), une fois, et l'application se charge de la mettre en forme partout où on en a besoin.

---

## 2. La page d'accueil et les filtres

La page d'accueil affiche **toutes les références** sous forme de grille (vignettes) ou de liste (bouton ⊞ / ☰ en haut à droite de la barre de recherche).

### La recherche

Le champ de recherche en haut filtre en temps réel sur le nom du projet, le maître d'ouvrage, l'adresse, le programme, les mots-clés, etc.

### Les filtres

Sous la barre de recherche, plusieurs filtres permettent d'affiner l'affichage :

- **Pôle** — STR (structure), ENV (environnement), DEV (développement)
- **Statut** — Livré, Concours, En chantier, En pause, En étude, En consultation
- **Type** — Neuf / Réhabilitation
- **Matériaux**
- **Année de livraison** — curseur à deux poignées (min / max)
- **Programme** — logements, équipements, bureaux, etc.

**Comment se combinent les filtres :**

- **Aucune valeur cochée** → tous les projets s'affichent.
- **Une valeur cochée** → seuls les projets qui contiennent cette valeur.
- **Plusieurs valeurs cochées** → seuls les projets qui contiennent **toutes** les valeurs sélectionnées (logique « ET »).

Le bouton **× Réinitialiser** (qui apparaît dès qu'un filtre est actif) remet tout à zéro.

### Le panneau « État de publication »

À gauche, le panneau **État de publication** classe les fiches selon leur avancement éditorial : *Pas faite*, *En cours*, *En attente de validation*, *Prête pour publication*. Cliquez sur une catégorie pour filtrer les fiches concernées, ou dépliez-la (flèche ▸) pour accéder directement aux projets de cette catégorie.

---

## 3. Mettre en page une fiche de référence

Cliquez sur un projet pour ouvrir sa **fiche**. L'aperçu affiché à l'écran est **exactement** le PDF qui sera téléchargé.

### Le choix du template

Deux mises en page sont proposées (sélecteur **Template**, visible pour les admins) :

- **Str-Env** — mise en page libre pour les projets structure / environnement.
- **Dev** — mise en page dédiée au pôle Développement.

> Le template est en général choisi automatiquement selon le pôle du projet. Vous n'avez à y toucher que dans des cas particuliers.

### La barre latérale de mise en page (templates Str-Env et Dev)

Pour ces deux templates, une **barre latérale gauche** donne accès à tous les réglages de mise en page, organisés en sections dépliables :

- **Mise en page typographique** — tailles de police du titre, du statut, de la description ; réglages du **bandeau** (les libellés et valeurs : MOA, Architecte, Budget…), espacements, sauts de ligne dans les cellules, activation / désactivation de certains champs.
- **Photo principale** — taille et position.
- **Texte de description** — répartition du texte.
- **Photos additionnelles** — ajout, taille, recadrage de photos secondaires.
- **Certifications**.
- **Prestation Assemblage** (template Dev uniquement).

Le bouton **Recadrer les photos** active un mode où vous repositionnez le cadrage de chaque image directement à la souris.

### Sauvegarder

Le bouton **Sauvegarder la mise en page** enregistre vos réglages (ils sont stockés dans Airtable et réutilisés à chaque réouverture). Si vous quittez la fiche sans sauvegarder, l'application vous prévient.

### Télécharger le PDF

Le bouton **Télécharger PDF** génère le document A4 final, prêt à être inséré dans un dossier.

---

## 4. Le menu « Éditer les champs »

Le bouton **Éditer les champs** (dans la barre latérale ou la barre du haut) ouvre le formulaire d'édition des **données** du projet — à distinguer de la mise en page.

C'est ici que vous modifiez :

- le **nom** du projet, le maître d'ouvrage, l'architecte, le mandataire, les BET associés, l'entreprise, le bailleur ;
- le **programme** (principal et secondaire), la mission AI, le pôle, le statut, le type (neuf / réhab) ;
- le **budget**, la **surface**, le **lieu**, l'**année** ;
- les **matériaux**, les **certifications**, les **mots-clés** ;
- la **description du projet** (éditeur de texte enrichi : gras, italique, listes, liens) ;
- la **Prestation Assemblage**.

> ⚠ Certains champs sont **calculés automatiquement** par Airtable (le *Pitch*, les *Chiffres clefs*, le *Slug*). Ils sont affichés en lecture seule : pour les changer, il faut modifier les champs source.

Toute modification enregistrée ici met à jour la **donnée unique** — et donc se répercute partout (cf. point 1).

---

## 5. L'export WordPress (site internet)

Chaque fiche peut être publiée sur le site **assemblage.net**. L'accès se fait via le bouton **Edition WordPress** de la fiche, qui ouvre une page d'aperçu dédiée.

### L'aperçu

La page WordPress affiche un aperçu fidèle de ce que donnera la référence sur le site. Une barre latérale permet de régler la typographie, les espacements, le choix et le cadrage des photos, l'ordre de la galerie, etc. Le bouton admin **Appliquer les paramètres par défaut WordPress** applique d'un coup la mise en forme validée par la maison.

### Le workflow de publication (important)

L'export ne touche **jamais** à un article existant sur le site. Le principe :

1. **Export WP** → crée un **nouveau brouillon** dans WordPress. Vous pouvez relancer l'export autant de fois que nécessaire ; chaque export crée un nouveau brouillon (les anciens sont à supprimer manuellement dans WordPress).
2. **Vérification** → vous regardez le brouillon dans WordPress, vous itérez.
3. **Mettre à jour la production** (admins) → quand le brouillon est validé, ce bouton reporte le contenu sur l'article **publié** existant, en conservant son URL.

> Autrement dit : on ne risque jamais de casser ou de dépublier une référence en ligne par accident. La mise en production est une action explicite et séparée.

Le bouton **Voir sur le site** ouvre l'article en ligne.

---

## 6. Constituer un portfolio

Depuis la page d'accueil, le bouton **Constituer le portfolio** ouvre l'atelier de composition d'un portfolio multi-fiches.

Le principe en trois temps :

1. **Sélection** — vous filtrez et cochez les références à inclure (mêmes filtres que la page d'accueil).
2. **Ordre** — vous classez les fiches dans l'ordre voulu.
3. **Aperçu & export** — vous générez un **PDF unique** regroupant toutes les fiches sélectionnées, prêt à être joint à une candidature.

C'est l'outil à utiliser pour répondre à un appel d'offres : on assemble en quelques minutes un portfolio sur mesure à partir des références existantes.

---

## 7. Constituer un tableau de références

Le bouton **Constituer le tableau** (page d'accueil) produit un **tableau récapitulatif** de références, souvent demandé dans les dossiers de candidature.

Le principe :

1. **Sélection** des références.
2. **Ordre** des lignes.
3. **Aperçu & export**.

Vous choisissez les **colonnes** à afficher (Projet, Architecte, MOA, Mission AI, Programme, Budget, Surface, Lieu, Année, Statut, Matériaux, Certification, et un **champ libre** personnalisable). Un mode **Str-Env** ou **Dev** pré-sélectionne un jeu de colonnes adapté.

- Le **champ libre** permet d'ajouter une colonne sur mesure (par exemple « Rôle d'Assemblage ») avec un texte propre à chaque référence.
- La pagination en paysage est **automatique** : si le tableau déborde, il est découpé proprement sur plusieurs pages, en-tête et pied de page répétés.

---

## 8. La page publique (extranet)

Une **page publique** présente une version filtrée et sécurisée des références, destinée à être partagée à l'extérieur (extranet). Elle reprend les mêmes filtres que la page d'accueil, mais :

- elle n'affiche que les fiches marquées comme **visibles au portfolio** ;
- les informations sont **assainies** (pas de données internes sensibles) ;
- elle se présente sous forme de **tableau paginé**.

C'est la vitrine que l'on peut donner à consulter à un partenaire ou un client sans lui ouvrir l'accès complet à l'outil interne.

---

## Besoin d'aide ?

Pour toute question, une suggestion d'amélioration ou un bug, contactez l'administrateur de l'application.
`;
