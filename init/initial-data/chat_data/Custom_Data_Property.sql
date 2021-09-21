INSERT INTO `chat_data`.`Custom_Data_Property`
(`Name`, `Type`, `Target`, `Description`)
VALUES

('administrator', 'boolean', 'User', 'Determines the administrator privileges. If true, many elevated commands and bypasses will be available for the user.'),
('animals', 'object', 'User', NULL),
('authKey', 'string', 'User', NULL),
('banWavePartPermissions', 'array', 'User', NULL),
('birthday', 'object', 'User', NULL),
('developer', 'boolean', 'User', NULL),
('discordChallengeNotificationSent', 'boolean', 'User', NULL),
('github', 'object', 'User', NULL),
('inspectErrorStacks', 'boolean', 'User', NULL),
('location', 'object', 'User', NULL),
('pathOfExile', 'object', 'User', NULL),
('previousUserID', 'string', 'User', NULL),
('skipGlobalPing', 'boolean', 'User', NULL),
('supinicStreamSongRequestExtension', 'number', 'User', NULL),
('timers', 'object', 'User', NULL),
('trackLevel', 'string', 'User', NULL),
('trustedTwitchLottoFlagger', 'boolean', 'User', NULL)
;
