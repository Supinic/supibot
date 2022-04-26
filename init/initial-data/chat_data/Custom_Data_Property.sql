INSERT INTO `chat_data`.`Custom_Data_Property`
(`Name`, `Type`, `Target`, `Description`)
VALUES

('administrator', 'boolean', 'User', 1, 'Determines the administrator privileges. If true, many elevated commands and bypasses will be available for the user.');
('ambassadors', 'array', 'Channel', 0, 'number[]');
('animals', 'object', 'User', 1, NULL);
('authKey', 'string', 'User', 0, NULL);
('banWavePartPermissions', 'array', 'User', 0, NULL);
('birthday', 'object', 'User', 0, NULL);
('customDeveloperData', 'object', 'User', 0, 'Custom data saved by the user, to be used as a persistent storage between $js sessions.');
('developer', 'boolean', 'User', 1, NULL);
('discord', 'string', 'Channel', 0, NULL);
('discordChallengeNotificationSent', 'boolean', 'User', 0, NULL);
('github', 'object', 'User', 0, NULL);
('globalPingRemoved', 'boolean', 'Channel', 1, NULL);
('inactiveReason', 'string', 'Channel', 0, NULL);
('inspectErrorStacks', 'boolean', 'User', 0, NULL);
('instagramNSFW', 'boolean', 'Channel', 0, NULL);
('location', 'object', 'User', 0, NULL);
('offlineOnlyBot', 'object', 'Channel', 0, '{ started: string } - ISO-date representation');
('offlineOnlyMirror', 'number', 'Channel', 0, NULL);
('pathOfExile', 'object', 'User', 0, NULL);
('platformVerification', 'object', 'User', 1, 'Object of platform verifications\r\n\r\nkey - platform ID\r\nvalue - { <number> created, <boolean> active } ');
('previousUserID', 'string', 'User', 0, NULL);
('redditSafeMode', 'boolean', 'Channel', 0, NULL);
('removeReason', 'string', 'Channel', 0, NULL);
('sharedCustomData', 'object', 'Channel', 0, 'Any properties, any JSONifiable values');
('showFullCommandErrorMessage', 'boolean', 'Channel', 0, NULL);
('skipGlobalPing', 'boolean', 'User', 0, NULL);
('supinicStreamSongRequestExtension', 'number', 'User', 0, NULL);
('timers', 'object', 'User', 0, NULL);
('trackLevel', 'string', 'User', 0, NULL);
('trustedTwitchLottoFlagger', 'boolean', 'User', 0, NULL);
('twitch-userid-mismatch-notification', 'boolean', 'User', 0, NULL);
('twitchLottoBlacklistedFlags', 'array', 'Channel', 0, 'string[]');
('twitchLottoSafeMode', 'boolean', 'Channel', 0, NULL);
;
