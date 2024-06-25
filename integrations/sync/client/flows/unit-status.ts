import { StatusValue } from "@snailycad/types";
import { ClientEvents, ServerEvents, SnCommands } from "~/types/events";

const API_URL = GetConvar("snailycad_url", "null");

emit(
  "chat:addSuggestion",
  `/${SnCommands.ActiveUnit}`,
  "This will show your active unit's name and status.",
);
emit(
  "chat:addSuggestion",
  `/${SnCommands.SetStatus}`,
  "This will open a menu and will allow you to select a status for your active unit.",
  [{ name: "status-code", help: "The status code you want to set (Optional)." }],
);

// request to open the set status modal
onNet(
  ClientEvents.RequestSetStatusFlow,
  (unitId: string, source: number, userApiToken: string, statusCodes: StatusValue[]) => {
    SendNuiMessage(
      JSON.stringify({
        action: ClientEvents.RequestSetStatusFlow,
        data: { url: API_URL, source, unitId, userApiToken, statusCodes },
      }),
    );
    SetNuiFocus(true, true);
  },
);

onNet(ClientEvents.RequestPanicStatusFlow, () => {
  const playerPed = GetPlayerPed(-1);
  const [x, y, z] = GetEntityCoords(playerPed, true);
  const [lastStreet] = GetStreetNameAtCoord(x!, y!, z!);
  const lastStreetName = GetStreetNameFromHashKey(lastStreet);
  const heading = GetEntityHeading(PlayerPedId());

  setImmediate(() => {
    emitNet(ServerEvents.ValidatePanicRoute, {
      street: lastStreetName,
      position: {x, y, z, heading},
    })
  })
});