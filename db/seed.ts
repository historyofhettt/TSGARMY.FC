import { getDb } from "../api/queries/connection";
import {
  orgSettings,
  people,
  teams,
  players,
  tournaments,
  matches,
  matchPlayers,
  maps,
} from "./schema";
import { eq } from "drizzle-orm";

/**
 * Demo seed data — clearly marked placeholder content so the site can be
 * explored immediately. Every record is editable/deletable from the Admin
 * Panel. Stats are computed from the demo match performances below.
 */
async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // ---------------------------------------------------------------- org
  const [org] = await db.select().from(orgSettings).limit(1);
  if (!org) {
    await db.insert(orgSettings).values({
      orgName: "Two Side Gamers",
      shortName: "TSG",
      tagline: "Built for Competition. Driven by Legacy.",
      description:
        "Two Side Gamers (TSG) is a professional esports organization fielding two competitive rosters — TSG ARMY and TSG ARTEMIS.",
    });
  }

  // ---------------------------------------------------------------- people
  const existingPeople = await db.select().from(people);
  if (existingPeople.length === 0) {
    await db.insert(people).values([
      {
        kind: "owner",
        name: "Jain Ritik",
        position: "Owner",
        description:
          "A driving force behind Two Side Gamers, Jain Ritik contributes to the organization's vision, growth, and continued journey in the esports industry.",
        displayOrder: 1,
      },
      {
        kind: "owner",
        name: "Jash Dhoka",
        position: "Owner",
        description:
          "Jash Dhoka is an owner of Two Side Gamers, contributing to the organization's growth, management, and long-term vision in the esports ecosystem.",
        displayOrder: 2,
      },
      {
        kind: "legend",
        name: "TSG LEGEND",
        position: "Legacy of Two Side Gamers",
        description:
          "TSG LEGEND represents the legacy and competitive spirit of Two Side Gamers, carrying forward the organization's identity and passion for esports.",
        displayOrder: 10,
      },
    ]);
  }

  // ---------------------------------------------------------------- teams
  const existingTeams = await db.select().from(teams);
  if (existingTeams.length > 0) {
    console.log("Teams already exist — skipping demo content.");
    process.exit(0);
  }

  const [{ id: armyId }] = await db
    .insert(teams)
    .values({
      name: "TSG ARMY",
      slug: "tsg-army",
      category: "Male Esports Team",
      tagline: "Discipline. Firepower. Victory.",
      description:
        "TSG ARMY is the male competitive roster of Two Side Gamers — built on discipline, raw firepower, and relentless practice. (Demo description — edit in Admin.)",
      accent: "blue",
      displayOrder: 1,
    })
    .$returningId();

  const [{ id: artemisId }] = await db
    .insert(teams)
    .values({
      name: "TSG ARTEMIS",
      slug: "tsg-artemis",
      category: "Female Esports Team",
      tagline: "Precision. Grace. Dominance.",
      description:
        "TSG ARTEMIS is the female competitive roster of Two Side Gamers — precision gameplay and fearless coordination. (Demo description — edit in Admin.)",
      accent: "red",
      displayOrder: 2,
    })
    .$returningId();

  // ---------------------------------------------------------------- players
  const now = new Date();
  const armyPlayers = [
    { ign: "TSG·Vortex", realName: "Demo Player", role: "IGL", displayOrder: 1 },
    { ign: "TSG·Blaze", realName: "Demo Player", role: "Assaulter", displayOrder: 2 },
    { ign: "TSG·Frost", realName: "Demo Player", role: "Sniper", displayOrder: 3 },
    { ign: "TSG·Rogue", realName: "Demo Player", role: "Scout", displayOrder: 4 },
    { ign: "TSG·Titan", realName: "Demo Player", role: "Support", displayOrder: 5 },
  ].map((p) => ({
    ...p,
    teamId: armyId,
    slug: p.ign.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    bio: "Demo roster player — replace with the real biography from the Admin Panel.",
    status: "active" as const,
    joinedDate: now,
  }));

  const artemisPlayers = [
    { ign: "TSG·Nova", realName: "Demo Player", role: "IGL", displayOrder: 1 },
    { ign: "TSG·Valkyrie", realName: "Demo Player", role: "Assaulter", displayOrder: 2 },
    { ign: "TSG·Luna", realName: "Demo Player", role: "Sniper", displayOrder: 3 },
    { ign: "TSG·Ember", realName: "Demo Player", role: "Scout", displayOrder: 4 },
    { ign: "TSG·Aria", realName: "Demo Player", role: "Support", displayOrder: 5 },
  ].map((p) => ({
    ...p,
    teamId: artemisId,
    slug: p.ign.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    bio: "Demo roster player — replace with the real biography from the Admin Panel.",
    status: "active" as const,
    joinedDate: now,
  }));

  const insertedArmy: number[] = [];
  for (const p of armyPlayers) {
    const [{ id }] = await db.insert(players).values(p).$returningId();
    insertedArmy.push(id);
  }
  const insertedArtemis: number[] = [];
  for (const p of artemisPlayers) {
    const [{ id }] = await db.insert(players).values(p).$returningId();
    insertedArtemis.push(id);
  }

  // ---------------------------------------------------------------- maps
  const mapSeeds = ["Bermuda", "Purgatory", "Kalahari", "Nexterra", "Solara"];
  const existingMaps = await db.select().from(maps);
  let mapRows: { id: number; name: string }[] = existingMaps;
  if (existingMaps.length === 0) {
    const ids: number[] = [];
    for (const [i, name] of mapSeeds.entries()) {
      const [{ id }] = await db
        .insert(maps)
        .values({ name, displayOrder: i + 1 })
        .$returningId();
      ids.push(id);
    }
    mapRows = mapSeeds.map((name, i) => ({ id: ids[i], name }));
  }

  // ---------------------------------------------------------------- tournaments
  const day = 24 * 60 * 60 * 1000;

  const [{ id: completedT }] = await db
    .insert(tournaments)
    .values({
      teamId: armyId,
      name: "TSG Invitational — Season 1 (Demo)",
      slug: "tsg-invitational-season-1",
      description:
        "Demo completed tournament. Replace with a real event from the Admin Panel.",
      startDate: new Date(now.getTime() - 14 * day),
      startTime: "7:00 PM IST",
      status: "completed",
      numberOfMatches: 3,
    })
    .$returningId();

  const [{ id: ongoingT }] = await db
    .insert(tournaments)
    .values({
      teamId: armyId,
      name: "Pro Scrims League (Demo)",
      slug: "pro-scrims-league",
      description: "Demo ongoing tournament — set live links from the Admin Panel.",
      startDate: new Date(now.getTime()),
      startTime: "8:00 PM IST",
      status: "ongoing",
      numberOfMatches: 6,
    })
    .$returningId();

  await db.insert(tournaments).values({
    teamId: artemisId,
    name: "Artemis Rising Cup (Demo)",
    slug: "artemis-rising-cup",
    description: "Demo upcoming tournament for TSG ARTEMIS.",
    startDate: new Date(now.getTime() + 7 * day),
    startTime: "6:30 PM IST",
    status: "upcoming",
    numberOfMatches: 6,
  });

  const [{ id: artemisCompletedT }] = await db
    .insert(tournaments)
    .values({
      teamId: artemisId,
      name: "Queens Showdown (Demo)",
      slug: "queens-showdown",
      description: "Demo completed tournament for TSG ARTEMIS.",
      startDate: new Date(now.getTime() - 21 * day),
      startTime: "7:30 PM IST",
      status: "completed",
      numberOfMatches: 2,
    })
    .$returningId();

  // ---------------------------------------------------------------- matches
  async function addMatch(
    tournamentId: number,
    matchNumber: number,
    map: { id: number; name: string },
    playerIds: number[],
    specialMoment: string | null,
  ) {
    const [{ id: matchId }] = await db
      .insert(matches)
      .values({ tournamentId, matchNumber, mapId: map.id, mapName: map.name, specialMoment })
      .$returningId();

    await db.insert(matchPlayers).values(
      playerIds.map((pid, i) => {
        const kills = ((matchNumber * 3 + i * 2) % 8) + 1;
        const placement = ((matchNumber + i) % 12) + 1;
        const finishPoints = kills;
        const placementPoints = Math.max(0, 12 - placement);
        const totalPoints = finishPoints + placementPoints;
        const lineupStatus = i < 4 ? "played" : "bench";
        return {
          matchId,
          playerId: pid,
          lineupStatus: lineupStatus as "played" | "bench" | "dnp",
          kills,
          placement,
          placementPoints,
          finishPoints,
          totalPoints,
          officialTotalPoints: i === 0 ? totalPoints + 2 : null,
          specialMoment: i === 0 ? specialMoment : null,
        };
      }),
    );
  }

  await addMatch(completedT, 1, mapRows[0], insertedArmy, "1v3 clutch in the final zone");
  await addMatch(completedT, 2, mapRows[1], insertedArmy, null);
  await addMatch(completedT, 3, mapRows[2], insertedArmy, "Insane comeback on the last circle");

  await addMatch(ongoingT, 1, mapRows[0], insertedArmy, "Last-zone domination");

  await addMatch(artemisCompletedT, 1, mapRows[0], insertedArtemis, "Final elimination ace");
  await addMatch(artemisCompletedT, 2, mapRows[2], insertedArtemis, null);

  // Mark demo seed via org description already done. Done.
  console.log("Seeded: org, 3 people, 2 teams, 10 players, 5 maps, 4 tournaments, 6 matches.");
  console.log("NOTE: All content is demo data — fully editable in the Admin Panel.");
  process.exit(0);
}

seed();
