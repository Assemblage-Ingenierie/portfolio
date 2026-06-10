<?php
/**
 * Assemblage — PFG append (ajout d'une tuile à une galerie de pôle)
 * =================================================================
 * À coller dans Code Snippets (Snippets → Add New → "Run snippet everywhere"),
 * puis activer. C'est l'endpoint appelé par l'app portfolio pour ajouter
 * automatiquement un projet sur sa page de pôle.
 *
 * Plugin cible : Portfolio Filter Gallery Premium (CPT `awl_filter_gallery`).
 * Les items d'une galerie d'id N sont stockés dans la post-meta
 * `awl_filter_gallery{N}` : un grand tableau associatif contenant notamment :
 *   - 'image-ids'   : liste ordonnée d'IDs d'attachments (définit l'ordre)
 *   - 'image_title' : liste parallèle (par position) des titres
 *   - 'image-desc'  : liste parallèle (par position) des descriptions (= lieu)
 *   - 'slide-type'  : map { imageId => 'image' }
 *   - 'image-link'  : map { imageId => url }
 *   - 'filters'     : map { imageId => [filterIds] }  (facultatif : sans filtre,
 *                     la tuile apparaît dans la vue « all » de la galerie)
 *   - + de nombreux réglages de style (préservés tels quels).
 *
 * Endpoint : POST /wp-json/assemblage/v1/pfg/append
 *   body JSON : { galleryId:int, imageId:int, title:string, description:string, link:string }
 *   réponse   : { added:bool, reason?:string, total?:int }
 *
 * Sécurité :
 *   - permission current_user_can('edit_posts') (l'app s'auth via Application Password)
 *   - allowlist stricte des galeries de pôle [2461, 4904, 7826]
 *   - vérifie le post_type `awl_filter_gallery`
 *   - idempotence : si le `link` (ou l'`imageId`) est déjà présent → ne rien faire
 *   - sanitisation de toutes les entrées
 */

/**
 * POST /wp-json/assemblage/v1/pfg/add-categories
 *   body JSON : { labels: string[] }
 *   réponse   : { map: { "<id>": "<label>" }, added: string[] }
 *
 * Ajoute (append-only) des catégories de filtre dans l'option globale
 * `awl_portfolio_filter_gallery_categories` (tableau plat ; l'id d'un filtre =
 * son index). On n'insère JAMAIS au milieu et on ne réordonne/supprime JAMAIS
 * (sinon les ids des filtres déjà assignés seraient décalés) : on pousse en fin,
 * en sautant les libellés déjà présents (comparaison insensible casse/accents).
 * Renvoie la map id→libellé complète pour que l'app fige son mapping.
 */
add_action('rest_api_init', function () {
    register_rest_route('assemblage/v1', '/pfg/add-categories', array(
        'methods'  => 'POST',
        'permission_callback' => function () { return current_user_can('edit_posts'); },
        'callback' => function (WP_REST_Request $req) {
            $labels = $req->get_param('labels');
            if (!is_array($labels)) {
                return new WP_Error('bad_labels', 'labels (array) attendu', array('status' => 400));
            }
            $cats = get_option('awl_portfolio_filter_gallery_categories');
            if (!is_array($cats)) {
                return new WP_Error('no_registry', 'Registre de catégories introuvable', array('status' => 500));
            }
            $norm = function ($s) {
                $s = remove_accents((string) $s);
                return strtolower(trim($s));
            };
            $existing = array();
            foreach ($cats as $c) { $existing[$norm($c)] = true; }

            $added = array();
            foreach ($labels as $raw) {
                $label = sanitize_text_field((string) $raw);
                if ($label === '') continue;
                $k = $norm($label);
                if (isset($existing[$k])) continue;     // déjà présent → skip
                $cats[] = $label;                        // append-only
                $existing[$k] = true;
                $added[] = $label;
            }
            if (!empty($added)) {
                update_option('awl_portfolio_filter_gallery_categories', $cats);
            }

            $map = array();
            foreach ($cats as $i => $c) { $map[(string) $i] = $c; }
            return array('map' => $map, 'added' => $added);
        },
    ));
});

