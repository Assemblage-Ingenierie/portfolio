<?php
/**
 * Assemblage — PFG restore (rollback d'une galerie de pôle)
 * =========================================================
 * À coller dans Code Snippets (« Run snippet everywhere »), activer.
 * Permet de restaurer INTÉGRALEMENT la configuration d'une galerie Portfolio
 * Filter Gallery à partir d'un snapshot JSON (cf. docs/wordpress/backups/).
 *
 * Toute la config d'une galerie (tuiles + filtres + réglages) tient dans une
 * seule post-meta `awl_filter_gallery{ID}`. Restaurer = réécrire cette meta
 * avec le snapshot. Rollback en quelques secondes.
 *
 * Endpoint : POST /wp-json/assemblage/v1/pfg/restore
 *   body JSON : { galleryId:int, config:object }   (config = champ "config" du snapshot)
 *   réponse   : { restored:bool, total:int }
 *
 * Sécurité : capability edit_posts + allowlist [2461,4904,7826] + vérif CPT +
 * `config` doit être un objet contenant au moins `image-ids`.
 */

add_action('rest_api_init', function () {
    register_rest_route('assemblage/v1', '/pfg/restore', array(
        'methods'  => 'POST',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
        'callback' => 'assemblage_pfg_restore_callback',
    ));
});

if (!function_exists('assemblage_pfg_restore_callback')) {
    function assemblage_pfg_restore_callback(WP_REST_Request $req) {
        $galleryId = (int) $req->get_param('galleryId');
        $config    = $req->get_param('config');

        $allow = array(2461, 4904, 7826);
        if (!in_array($galleryId, $allow, true)) {
            return new WP_Error('forbidden_gallery', 'Galerie non autorisée', array('status' => 403));
        }
        if (get_post_type($galleryId) !== 'awl_filter_gallery') {
            return new WP_Error('bad_gallery', 'La cible n\'est pas une galerie PFG', array('status' => 400));
        }
        // L'API REST décode le JSON en array associatif.
        if (!is_array($config) || !isset($config['image-ids'])) {
            return new WP_Error('bad_config', 'config invalide (image-ids manquant)', array('status' => 400));
        }

        $metaKey = 'awl_filter_gallery' . $galleryId;
        update_post_meta($galleryId, $metaKey, $config);
        clean_post_cache($galleryId);

        return array(
            'restored' => true,
            'total'    => is_array($config['image-ids']) ? count($config['image-ids']) : 0,
        );
    }
}
