// bb-plugin-t3sidebar — an inbox-style replacement for bb's sidebar thread
// list, and the reference example for `app.slots.experimental_threadList`.
//
// Named workspaces keep related projects together at the top of the list.
// Within them, root threads never re-order themselves: roots sort by creation
// time, newest first, while descendants stay directly beneath their parent.
// Status is carried by each card, not by position.
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { ThreadInbox } from "./src/ThreadInbox";
import { ParentChip } from "./src/ParentChip";
import { SubagentsChip } from "./src/SubagentsChip";
import "./src/working-shimmer.css";

export default definePluginApp((app) => {
  app.slots.experimental_threadList({
    id: "inbox",
    title: "T3 Sidebar",
    description: "A workspace-based inbox with stable thread ordering.",
    component: ThreadInbox,
  });

  // Registered first, so it renders on the left of the children chip: the
  // header then reads up (parent) then down (children).
  app.slots.experimental_threadHeaderAction({
    id: "parent",
    title: "Parent thread",
    component: ParentChip,
  });

  // Child threads are staggered in the inbox; this chip is the quick route to
  // all of them from their parent's header.
  app.slots.experimental_threadHeaderAction({
    id: "children",
    title: "Child threads",
    component: SubagentsChip,
  });
});
