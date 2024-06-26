import { Call911, ShouldDoType } from "@snailycad/types";
import { ClientEvents, ServerEvents, SnCommands } from "~/types/events";
import { getPlayerApiToken } from "../server";
import { cadRequest } from "~/utils/fetch.server";
import { GetUserData } from "@snailycad/types/api";

onNet(ServerEvents.Incoming911Call, async (call: Call911) => {
  CancelEvent();

  const player = global.source;
  const userApiToken = getPlayerApiToken(player);
  if (!userApiToken) return;

  const { data } = await cadRequest<GetUserData>({
    method: "POST",
    path: "/user?includeActiveUnit=true",
    headers: {
      userApiToken,
    },
  });

  const isOnDuty = data?.unit && data.unit.status?.shouldDo !== ShouldDoType.SET_OFF_DUTY;
  if (isOnDuty) {
    emitNet(ClientEvents.CreateNotification, player, {
      message: `A new 911 call has been created with case number: #${call.caseNumber}. To assign yourself to the call, use /${SnCommands.AttachTo911Call} ${call.caseNumber}`,
      title: "Incoming 911 Call",
      timeout: 15_000,
    });
  }
});

onNet(ServerEvents.PanicButtonOn, async (unit: { formattedUnitData: string }) => {
  CancelEvent();

  const player = global.source;
  const userApiToken = getPlayerApiToken(player);
  if (!userApiToken) return;

  const { data } = await cadRequest<GetUserData>({
    method: "POST",
    path: "/user?includeActiveUnit=true",
    headers: {
      userApiToken,
    },
  });

  const isOnDuty = data?.unit && data.unit.status?.shouldDo !== ShouldDoType.SET_OFF_DUTY;
  if (isOnDuty) {
    emitNet(ClientEvents.CreateNotification, player, {
      message: `${unit.formattedUnitData} has pressed their panic button.`,
      title: "Panic Button Enabled",
    });
  }
});

onNet(ServerEvents.CallUpdated, async (call: any) => {
  CancelEvent();

  const player = global.source;
  const userApiToken = getPlayerApiToken(player);
  if (!userApiToken) return;

  const { data } = await cadRequest<GetUserData>({
    method: "POST",
    path: "/user?includeActiveUnit=true",
    headers: {
      userApiToken,
    },
  });

  const isOnDuty = data?.unit && data.unit.status?.shouldDo !== ShouldDoType.SET_OFF_DUTY;

  const playersDiscordIds = getPlayerDiscordIds();
  const lastEvent = call.events[call.events.length - 1];
  const attachedUnits = lastEvent.translationData.units;
  let usersDiscordIds = [];

  for (let i = 0; i < attachedUnits.length; i++) {
    if(lastEvent.translationData.key === "unitAssignedToCall"){
      usersDiscordIds.push(attachedUnits[i].unit.user.discordId);
    }
  };

  for (let i = 0; i < playersDiscordIds.length; i++) {
    let formattedPlayerDiscordId = playersDiscordIds[i]?.replace("discord:", "");
    if(usersDiscordIds.includes(formattedPlayerDiscordId) && isOnDuty){
      emitNet(ClientEvents.AutoPostalOnAttach, player, call.postal)
    }
  };
});

onNet(ServerEvents.ValidatePanicRoute, async ({street, postal}: any) => {
  CancelEvent();

  console.log(`Degub. Postal: ${postal}, street: ${street}`);

  const player = global.source;
  const userApiToken = getPlayerApiToken(player);
  if (!userApiToken) return;

  const { data } = await cadRequest<GetUserData>({
    method: "POST",
    path: "/user?includeActiveUnit=true",
    headers: {
      userApiToken,
    },
  });

  const isOnDuty = data?.unit && data.unit.status?.shouldDo !== ShouldDoType.SET_OFF_DUTY;
  if(isOnDuty){
    emitNet(ClientEvents.AutoPostalOnAttach, player, postal);
    emitNet(ClientEvents.CreateNotification, player, {
      message: `Panic button have been activated on ${street}, ${postal}`,
      title: "Panic Unit Location Detected"
    });
  };
});

function getPlayerDiscordIds() {
  const num = GetNumPlayerIndices();
  let players = [];
  let discordIds = [];

  for (let i = 0; i < num; i++) {
    players[i] = GetPlayerFromIndex(i);
  }

  for (let i = 0; i < num; i++){
    let playerDiscordId = GetPlayerIdentifierByType(players[i], 'discord');
    if(playerDiscordId !== null){
      discordIds.push(playerDiscordId);
    } else {
      console.log("Error occured while getting Discord ID");
    };
  };

  return discordIds
};