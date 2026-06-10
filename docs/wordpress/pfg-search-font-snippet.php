<?php
/**
 * Assemblage — Police Geomanist Light du champ de recherche PFG
 * =============================================================
 * Variante PHP (pour Code Snippets GRATUIT, qui ne gère pas les snippets CSS).
 * Injecte la règle CSS dans le <head> de toutes les pages → couvre les 3 pages
 * de pôle (Structure / Développement / Environnement) d'un coup.
 *
 * À coller dans Code Snippets en snippet PHP « Run snippet everywhere », activer.
 * Réversible : désactiver le snippet.
 */
add_action('wp_head', function () {
    echo '<style id="assemblage-pfg-search-font">'
        . ".filtr_search,input[name=\"filtr-search\"]{font-family:'Geomanist Light','Geomanist','Open Sans',system-ui,sans-serif!important;font-weight:300!important;}"
        . ".filtr_search::placeholder,input[name=\"filtr-search\"]::placeholder{font-family:'Geomanist Light','Geomanist','Open Sans',system-ui,sans-serif!important;font-weight:300!important;opacity:1;}"
        . '</style>';
}, 99);
