INSERT IGNORE INTO `data`.`Config`
(`Name`,`Value`,`Type`,`Unit`,`Secret`,`Editable`,`Notes`)
VALUES
('COMMAND_ERROR_DEVELOPER','(errorID, error) => `Error ID ${errorID} - ${error.message}`','function',NULL,0,1,NULL),
('COMMAND_ERROR_GENERIC','(errorID, error) => `An error occured while executing the command!`','function',NULL,0,1,NULL),
('COMMAND_PREFIX',NULL,'string',NULL,0,1,NULL),
('CYTUBE_BOT_PASSWORD',NULL,'string',NULL,1,0,NULL),
('DISCORD_BOT_TOKEN',NULL,'string',NULL,1,0,NULL),
('DEFAULT_BANPHRASE_API_RESPONSE','[Banphrased]','string',NULL,0,1,'If a banphrase API rejects a message, and no Banphrase object exists to react to that, this message will be printed instead.'),
('DEFAULT_PENDING_TIMEOUT',300000,'number',NULL,0,0,NULL),
('DEFAULT_USER_AGENT','Custom fork of Supibot: github.com/supinic/supibot','string',NULL,0,0,NULL),
('LINK_REGEX','/(https?:\\/\\/)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_\\+.~#?&\\/\\/=]*)/gi','regex',NULL,0,1,'Determines if a message contains a website link.'),
('MAX_ACTIVE_INCOMING_REMINDERS','5','number',NULL,0,1,'Maximum amount of reminders someone can have pending for them at once.'),
('MAX_ACTIVE_OUTGOING_REMINDERS','8','number',NULL,0,1,'Maximum amount of reminders someone can have pending for others at the same time.'),
('PAJBOT_API_TIMEOUT',2500,'number','ms',0,1,NULL),
('PRIVATE_MESSAGE_COMMAND_FILTERED','That command is not available via private messages.','string',NULL,0,1,'Printed when a command not available in private messages is used there.'),
('PRIVATE_MESSAGE_NO_COMMAND','That command does not exist. Please use the "commands" command to get a list.','string',NULL,0,1,'Printed when a private message has the right command prefix but a command has not been found.'),
('PRIVATE_MESSAGE_UNRELATED','Invalid command prefix.','string',NULL,0,1,'Printed when a private message does not have the right comand prefix.'),
('REDIS_CONFIGURATION','{}','object',NULL,0,0,NULL),
('SUPIBOT_API_PORT',NULL,'number',NULL,0,0,NULL),
('SUPIBOT_API_SECURE','0','boolean',NULL,0,0,NULL),
('TWITCH_CLIENT_ID',NULL,'string',NULL,1,0,NULL),
('TWITCH_OAUTH',NULL,'string',NULL,1,0,NULL),
('WHITESPACE_REGEX','/[\\u034f\\u2800\\u{E0000}\\u180e\\ufeff\\u2000-\\u200d\\u206D]/gu','regex',NULL,0,0,NULL);
