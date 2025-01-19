import BuySubcommand from "./buy.js";
import ConfigSubcommand from "./config.js";
import FishSubcommand from "./fish.js";
import LeaderboardSubcommand from "./leaderboard.js";
import SellSubcommand from "./sell.js";
import ShowSubcommand from "./show.js";
import StatsSubcommand from "./stats.js";
import TrapSubcommand from "./trap.js";

const subcommands = [
	BuySubcommand,
	ConfigSubcommand,
	FishSubcommand,
	LeaderboardSubcommand,
	SellSubcommand,
	ShowSubcommand,
	StatsSubcommand,
	TrapSubcommand
];

export default {
	subcommands
};
