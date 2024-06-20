import { Call911, ShouldDoType } from "@snailycad/types";
import { ClientEvents, ServerEvents, SnCommands } from "~/types/events";
import { getPlayerApiToken } from "../server";
import { cadRequest } from "~/utils/fetch.server";
import { GetUserData } from "@snailycad/types/api";
import { getPostal } from "~/utils/postal/getPostal";

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

onNet(ServerEvents.CallUpdated, async (call: Call911) => {
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

  const callEvents = call.events;
  let discordIdsAssigned = [];

  for(let i = 0; i < callEvents.length; i++){
    let event = callEvents[i];
    if(event.translationData.key === "unitAssignedToCall"){
      let units = event.translationData.units;
      discordIdsAssigned.push(units[0].unit.user.discordId);
    };
  };

  const isOnDuty = data?.unit && data.unit.status?.shouldDo !== ShouldDoType.SET_OFF_DUTY;
  let discordIdFivem = GetPlayerIdentifierByType(player, 'discord');
  for (let i = 0; i < discordIdsAssigned.length; i++) {
    let discordId = discordIdsAssigned[i];
    if(discordId === discordIdFivem && isOnDuty){
      emitNet(ClientEvents.AutoPostalOnAttach, player, call.postal)
    };
  };
})

onNet(ServerEvents.ValidatePanicRoute, async ({position}: any) => {
  CancelEvent();

  const panicUnitPostal = await getPostal(position);
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
    emitNet(ClientEvents.AutoPostalOnAttach, player, panicUnitPostal)
  };
})