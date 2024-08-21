INSERT IGNORE INTO `data`.`Config`
(`Name`,`Value`,`Type`,`Unit`,`Secret`,`Editable`,`Notes`)
VALUES
('COMMAND_ERROR_DEVELOPER','(errorID, error) => `Error ID ${errorID} - ${error.message}`','function',NULL,0,1,NULL),
('COMMAND_ERROR_GENERIC','(errorID, error) => `An error occured while executing the command!`','function',NULL,0,1,NULL),
('CYTUBE_BOT_PASSWORD',NULL,'string',NULL,1,0,NULL),
('DISCORD_BOT_TOKEN',NULL,'string',NULL,1,0,NULL),
('LINK_REGEX','/(https?:\\/\\/)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_\\+.~#?&\\/\\/=]*)/gi','regex',NULL,0,1,'Determines if a message contains a website link.'),
('MAX_ACTIVE_INCOMING_REMINDERS','5','number',NULL,0,1,'Maximum amount of reminders someone can have pending for them at once.'),
('MAX_ACTIVE_OUTGOING_REMINDERS','8','number',NULL,0,1,'Maximum amount of reminders someone can have pending for others at the same time.'),
('REDIS_CONFIGURATION',NULL,'string',NULL,0,0,NULL),
('SUPIBOT_API_PORT',NULL,'number',NULL,0,0,NULL),
('SUPIBOT_API_SECURE','0','boolean',NULL,0,0,NULL),
('WHITESPACE_REGEX','/[\\u034f\\u2800\\u{E0000}\\u180e\\ufeff\\u2000-\\u200d\\u206D]/gu','regex',NULL,0,0,NULL);
