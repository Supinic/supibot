-- Applies changes from supinic/supibot-package-manager#0548566
ALTER TABLE `chat_data`.`Command`
CHANGE COLUMN `Flags` `Flags`
SET('archived','block','developer','external-input','link-only','mention','non-nullable','opt-out','owner-override','ping','pipe','read-only','rollback','skip-banphrase','system','use-params','whitelist') NULL
DEFAULT NULL
COLLATE 'utf8mb4_general_ci'
AFTER `Aliases`;
