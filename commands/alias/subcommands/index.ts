import { SubcommandCollection, type SubcommandDefinition } from "../../../classes/command.ts";

import AddSubcommand from "./add.ts";
import CheckSubcommand from "./check.ts";
import CopySubcommand from "./copy.ts";
import DescribeSubcommand from "./describe.ts";
import DuplicateSubcommand from "./duplicate.ts";
import EditSubcommand from "./edit.ts";
import InspectSubcommand from "./inspect.ts";
import LinkSubcommand from "./link.ts";
import PublishSubcommand from "./publish.ts";
import PublishedSubcommand from "./published.ts";
import RemoveSubcommand from "./remove.ts";
import RenameSubcommand from "./rename.ts";
import RestrictSubcommand from "./restrict.ts";
import RunSubcommand from "./run.ts";
import TransferSubcommand from "./transfer.ts";

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
