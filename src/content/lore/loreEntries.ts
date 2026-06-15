/**
 * loreEntries.ts — short atmospheric fragments. Keep each to a few lines.
 * Placed via SpawnDef kind "lore" (scrolls/tablets) or granted by chests/bosses.
 */
import type { LoreEntry } from "../../game/types";

export const loreEntries: Record<string, LoreEntry> = {
  l_threshold: {
    id: "l_threshold",
    title: "Carved at the Threshold",
    text: "“Emberfall kept the dark out for a thousand winters. Then the light it kept went hollow, and the dark walked in wearing our armor.”",
  },
  l_cells: {
    id: "l_cells",
    title: "Scratched in a Cell",
    text: "“They locked us in to keep the fever from spreading. The Gaoler swallowed the keys. We learned to live by torchlight, then by no light at all.”",
  },
  l_well: {
    id: "l_well",
    title: "The Echo Well",
    text: "“Speak your name to the well and it speaks it back, older. The Wardens drank here before the long watch. Rest, traveler. The Keep does not.”",
  },
  l_gallery: {
    id: "l_gallery",
    title: "Beneath the Gargoyles",
    text: "“The cultists came for the embers, not the gold. They thought a dying flame could be eaten. The gargoyles watched them try.”",
  },
  l_vault: {
    id: "l_vault",
    title: "On the Vault Door",
    text: "“What we hoarded, we could not carry out. Take the vessel, walker. A fuller heart outlasts a fuller purse.”",
  },
  l_descent: {
    id: "l_descent",
    title: "A Warning, Half-Worn",
    text: "“Mind the floor on the long way down. The Keep buried its own traps and forgot which stones it loved.”",
  },
  l_shrine: {
    id: "l_shrine",
    title: "At the Shrine of Ash",
    text: "“Two seals open the last door. The Warden carries no key — only the duty to keep you out, and the wish that you would not be kept.”",
  },
  l_throne: {
    id: "l_throne",
    title: "The Hollow Throne",
    text: "“It was a knight once. It set down its name to take up the watch. Free it, and you free the Keep. There are other Keeps, traveler. Other names set down.”",
  },
};
