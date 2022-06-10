const names = [
	"elo",
	"forsen"
];

const commands = names.map(commandName => require(`./subcommands/${commandName}.js`));
module.exports = {
	names,
	commands
};
