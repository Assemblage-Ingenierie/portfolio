<?php
/**
 * Assemblage — PFG diag (LECTURE SEULE, TEMPORAIRE)
 * =================================================
 * À coller dans Code Snippets (Snippets → Add New → "Run snippet everywhere"),
 * activer, puis supprimer une fois le diagnostic terminé.
 *
 * Expose : GET /wp-json/assemblage/v1/pfg/diag/<id>
 * Renvoie le post_type + toutes les post-meta de la galerie Portfolio Filter
 * Gallery (id 2461 / 4904 / 7826) pour qu'on identifie la clé de meta des
 * items, le shape d'une tuile (image, titre, description, lien) et les filtres.
 *
 * Permission : current_user_can('edit_posts') — l'utilisateur Application
 * Password de l'app y a accès via Basic auth. AUCUNE écriture.
 */

// --- Étape A : registre des filtres PFG (libellé <-> id) -------------------
// Les libellés des filtres ne sont PAS dans la meta de galerie → ils vivent
// probablement dans une wp_option globale. Cette route (lecture seule) liste
// les options dont le nom ressemble à PFG pour qu'on identifie le registre.
add_action('rest_api_init', function () {
    register_rest_route('assemblage/v1', '/pfg/options', array(
        'methods' => 'GET',
        'permission_callback' => function () { return current_user_can('edit_posts'); },
        'callback' => function () {
            global $wpdb;
            $rows = $wpdb->get_results(
                "SELECT option_name FROM {$wpdb->options}
                 WHERE option_name LIKE 'awl%'
                    OR option_name LIKE '%pfg%'
                    OR option_name LIKE '%portfolio%filter%'
                    OR option_name LIKE '%filter%gallery%'",
                ARRAY_A
            );
            $out = array();
            foreach ($rows as $r) {
                $name = $r['option_name'];
                $val  = get_option($name);
                // On tronque les très grosses valeurs pour rester lisible.
                $json = wp_json_encode($val);
                $out[$name] = array(
                    'type'    => gettype($val),
                    'preview' => is_string($json) ? substr($json, 0, 4000) : null,
                );
            }
            return array('count' => count($out), 'options' => $out);
        },
    ));
});

add_action('rest_api_init', function () {
    register_rest_route('assemblage/v1', '/pfg/diag/(?P<id>\d+)', array(
        'methods'  => 'GET',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
        'args' => array(
            'id' => array(
                'validate_callback' => function ($p) { return is_numeric($p); },
            ),
        ),
        'callback' => function (WP_REST_Request $req) {
            $id = (int) $req['id'];

            // Garde-fou : on ne lit que les 3 galeries de pôle connues.
            $allow = array(2461, 4904, 7826);
            if (!in_array($id, $allow, true)) {
                return new WP_Error('forbidden_id', 'Id non autorisé pour le diag', array('status' => 403));
            }

            $post = get_post($id);
            if (!$post) {
                return new WP_Error('not_found', 'Post introuvable', array('status' => 404));
            }

            $raw = get_post_meta($id); // toutes les meta (valeurs sérialisées WP)

            // On décode chaque meta : WP renvoie un tableau de strings (souvent
            // une seule entrée), elles-mêmes parfois sérialisées (maybe_unserialize).
            $decoded = array();
            foreach ($raw as $key => $vals) {
                $decoded[$key] = array_map(function ($v) {
                    $u = maybe_unserialize($v);
                    return $u;
                }, $vals);
            }

            return array(
                'id'        => $id,
                'post_type' => get_post_type($id),
                'title'     => get_the_title($id),
                'meta_keys' => array_keys($raw),
                'meta'      => $decoded,
            );
        },
    ));
});