/**
 * POST /wp-json/assemblage/v1/pfg/gallery-flags
 *   body JSON : { galleryId:int, logic?: 'and'|'or' }
 *   réponse   : { ok:true, multi_filters, multi_filters_logic }
 *
 * Active la multi-sélection des filtres en logique ET (par défaut) sur une
 * galerie : `multi_filters = '1'` + `multi_filters_logic = 'and'`. Ne touche à
 * aucune autre clé de la meta. Allowlist + capability.
 */
add_action('rest_api_init', function () {
    register_rest_route('assemblage/v1', '/pfg/gallery-flags', array(
        'methods'  => 'POST',
        'permission_callback' => function () { return current_user_can('edit_posts'); },
        'callback' => function (WP_REST_Request $req) {
            $galleryId = (int) $req->get_param('galleryId');
            $logic     = $req->get_param('logic');
            $logic     = ($logic === 'or') ? 'or' : 'and';

            $allow = array(2461, 4904, 7826);
            if (!in_array($galleryId, $allow, true)) {
                return new WP_Error('forbidden_gallery', 'Galerie non autorisée', array('status' => 403));
            }
            $metaKey = 'awl_filter_gallery' . $galleryId;
            $g = get_post_meta($galleryId, $metaKey, true);
            if (!is_array($g)) {
                return new WP_Error('no_meta', 'Meta galerie introuvable', array('status' => 500));
            }
            $g['multi_filters']       = '1';
            $g['multi_filters_logic'] = $logic;
            update_post_meta($galleryId, $metaKey, $g);
            clean_post_cache($galleryId);
            return array('ok' => true, 'multi_filters' => '1', 'multi_filters_logic' => $logic);
        },
    ));
});

add_action('rest_api_init', function () {
    register_rest_route('assemblage/v1', '/pfg/append', array(
        'methods'  => 'POST',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
        'callback' => 'assemblage_pfg_append_callback',
    ));
});

