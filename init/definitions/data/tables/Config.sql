CREATE TABLE IF NOT EXISTS `data`.`Config` (
  `Name` VARCHAR(50) NOT NULL,
  `Value` TEXT DEFAULT NULL,
  `Type` ENUM('number','string','array','object','date','regex','boolean','function') NOT NULL DEFAULT 'string',
  `Unit` ENUM('ms','s') DEFAULT NULL,
  `Secret` TINYINT(1) NOT NULL DEFAULT 0,
  `Editable` TINYINT(1) NOT NULL DEFAULT 0,
  `Notes` TEXT DEFAULT NULL,
  PRIMARY KEY (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;