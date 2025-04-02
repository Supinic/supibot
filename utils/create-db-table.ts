export default async (tableName: string) => {
	const alreadySetup = await core.Query.isTablePresent("chat_line", tableName);
	if (alreadySetup) {
		return {
			success: false
		};
	}

	await core.Query.raw(core.Utils.tag.trim `
		CREATE TABLE IF NOT EXISTS chat_line.\`${tableName}\` (
			\`ID\` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
			\`Platform_ID\` VARCHAR(100) NOT NULL,
			\`Text\` TEXT NOT NULL,
			\`Posted\` DATETIME(3) NOT NULL,
			PRIMARY KEY (\`ID\`)
		)
		COLLATE=\`utf8mb4_general_ci\`
		ENGINE=InnoDB
		AUTO_INCREMENT=1
		PAGE_COMPRESSED=1;
	`);

	return {
		success: true
	};
};
