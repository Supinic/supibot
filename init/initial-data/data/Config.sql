INSERT IGNORE INTO `data`.`Config`
(`Name`,`Value`,`Type`,`Unit`,`Secret`,`Editable`,`Notes`)
VALUES
('LINK_REGEX','/(https?:\\/\\/)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_\\+.~#?&\\/\\/=]*)/gi','regex',NULL,0,1,'Determines if a message contains a website link.'),
('REDIS_CONFIGURATION',NULL,'string',NULL,0,0,NULL),
('WHITESPACE_REGEX','/[\\u034f\\u2800\\u{E0000}\\u180e\\ufeff\\u2000-\\u200d\\u206D]/gu','regex',NULL,0,0,NULL);
