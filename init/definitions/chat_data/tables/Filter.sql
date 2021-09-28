CREATE TABLE IF NOT EXISTS `chat_data`.`Filter` (
  `ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `User_Alias` INT(10) UNSIGNED DEFAULT NULL,
  `Channel` INT(10) UNSIGNED DEFAULT NULL,
  `Command` INT(10) UNSIGNED DEFAULT NULL,
  `Platform` INT(10) UNSIGNED DEFAULT NULL,
  `Invocation` VARCHAR(50) DEFAULT NULL COMMENT 'This is specific command invocation - must always be coupled with Command',
  `Type` ENUM('Blacklist','Whitelist','Opt-out','Block','Unping','Unmention','Cooldown','Flags','Offline-only','Online-only','Arguments','Reminder-prevention') NOT NULL DEFAULT 'Blacklist' COMMENT 'Determins the type of filter:\r\nBlacklist - given combo WILL NOT be able to use commands. By setting all combo fields to NULL, you will blacklist everyone everywhere. Not recommended.\r\nWhitelist - given combo WILL be able to use commands. Command must NOT be null.\r\nOpt-out - given Command will not accept User_Alias as its first argument. Other combo fields are ignored.\r\nBlock - given Command will not accept User_Alias as its first argument, only for user Blocked_User. Other combo fields are ignored.\r\nUnping - given Command will attempt to un-ping (insert ZWSP characters in their name) User_Alias. Other combo fields are ignored.' COLLATE 'utf8mb4_general_ci',
  `Blocked_User` INT(10) UNSIGNED DEFAULT NULL,
  `Data` text DEFAULT NULL,
  `Active` TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
  `Response` ENUM('None','Auto','Reason') NOT NULL DEFAULT 'None' COMMENT 'If used with Blacklist/Opt-out/Block, this determines the reply the blocked user gets.\r\nNone - no reply.\r\nAuto - automatic reply will be used.\r\nReason - the text in field Reason will be used.',
  `Reason` VARCHAR(500) DEFAULT NULL COMMENT 'Reply text for blocked users if Reply = Reason. See that column for more info',
  `Issued_By` INT(10) UNSIGNED COMMENT 'The person who issued the filter.',
  `Created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `Changed` DATETIME(3) NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3),
  `Notes` text DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `User_Alias_Channel_Command` (`User_Alias`,`Channel`,`Command`,`Type`,`Blocked_User`,`Platform`,`Invocation`) USING BTREE,
  KEY `FK_Ban_Channel` (`Channel`),
  KEY `FK_Ban_Command` (`Command`),
  KEY `FK_Ban_User_Alias_2` (`Issued_By`),
  KEY `FK_Filter_Platform` (`Platform`),
  KEY `FK_Filter_User_Alias` (`Blocked_User`),
  KEY `Active_Lookup` (`Active`),
  CONSTRAINT `FK_Filter_Platform` FOREIGN KEY (`Platform`) REFERENCES `Platform` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_Filter_User_Alias` FOREIGN KEY (`Blocked_User`) REFERENCES `User_Alias` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Filter_ibfk_1` FOREIGN KEY (`Channel`) REFERENCES `Channel` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Filter_ibfk_2` FOREIGN KEY (`Command`) REFERENCES `Command` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Filter_ibfk_3` FOREIGN KEY (`User_Alias`) REFERENCES `User_Alias` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Filter_ibfk_4` FOREIGN KEY (`Issued_By`) REFERENCES `User_Alias` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
)
 ENGINE=InnoDB
 DEFAULT CHARSET=utf8mb4
 COMMENT='Filters specific usages of commands.\r\nIn the following descriptions, "Combo fields" refer to the unique index User_Alias-Channel-Platform-Command-Type. If either is null, it is considered as global.\r\nE.g.: \r\ncombo 1-2-NULL-3-Blacklist will ban User_Alias 1 from using command 3 in Channel 2.\r\ncombo NULL-NULL-1-3-Blacklist will ban *EVERYONE* from using command 3 in platform 1.\r\ncombo 1-NULL-NULL-3-Whitelist will allow User_Alias 1 to use command 3 *EVERYWHERE*.\r\ncombo NULL-NULL-NULL-NULL-Blacklist will ban *EVERYONE* *EVERYWHERE*. Not recommended.'
;
