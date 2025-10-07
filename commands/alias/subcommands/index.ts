import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.js";

import AddSubcommand from "./add.js";
import CheckSubcommand from "./check.js";
import CopySubcommand from "./copy.js";
import DescribeSubcommand from "./describe.js";
import DuplicateSubcommand from "./duplicate.js";
import EditSubcommand from "./edit.js";
import InspectSubcommand from "./inspect.js";
import LinkSubcommand from "./link.js";
import PublishSubcommand from "./publish.js";
import PublishedSubcommand from "./published.js";
import RemoveSubcommand from "./remove.js";
import RenameSubcommand from "./rename.js";
import RestrictSubcommand from "./restrict.js";
import RunSubcommand from "./run.js";
import TransferSubcommand from "./transfer.js";

const subcommands: SubcommandDefinition[] = [
	AddSubcommand,
	CheckSubcommand,
	CopySubcommand,
	DescribeSubcommand,
	DuplicateSubcommand,
	EditSubcommand,
	InspectSubcommand,
	LinkSubcommand,
	PublishSubcommand,
	PublishedSubcommand,
	RemoveSubcommand,
	RenameSubcommand,
	RestrictSubcommand,
	RunSubcommand,
	TransferSubcommand
];

export const AliasSubcommands = new SubcommandCollection("alias", subcommands);