if (!function_exists('assemblage_pfg_append_callback')) {
    function assemblage_pfg_append_callback(WP_REST_Request $req) {
        $galleryId   = (int) $req->get_param('galleryId');
        $imageId     = (int) $req->get_param('imageId');
        $title       = sanitize_text_field((string) $req->get_param('title'));
        $description = sanitize_text_field((string) $req->get_param('description'));
        $link        = esc_url_raw((string) $req->get_param('link'));
        // Filtres PFG (ids globaux, ex. 1=Acier, 6=Neuf, 13=Espace public) :
        // l'app les résout depuis les attributs du projet. Facultatif.
        $filtersIn   = $req->get_param('filters');
        $filterIds   = array();
        if (is_array($filtersIn)) {
            foreach ($filtersIn as $f) {
                $fi = (int) $f;
                if ($fi > 0 && !in_array($fi, $filterIds, true)) $filterIds[] = $fi;
            }
        }

        // 1. Garde-fous.
        $allow = array(2461, 4904, 7826);
        if (!in_array($galleryId, $allow, true)) {
            return new WP_Error('forbidden_gallery', 'Galerie non autorisée', array('status' => 403));
        }
        if (get_post_type($galleryId) !== 'awl_filter_gallery') {
            return new WP_Error('bad_gallery', 'La cible n\'est pas une galerie PFG', array('status' => 400));
        }
        if ($imageId <= 0 || get_post_type($imageId) !== 'attachment') {
            return new WP_Error('bad_image', 'imageId invalide (attachment attendu)', array('status' => 400));
        }
        if (empty($link)) {
            return new WP_Error('bad_link', 'link manquant', array('status' => 400));
        }
        if ($title === '') {
            return new WP_Error('bad_title', 'title manquant', array('status' => 400));
        }

        // Le thème PFG affiche le `post_title` de l'attachment (PAS le champ
        // image_title de la galerie). Les tuiles curées ont un attachment dont
        // le titre = nom du projet ; on aligne donc le titre de l'image de
        // couverture sur le nom du projet (sinon on verrait « slug-cover »).
        // Fait avant la vérif d'idempotence pour qu'un re-clic répare un titre.
        $current = get_post($imageId);
        if ($current && $current->post_title !== $title) {
            wp_update_post(array('ID' => $imageId, 'post_title' => $title));
        }

        $metaKey = 'awl_filter_gallery' . $galleryId;
        $g = get_post_meta($galleryId, $metaKey, true);
        if (!is_array($g)) {
            return new WP_Error('no_meta', 'Meta galerie introuvable (' . $metaKey . ')', array('status' => 500));
        }

        // Normalise les sous-structures attendues.
        if (!isset($g['image-ids'])    || !is_array($g['image-ids']))    $g['image-ids']    = array();
        if (!isset($g['image_title'])  || !is_array($g['image_title']))  $g['image_title']  = array();
        if (!isset($g['image-desc'])   || !is_array($g['image-desc']))   $g['image-desc']   = array();
        if (!isset($g['slide-type'])   || !is_array($g['slide-type']))   $g['slide-type']   = array();
        if (!isset($g['image-link'])   || !is_array($g['image-link']))   $g['image-link']   = array();
        if (!isset($g['filters'])      || !is_array($g['filters']))      $g['filters']      = array();
        if (!isset($g['filter-image']) || !is_array($g['filter-image'])) $g['filter-image'] = array();

        $idStr = (string) $imageId;

        // 2. Filtres PFG : on (re)pose l'assignation de CETTE image AVANT la vérif
        //    d'idempotence → un re-clic répare/MAJ les filtres d'une tuile existante.
        //    `filters[idStr] = [ids]` + `filter-image[fid][] = idStr` (sans doublon).
        //    `filters` vide => on ne touche pas (la tuile reste sous « all »).
        if (!empty($filterIds)) {
            $g['filters'][$idStr] = array_map('strval', $filterIds);
            foreach ($filterIds as $fid) {
                $fidStr = (string) $fid;
                if (!isset($g['filter-image'][$fidStr]) || !is_array($g['filter-image'][$fidStr])) {
                    $g['filter-image'][$fidStr] = array();
                }
                if (!in_array($idStr, array_map('strval', $g['filter-image'][$fidStr]), true)) {
                    $g['filter-image'][$fidStr][] = $idStr;
                }
            }
        }

        // 3. Idempotence côté TUILE : si déjà présente (par lien ou image id), on
        //    ne ré-ajoute pas dans les listes — mais on sauve quand même (les
        //    filtres ci-dessus / le titre ont pu changer).
        $linkExists = in_array($link, array_values($g['image-link']), true);
        $idExists   = in_array($idStr, array_map('strval', $g['image-ids']), true);
        $isDuplicate = ($linkExists || $idExists);

        if (!$isDuplicate) {
            // Append : listes parallèles (même position) + maps par id.
            $g['image-ids'][]   = $idStr;
            $g['image_title'][] = $title;
            $g['image-desc'][]  = $description;
            $g['slide-type'][$idStr] = 'image';
            $g['image-link'][$idStr] = $link;
        }

        // Sauvegarde unique (le titre de l'attachment a été géré via wp_update_post).
        // On n'erreur pas sur `false` : update_post_meta renvoie false si la valeur
        // est inchangée (cas possible d'un re-clic strictement identique).
        update_post_meta($galleryId, $metaKey, $g);

        // Purge le cache objet du post galerie (le rendu front peut rester caché
        // par un plugin de cache de page — non géré ici).
        clean_post_cache($galleryId);

        return array(
            'added'  => !$isDuplicate,
            'reason' => $isDuplicate ? 'duplicate' : null,
            'total'  => count($g['image-ids']),
        );
    }
}
