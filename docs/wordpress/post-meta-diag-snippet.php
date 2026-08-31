<?php
/**
 * DIAGNOSTIC (lecture seule) — liste les meta d'un article.
 *
 * But : trouver la clé de meta que le thème « architecturer » utilise pour la
 * mise en page d'un article (avec sidebar / pleine largeur). Les metas de thème
 * ne sont pas enregistrées pour l'API REST, donc invisibles autrement.
 *
 * INSTALLATION : Code Snippets → Add New → coller → Activer.
 *
 * USAGE :
 *   GET /wp-json/assemblage/v1/post-meta/9099     ← article QUI A le menu
 *   GET /wp-json/assemblage/v1/post-meta/14651    ← article SANS le menu
 * Comparer les deux : la clé qui diffère est celle à écrire à l'export.
 *
 * Sécurité : lecture seule, réservé aux utilisateurs pouvant éditer les
 * articles. Les valeurs sont tronquées à 200 caractères. À DÉSACTIVER une fois
 * la clé trouvée — il n'a pas vocation à rester en production.
 */
add_action('rest_api_init', function () {
    register_rest_route('assemblage/v1', '/post-meta/(?P<id>\d+)', array(
        'methods'  => 'GET',
        'permission_callback' => function () { return current_user_can('edit_posts'); },
        'callback' => function (WP_REST_Request $req) {
            $id = (int) $req['id'];
            if (get_post_status($id) === false) {
                return new WP_Error('not_found', 'Article introuvable', array('status' => 404));
            }
            $all = get_post_meta($id);
            $out = array();
            foreach ($all as $key => $values) {
                // On ecarte le gros payload Elementor, inutile ici.
                if ($key === '_elementor_data') { $out[$key] = '[tronque]'; continue; }
                $v = is_array($values) && count($values) === 1 ? $values[0] : $values;
                if (!is_scalar($v)) { $v = wp_json_encode($v); }
                $out[$key] = mb_substr((string) $v, 0, 200);
            }
            ksort($out);
            return array(
                'id'       => $id,
                'title'    => get_the_title($id),
                'template' => get_page_template_slug($id),
                'count'    => count($out),
                'meta'     => $out,
            );
        },
    ));
});

/**
 * DIAGNOSTIC (lecture seule) — reglages du thème (Kirki / Customizer).
 *
 * USAGE : GET /wp-json/assemblage/v1/theme-mods
 *
 * But : reperer le reglage GLOBAL de mise en page des articles seuls
 * (avec sidebar / pleine largeur) dans les theme_mods du thème
 * « architecturer ». Permet de savoir quelle entree du Customizer changer,
 * plutot que de la chercher a l'aveugle.
 *
 * Le filtre `q` restreint aux cles contenant un mot : par ex.
 *   GET /wp-json/assemblage/v1/theme-mods?q=sidebar
 */
add_action('rest_api_init', function () {
    register_rest_route('assemblage/v1', '/theme-mods', array(
        'methods'  => 'GET',
        'permission_callback' => function () { return current_user_can('edit_posts'); },
        'callback' => function (WP_REST_Request $req) {
            $q    = (string) $req->get_param('q');
            $mods = get_theme_mods();
            if (!is_array($mods)) $mods = array();
            $out = array();
            foreach ($mods as $key => $val) {
                if ($q !== '' && stripos((string) $key, $q) === false) continue;
                if (!is_scalar($val)) { $val = wp_json_encode($val); }
                $out[$key] = mb_substr((string) $val, 0, 200);
            }
            ksort($out);
            return array(
                'theme'      => get_stylesheet(),
                'total_mods' => count($mods),
                'returned'   => count($out),
                'mods'       => $out,
            );
        },
    ));
});
