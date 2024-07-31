CREATE TABLE IF NOT EXISTS `chat_data`.`Meta_Channel_Command`
(
    `Channel`                INT UNSIGNED NOT NULL,
    `First_Command_Executed` VARCHAR(50)  NULL,
    `First_Command_Posted`   DATETIME(3)  NULL,
    `First_Command_Result`   TEXT         NULL,
    `Last_Command_Executed`  VARCHAR(50)  NULL,
    `Last_Command_Posted`    DATETIME(3)  NULL,
    `Last_Command_Result`    TEXT         NULL,

    PRIMARY KEY (`Channel`)
    CONSTRAINT `Meta_Channel_Command_Channel_ID_fk` FOREIGN KEY (`Channel`) REFERENCES `Channel` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
;
