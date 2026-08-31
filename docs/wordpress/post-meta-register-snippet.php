<?php
/**
 * Enregistre la meta `post_layout` pour l'API REST.
 *
 * POURQUOI — WordPress IGNORE EN SILENCE toute meta envoyee dans le champ
 * `meta` d'une requete REST si sa cle n'est pas enregistree avec
 * `show_in_rest: true`. Aucune erreur n'est levee : la valeur disparait,
 * simplement. C'est le meme piege que pour les metas `_yoast_wpseo_*`.
 *
 * A QUOI CA SERT — `post_layout` est la meta du theme « architecturer »
 * (ThemeGoods), pilotee dans wp-admin par la metabox « Post Options → Post
 * Layout ». Le theme n'a AUCUN reglage global pour la mise en page d'un article
 * seul : le Customizer ne couvre que les pages d'archive / categorie / tag.
 * Quand la meta est absente, le theme rend l'article en PLEINE LARGEUR, donc
 * sans le menu lateral.
 *
 * Tant que le portfolio creait des brouillons publies a la main, l'editeur
 * wp-admin ecrivait cette valeur au passage. Depuis que l'export publie
 * directement, plus personne ne l'ecrit — d'ou la regression du menu lateral.
 * Ce snippet permet a `/api/projet/[slug]/publish` de la poser lui-meme.
 *
 * VALEURS POSSIBLES (libelles exacts du menu, ce ne sont PAS des slugs) :
 *   « With Right Sidebar »  (defaut envoye par l'app)
 *   « With Left Sidebar »
 *   « Fullwidth »
 *
 * INSTALLATION : Code Snippets → Add New → coller → Activer (partout).
 * A GARDER ACTIF en permanence, contrairement au snippet de diagnostic.
 */
add_action('init', function () {
    register_post_meta('post', 'post_layout', array(
        'type'          => 'string',
        'single'        => true,
        'show_in_rest'  => true,
        'default'       => '',
        'description'   => 'Theme architecturer : mise en page de l article (Post Options).',
        // Seuls les comptes pouvant editer l article peuvent ecrire la valeur.
        // L Application Password utilise par le portfolio a ce droit.
        'auth_callback' => function ($allowed, $meta_key, $post_id) {
            return current_user_can('edit_post', $post_id);
        },
    ));
});
