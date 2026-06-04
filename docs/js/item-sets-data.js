/**
 * item-sets-data.js — Définitions partagées des sets d'items.
 *
 * Expose `window.ITEM_SETS_DATA` (dict {set_id: {name, rarity, items, bonuses}})
 * pour usage côté gacha (tooltip stats), fiches, futurs modules.
 *
 * ⚠ DOIT RESTER SYNCHRONISÉ avec docs/js/hub-inventory.js (const ITEM_SETS).
 *    Lors de toute modification, mettre à jour les deux fichiers.
 *    À factoriser proprement plus tard : hub-inventory.js → lire window.ITEM_SETS_DATA.
 *
 * Format :
 *   ITEM_SETS_DATA[set_id] = {
 *     name: "Nom",
 *     rarity: "common|uncommon|rare|epic|legendary|mythic|unique|artifact|mastercraft|racial",
 *     items: ["item_id1", "item_id2", ...],
 *     bonuses: {
 *       "2": { stats: {strength: 5}, buff_mult: {strength: 1.25}, stats_all: 5, buff_mult_all: 1.15, special: "...", race_bonus: {...} },
 *       "4": { ... },
 *       ...
 *     }
 *   }
 */
(function(root){
  'use strict';

  var SETS = {
    "survie_de_rue": {"name": "Survie de Rue", "rarity": "common", "items": ["casque_chantier_renforce", "plastron_gardien_nuit", "chaussures_securite_lourdes"], "bonuses": {"3": {"stats": {"resistance": 3, "strength": 2}}}},
    "coursier_du_nexus": {"name": "Coursier du Nexus", "rarity": "common", "items": ["visiere_messager", "sac_coursier_bandouliere", "baskets_skyyart"], "bonuses": {"3": {"stats": {"speed": 3, "dexterity": 2}}}},
    "arnaqueur": {"name": "Arnaqueur", "rarity": "common", "items": ["lunettes_soleil_marque", "chevaliere_famille", "chaine_argent_terni"], "bonuses": {"3": {"stats": {"charisma": 3, "mana": 1}}}},
    "milicien": {"name": "Milicien", "rarity": "uncommon", "items": ["veste_kevlar_tactique", "brassard_protection_milice", "matraque_electrique_milice"], "bonuses": {"3": {"stats": {"resistance": 5, "strength": 3}}}},
    "hackeur": {"name": "Hackeur", "rarity": "uncommon", "items": ["gants_hackeur_poche", "smart_watch_nexus_v2", "analyseur_faiblesse_v1"], "bonuses": {"3": {"stats": {"intelligence": 5, "mana": 3}}}},
    "pulse_blanc": {"name": "Pulse Blanc", "rarity": "uncommon", "items": ["pulse_blanc_bandeau", "pulse_blanc_combinaison", "pulse_blanc_gants", "pulse_blanc_jambieres", "pulse_blanc_bottes", "pulse_blanc_reacteur"], "bonuses": {"2": {"stats": {"speed": 3}}, "4": {"stats": {"speed": 8}}, "6": {"stats": {"speed": 15}}}},
    "flux_indigo": {"name": "Flux Indigo", "rarity": "uncommon", "items": ["flux_indigo_couronne", "flux_indigo_robe", "flux_indigo_bracelet", "flux_indigo_pendentif", "flux_indigo_bague", "flux_indigo_orbe"], "bonuses": {"2": {"stats": {"mana": 3}}, "4": {"stats": {"mana": 8}}, "6": {"stats": {"mana": 15}}}},
    "neon_dore": {"name": "Néon Doré", "rarity": "uncommon", "items": ["neon_dore_masque", "neon_dore_veste", "neon_dore_bagues", "neon_dore_collier", "neon_dore_boucles", "neon_dore_cape"], "bonuses": {"2": {"stats": {"charisma": 3}}, "4": {"stats": {"charisma": 8}}, "6": {"stats": {"charisma": 15}}}},
    "prestige_digital": {"name": "Prestige Digital", "rarity": "uncommon", "items": ["prestige_digital_masque", "prestige_digital_costume", "prestige_digital_bagues", "prestige_digital_collier", "prestige_digital_bracelet", "prestige_digital_boucles"], "bonuses": {"2": {"stats": {"charisma": 3, "mana": 2}}, "4": {"stats": {"charisma": 7, "mana": 5}}, "6": {"stats": {"charisma": 12, "mana": 10}}}},
    "circuit_rouge": {"name": "Circuit Rouge", "rarity": "rare", "items": ["circuit_rouge_casque", "circuit_rouge_plastron", "circuit_rouge_gantelets", "circuit_rouge_jambieres", "circuit_rouge_bottes", "circuit_rouge_marteau"], "bonuses": {"2": {"stats": {"strength": 5}}, "4": {"stats": {"strength": 12}}, "6": {"stats": {"strength": 22}}}},
    "filament_cyan": {"name": "Filament Cyan", "rarity": "rare", "items": ["filament_cyan_capuche", "filament_cyan_veste", "filament_cyan_gants", "filament_cyan_brassards", "filament_cyan_bottes", "filament_cyan_dagues"], "bonuses": {"2": {"stats": {"dexterity": 5}}, "4": {"stats": {"dexterity": 12}}, "6": {"stats": {"dexterity": 22}}}},
    "reseau_violet": {"name": "Réseau Violet", "rarity": "rare", "items": ["reseau_violet_diademe", "reseau_violet_manteau", "reseau_violet_interface", "reseau_violet_monocle", "reseau_violet_anneau", "reseau_violet_codex"], "bonuses": {"2": {"stats": {"intelligence": 5}}, "4": {"stats": {"intelligence": 12}}, "6": {"stats": {"intelligence": 22}}}},
    "bunker_gris": {"name": "Bunker Gris", "rarity": "rare", "items": ["bunker_gris_heaume", "bunker_gris_cuirasse", "bunker_gris_gantelets", "bunker_gris_jambieres", "bunker_gris_bottes", "bunker_gris_bouclier"], "bonuses": {"2": {"stats": {"resistance": 5}}, "4": {"stats": {"resistance": 12}}, "6": {"stats": {"resistance": 22}}}},
    "spectre_veloce": {"name": "Spectre Véloce", "rarity": "rare", "items": ["spectre_veloce_capuche", "spectre_veloce_combinaison", "spectre_veloce_gants", "spectre_veloce_bottes", "spectre_veloce_cape", "spectre_veloce_lames"], "bonuses": {"2": {"stats": {"dexterity": 4, "speed": 4}}, "4": {"stats": {"dexterity": 10, "speed": 10}}, "6": {"stats": {"dexterity": 18, "speed": 18}}}},
    "rempart_spectral": {"name": "Rempart Spectral", "rarity": "rare", "items": ["rempart_spectral_heaume", "rempart_spectral_armure", "rempart_spectral_bracelet", "rempart_spectral_amulette", "rempart_spectral_bague", "rempart_spectral_bouclier"], "bonuses": {"2": {"stats": {"mana": 4, "resistance": 4}}, "4": {"stats": {"mana": 10, "resistance": 10}}, "6": {"stats": {"mana": 18, "resistance": 18}}}},
    "sentinelle_hybride": {"name": "Sentinelle Hybride", "rarity": "rare", "items": ["sentinelle_hybride_casque", "sentinelle_hybride_armure", "sentinelle_hybride_brassards", "sentinelle_hybride_bottes", "sentinelle_hybride_cape", "sentinelle_hybride_bracelet", "sentinelle_hybride_lames"], "bonuses": {"2": {"stats": {"resistance": 3, "speed": 3, "dexterity": 3}}, "4": {"stats": {"resistance": 8, "speed": 8, "dexterity": 8}}, "7": {"stats": {"resistance": 15, "speed": 15, "dexterity": 15}}}},
    "harmonie_primaire": {"name": "Harmonie Primaire", "rarity": "rare", "items": ["harmonie_casque", "harmonie_plastron", "harmonie_gants", "harmonie_bottes", "harmonie_cape", "harmonie_collier", "harmonie_anneau", "harmonie_noyau"], "bonuses": {"2": {"stats_all": 2}, "4": {"stats_all": 5}, "6": {"stats_all": 10}, "8": {"stats_all": 18}}},
    "chrome_sauvage": {"name": "Chrome Sauvage", "rarity": "epic", "items": ["chrome_sauvage_casque", "chrome_sauvage_armure", "chrome_sauvage_brassards", "chrome_sauvage_gants", "chrome_sauvage_bottes", "chrome_sauvage_hache", "chrome_sauvage_griffes"], "bonuses": {"2": {"stats": {"strength": 8, "dexterity": 8}}, "4": {"stats": {"strength": 18, "dexterity": 18}}, "7": {"stats": {"strength": 30, "dexterity": 30}}}},
    "bastion_blinde": {"name": "Bastion Blindé", "rarity": "epic", "items": ["bastion_blinde_heaume", "bastion_blinde_cuirasse", "bastion_blinde_epaulieres", "bastion_blinde_gantelets", "bastion_blinde_jambieres", "bastion_blinde_bottes"], "bonuses": {"2": {"stats": {"strength": 8, "resistance": 8}}, "4": {"stats": {"strength": 18, "resistance": 18}}, "6": {"stats": {"strength": 30, "resistance": 30}}}},
    "synapse_arcane": {"name": "Synapse Arcane", "rarity": "epic", "items": ["synapse_arcane_diademe", "synapse_arcane_manteau", "synapse_arcane_gants", "synapse_arcane_bracelet", "synapse_arcane_anneau", "synapse_arcane_sceptre"], "bonuses": {"2": {"stats": {"intelligence": 8, "mana": 8}}, "4": {"stats": {"intelligence": 18, "mana": 18}}, "6": {"stats": {"intelligence": 30, "mana": 30}}}},
    "predateur_mecanique": {"name": "Prédateur Mécanique", "rarity": "epic", "items": ["predateur_meca_casque", "predateur_meca_armure", "predateur_meca_brassards", "predateur_meca_gants", "predateur_meca_bottes", "predateur_meca_cape", "predateur_meca_lames"], "bonuses": {"2": {"stats": {"strength": 5, "dexterity": 5, "speed": 5}}, "4": {"stats": {"strength": 12, "dexterity": 12, "speed": 12}}, "7": {"stats": {"strength": 22, "dexterity": 22, "speed": 22}}}},
    "conscience_nexus": {"name": "Conscience du Nexus", "rarity": "epic", "items": ["conscience_nexus_diademe", "conscience_nexus_robe", "conscience_nexus_gants", "conscience_nexus_bracelet", "conscience_nexus_collier", "conscience_nexus_anneau", "conscience_nexus_livre"], "bonuses": {"2": {"stats": {"intelligence": 5, "mana": 5, "charisma": 5}}, "4": {"stats": {"intelligence": 12, "mana": 12, "charisma": 12}}, "7": {"stats": {"intelligence": 22, "mana": 22, "charisma": 22}}}},
    "protocole_genesis": {"name": "Protocole Genesis", "rarity": "epic", "items": ["genesis_couronne", "genesis_armure", "genesis_gants", "genesis_bracelet", "genesis_jambieres", "genesis_bottes", "genesis_collier", "genesis_noyau"], "bonuses": {"2": {"stats_all": 3}, "4": {"stats_all": 8}, "6": {"stats_all": 15}, "8": {"stats_all": 25}}},
    "predateur_urbain": {"name": "Prédateur Urbain", "rarity": "rare", "items": ["casque_combat_spectre", "combinaison_furtive_ombre", "souliers_semelles_silence"], "bonuses": {"3": {"stats": {"dexterity": 10, "speed": 5}}}},
    "centurion_nexus": {"name": "Centurion du Nexus", "rarity": "rare", "items": ["armure_plaques_cinetiques", "jambieres_centurion_nexus", "generateur_bouclier_force"], "bonuses": {"3": {"stats": {"resistance": 10, "strength": 5}}}},
    "executeur": {"name": "Exécuteur", "rarity": "epic", "items": ["casque_executeur_nexus", "dagues_jumelles_assassin", "cape_dephasage"], "bonuses": {"3": {"stats": {"dexterity": 15, "intelligence": 10}}}},
    "titan": {"name": "Titan", "rarity": "epic", "items": ["poings_atlas", "exosquelette_jambes_titan", "fendoir_gravite"], "bonuses": {"3": {"stats": {"strength": 15, "resistance": 10}}}},
    "velvet_court": {"name": "Velvet Court", "rarity": "legendary", "items": ["velvet_courts_diadem", "velvet_courts_pendant", "velvet_courts_signet"], "bonuses": {"2": {"stats": {"charisma": 20}}, "3": {"stats": {"charisma": 45}, "buff_mult": {"charisma": 1.3}}}},
    "phantom_edge": {"name": "Phantom Edge", "rarity": "legendary", "items": ["phantom_edges_cowl", "phantom_edges_bracers", "phantom_edges_stiletto"], "bonuses": {"2": {"stats": {"dexterity": 20}}, "3": {"stats": {"dexterity": 45}, "buff_mult": {"dexterity": 1.3}}}},
    "roi_loup": {"name": "Roi-Loup", "rarity": "legendary", "items": ["collier_roi_loup_blanc", "crocs_basilic_ombre", "anneau_chronos"], "bonuses": {"3": {"stats": {"strength": 18, "dexterity": 18}}}},
    "monarque": {"name": "Monarque", "rarity": "legendary", "items": ["couronne_monarque_dechu", "manteau_souverain_ombres", "masque_divinite_mecanique"], "bonuses": {"3": {"stats": {"mana": 18, "charisma": 18}}}},
    "iron_vanguard": {"name": "Iron Vanguard", "rarity": "mythic", "items": ["iron_vanguards_helm", "iron_vanguards_fists", "iron_vanguards_warhammer", "iron_vanguards_chestplate", "iron_vanguards_greaves", "iron_vanguards_chains"], "bonuses": {"2": {"stats": {"strength": 25}}, "4": {"stats": {"strength": 55}, "buff_mult": {"strength": 1.25}}, "6": {"stats": {"strength": 90, "resistance": 30}, "buff_mult": {"strength": 1.4}}}},
    "nexus_core": {"name": "Nexus", "rarity": "mythic", "items": ["original_fragment_core_nexus", "fragment_of_reality", "ia_conscience_gaia"], "bonuses": {"2": {"stats": {"mana": 25}}, "3": {"stats_all": 15}}},
    "principle": {"name": "The Principle", "rarity": "unique", "items": ["wings_principle_speed", "dagger_principle_reality", "mask_principle_attraction", "book_principle_savant"], "bonuses": {"2": {"stats_all": 15}, "4": {"stats_all": 40, "buff_mult_all": 1.15}}},
    "time_paradox": {"name": "Time Paradox", "rarity": "unique", "items": ["time_paradox_ring", "time_paradox_watch"], "bonuses": {"2": {"stats": {"speed": 25, "dexterity": 25}}}},
    "hero_of_the_era": {"name": "Hero of the Era", "rarity": "artifact", "items": ["hero_eras_crown", "hero_eras_mantle", "hero_eras_gauntlets", "hero_eras_greaves", "hero_eras_blade", "hero_eras_cloak", "hero_eras_ring", "hero_eras_bracers", "hero_eras_pendant"], "bonuses": {"2": {"stats_all": 15}, "4": {"stats_all": 35}, "6": {"stats_all": 60, "buff_mult_all": 1.2}, "9": {"stats_all": 110, "buff_mult_all": 1.4, "nerf_reduction": 0.25}}},
    "destiny": {"name": "Destiny", "rarity": "artifact", "items": ["destinys_gauntelet", "destinys_chains", "destinys_cuffs"], "bonuses": {"2": {"stats_all": 25}, "3": {"stats_all": 60}}},
    "origin": {"name": "Origin", "rarity": "artifact", "items": ["origins_chestplate", "origins_ring"], "bonuses": {"2": {"stats": {"mana": 50, "intelligence": 25}}}},
    "old_chaos": {"name": "Old Chaos", "rarity": "artifact", "items": ["old_chaos_mask", "old_chaos_ring"], "bonuses": {"2": {"stats": {"strength": 50, "mana": 25}}}},
    "equalizer_set": {"name": "Equalizer", "rarity": "artifact", "items": ["equalizer", "fragment_of_reality", "birth_of_the_imaginary"], "bonuses": {"2": {"special": "equalize_to_highest"}, "3": {"special": "equalize_to_highest_plus_10pct"}}},
    "baldun": {"name": "Baldun", "rarity": "mastercraft", "items": ["balduns_crown", "balduns_chestplate", "balduns_ring", "balduns_chivalery", "balduns_gauntelet", "balduns_chains", "balduns_cape", "balduns_executionner", "balduns_claws", "balduns_bracelet", "balduns_god_shoes", "great_balduns_core"], "bonuses": {"4": {"stats_all": 120}, "12": {"stats_all": 300, "buff_mult_all": 1.5}}},
    "valkyrie_set": {
      name: "Set Valkyrie",
      rarity: "racial",
      items: ["heaume_valkyrie","plastron_valkyrie","brassards_valkyrie","tunique_valkyrie",
              "cuissardes_valkyrie","bottes_valkyrie","gantelets_valkyrie","lame_valkyrie"],
      bonuses: {
        "8": {
          stats: {strength:60, resistance:60, charisma:60, mana:60},
          race_bonus: {race:"Valkyrie", stats:{strength:120, resistance:120, charisma:120, mana:120}}
        }
      }
    }
  };

  root.ITEM_SETS_DATA = SETS;
})(window);
