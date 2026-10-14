CREATE TABLE IF NOT EXISTS `chat_data`.`User_Alias_Data` (
    `User_Alias` INT(10) UNSIGNED NOT NULL,
    `Property` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_general_ci',
    `Value` MEDIUMTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
    `Sort_Value` BIGINT UNSIGNED AS (
        CASE `Property`
            WHEN 'cookie' THEN
                CONVERT(JSON_EXTRACT(`Value`, '$.total.eaten.daily'), INT)
                + CONVERT(JSON_EXTRACT(`Value`, '$.total.eaten.received'), INT)
                + CONVERT(JSON_EXTRACT(`Value`, '$.total.donated'), INT)
                + CONVERT(JSON_EXTRACT(`Value`, '$.total.received'), INT)
            WHEN 'fishData' THEN
                CONVERT(JSON_EXTRACT(`Value`, '$.lifetime.fish'), INT)
            ELSE NULL
        END
    ) PERSISTENT COMMENT 'Leaderboard sort value, specific to some properties',
    PRIMARY KEY (`User_Alias`, `Property`) USING BTREE,
    INDEX `IDX_User_Alias_Data_Property_Sort_Value` (`Property`, `Sort_Value`) USING BTREE,
    CONSTRAINT `FK_User_Data_User_Alias`
    FOREIGN KEY (`User_Alias`)
    REFERENCES `chat_data`.`User_Alias` (`ID`) ON UPDATE CASCADE ON DELETE CASCADE
)
COLLATE='utf8mb4_general_ci'
ENGINE=InnoDB
;
