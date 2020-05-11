CREATE TABLE IF NOT EXISTS `chat_data`.`Cron` (
  `ID` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `Name` VARCHAR(50) NOT NULL,
  `Expression` VARCHAR(50) NOT NULL COMMENT 'Cron time expression. WARNING! Uses 6 time slots (instead of standard 5) in this order: seconds, minutes, hours, day-of-month, month, day-of-week.',
  `Description` TEXT DEFAULT NULL,
  `Code` TEXT NOT NULL COMMENT 'Javascript code of given cron job.',
  `Type` ENUM('All','Website','Bot') NOT NULL COMMENT 'Determines in which project context should the job be executed.',
  `Active` tinyint(1) unsigned NOT NULL DEFAULT 1,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Name` (`Name`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4;