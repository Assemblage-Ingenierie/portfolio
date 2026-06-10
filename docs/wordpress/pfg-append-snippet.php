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
        if (!isset($g['image-ids'])   || !is_array($g['image-ids']))   $g['image-ids']   = array();
        if (!isset($g['image_title']) || !is_array($g['image_title'])) $g['image_title'] = array();
        if (!isset($g['image-desc'])  || !is_array($g['image-desc']))  $g['image-desc']  = array();
        if (!isset($g['slide-type'])  || !is_array($g['slide-type']))  $g['slide-type']  = array();
        if (!isset($g['image-link'])  || !is_array($g['image-link']))  $g['image-link']  = array();

        $idStr = (string) $imageId;

        // 2. Idempotence : déjà présent par lien OU par image id → ne rien faire.
        $linkExists = in_array($link, array_values($g['image-link']), true);
        $idExists   = in_array($idStr, array_map('strval', $g['image-ids']), true);
        if ($linkExists || $idExists) {
            return array(
                'added'  => false,
                'reason' => 'duplicate',
                'total'  => count($g['image-ids']),
            );
        }

        // 3. Append : on pousse dans les listes parallèles (même position) et on
        //    renseigne les maps par id. Pas de filtre → tuile visible en « all ».
        $g['image-ids'][]   = $idStr;
        $g['image_title'][] = $title;
        $g['image-desc'][]  = $description;
        $g['slide-type'][$idStr] = 'image';
        $g['image-link'][$idStr] = $link;

        $ok = update_post_meta($galleryId, $metaKey, $g);
        if ($ok === false) {
            // update_post_meta renvoie false si la valeur est identique — ici on
            // a forcément modifié le tableau, donc false = vraie erreur.
            return new WP_Error('save_failed', 'Échec écriture meta', array('status' => 500));
        }

        // Purge le cache objet du post galerie (le rendu front peut rester caché
        // par un plugin de cache de page — non géré ici).
        clean_post_cache($galleryId);

        return array(
            'added' => true,
            'total' => count($g['image-ids']),
        );
    }
}
