CREATE TABLE IF NOT EXISTS `data`.`Got_Instance` (
  `Name` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
  `Options_Type` ENUM('JSON','function') NOT NULL DEFAULT 'JSON',
  `Options` TEXT NOT NULL,
  `Parent` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
  `Description` TEXT DEFAULT NULL,PRIMARY KEY (`Name`) USING BTREE,
  INDEX `FK_Got_Instance_Got_Instance` (`Parent`) USING BTREE,
  CONSTRAINT `FK_Got_Instance_Got_Instance` FOREIGN KEY (`Parent`) REFERENCES `data`.`Got_Instance` (`Name`) ON UPDATE CASCADE ON DELETE CASCADE
) COLLATE='utf8mb4_general_ci' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;