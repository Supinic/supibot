CREATE TABLE IF NOT EXISTS `chat_data`.`Error` (
  `ID` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `Type` enum('Backend','Command','Database','Website','Website - API','Other') NOT NULL,
  `Message` mediumtext DEFAULT NULL,
  `Stack` text NOT NULL DEFAULT '',
  `Arguments` text DEFAULT NULL,
  `Timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;