INSERT IGNORE INTO `data`.`Config` 
(`Name`,`Value`,`Type`,`Unit`,`Secret`,`Editable`,`Notes`)
VALUES
('COMMAND_PREFIX',NULL,'string',NULL,0,1,NULL),
('CYTUBE_BOT_PASSWORD',NULL,'string',NULL,1,0,NULL),
('DISCORD_BOT_TOKEN',NULL,'string',NULL,1,0,NULL),
('DEFAULT_USER_AGENT','Custom fork of Supibot: github.com/supinic/supibot','string',NULL,0,0,NULL),
('MIXER_OAUTH',NULL,'string',NULL,1,0,NULL),
('TWITCH_OAUTH',NULL,'string',NULL,1,0,NULL),
('USER_INSERT_CRON_CONFIG','*/10 * * * * *','string',NULL,0,0,NULL),
('WHITESPACE_REGEX','/[\u034f\u2800\u{E0000}\u180e\ufeff\u2000-\u200d\u206D]/gu','regex',NULL,0,0,NULL);