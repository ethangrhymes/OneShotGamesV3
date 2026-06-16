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

  // ---- Round 2: The Rootward Road ----
  l_road_gate: {
    id: "l_road_gate",
    title: "Past the Sundered Gate",
    text: "“The chain was not built to hold prisoners. It was built to hold the road shut. You have broken the first link. Mind what walks the rest.”",
  },
  l_road_dead: {
    id: "l_road_dead",
    title: "Milestone, Toppled",
    text: "“This road once carried bells from keep to keep, so no warden watched alone. Then the bells went quiet, one by one, and the roots came up to listen.”",
  },
  l_hamlet: {
    id: "l_hamlet",
    title: "In the Swallowed Hamlet",
    text: "“We heard the Keep’s seal break and thought it rescue. By morning the road had grown into our doors. The curse does not march. It takes root.”",
  },
  l_grove: {
    id: "l_grove",
    title: "Among the Blackroots",
    text: "“Cut a root and it bleeds ash. They drink the old sun the dead kings buried here. Do not rest beneath them; they remember the shape of sleepers.”",
  },
  l_barrow: {
    id: "l_barrow",
    title: "The Outer Barrow",
    text: "“The Champion was set here to guard the next bell. It still guards. It has simply forgotten what a bell is for.”",
  },
  l_bell: {
    id: "l_bell",
    title: "A Bell Token",
    text: "“Three tokens once rang the causeway open. Carry them. A warden who hoards bells is a warden who means to leave.”",
  },
  l_causeway: {
    id: "l_causeway",
    title: "At the Sealed Causeway",
    text: "“Beyond this span: a drowned verge, an old king’s road, a buried sun. The bell-tokens you carry are bell enough — the seal is thinning. Step through. The Keep was one wound. The world has many.”",
  },

  // ---- Phase 3: The Saltblack Reach (a drowned war-coast) ----
  l_reach_landing: {
    id: "l_reach_landing",
    title: "Cut into the Saltstair",
    text: "“The road did not end at the causeway; it drowned. Below lies the Saltblack Reach, where a war sank mid-stride and never finished falling. Walk soft. The tide keeps the dead from settling.”",
  },
  l_strand: {
    id: "l_strand",
    title: "On the Black Strand",
    text: "“Two banners still stand in the shallows, on poles no living hand has held in an age. They were enemies. The tide has made them neighbors. It will do the same to you, given long enough.”",
  },
  l_tideshrine: {
    id: "l_tideshrine",
    title: "At the Tide Shrine",
    text: "“The drowned king wore a signet that asked the shallows to part, and they did, for he had paid the toll in sons. Take it. Wade where you could not wade. But know that the deep water keeps its own counsel — and its own drowned.”",
  },
  l_wreck: {
    id: "l_wreck",
    title: "In the Beached Hulk",
    text: "“They ran her aground to make a wall of her. The wall held. The crew did not. What they guarded is still in the hold, and still warm, which is the worst of it.”",
  },
  l_spans: {
    id: "l_spans",
    title: "On the Broken Spans",
    text: "“Bridges for the bell-carts, once. Now half of them are under, and the under-half is where the archers wait. Cross high, or ford low with the signet. Either way, cross fast.”",
  },
  l_lowtide: {
    id: "l_lowtide",
    title: "At Lowtide Muster",
    text: "“This was a staging ground. You can still read the muster in the rust: who stood where, who never stood again. Raise the tide-gate winch and the way back opens — a kindness the war never offered.”",
  },
  l_drowned_gear: {
    id: "l_drowned_gear",
    title: "The Toll-Engine",
    text: "“The toll was never coin. The Gear took a year of your life per crossing and called it fair. It has been collecting from the dead so long it has forgotten the dead have nothing left to give.”",
  },
  l_drowngate: {
    id: "l_drowngate",
    title: "At the Drowned Toll-Gate",
    text: "“Past this gate the road climbs again, into a country of glass and buried suns where the curse wears a brighter face. The Gear is broken; the toll is paid. The gate is only sealed — and seals, you have learned, are made to be broken. — The road goes on.”",
  },
};
