-- Migration : Messagerie per-character (2026-05-21)
--
-- Wipe complet de l'ancien système (per-joueur) avant déploiement du
-- nouveau système (per-personnage).
--
-- À exécuter en remote AVANT de pousser la nouvelle messagerie.html :
--   cd worker
--   wrangler d1 execute jaharta-d1 --remote --file=migrations/2026-05-21_messagerie_per_character.sql
--
-- Pour tester en local d'abord (sandbox) :
--   wrangler d1 execute jaharta-d1 --local --file=migrations/2026-05-21_messagerie_per_character.sql
--
-- Rollback : aucun (données per-joueur supprimées). Le backup est dans la
-- branche git `backup-before-resync-2026-05-21` (état pré-resync) mais ne
-- contient PAS les data D1 — seulement le code. Si tu veux préserver les
-- friendships existantes, exporte-les d'abord :
--   wrangler d1 execute jaharta-d1 --remote \
--     --command="SELECT * FROM documents WHERE collection IN ('friendships','messages','friend_requests')" \
--     > backup_friendships_$(date +%Y%m%d).json

-- ─────────────────────────────────────────────────────────────────────────
-- Wipe des anciennes collections messagerie
-- ─────────────────────────────────────────────────────────────────────────
DELETE FROM documents WHERE collection = 'friendships';
DELETE FROM documents WHERE collection = 'messages';
DELETE FROM documents WHERE collection = 'friend_requests';

-- ─────────────────────────────────────────────────────────────────────────
-- (Optionnel) Audit log de la migration
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO audit_log (user_id, collection, doc_id, op, delta, source)
VALUES (NULL, 'migration', '2026-05-21_messagerie_per_character',
        'wipe', '{"reason":"switch to per-character messaging"}', 'migration');
