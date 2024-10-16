import { ClientEvents, NuiEvents, ServerEvents, SnCommands } from "~/types/events";
import "./flows/auth";
import "./flows/unit-status";
import "./flows/911-call-attach";
import "./flows/traffic-stop";
import { Call911 } from "@snailycad/types";

const API_URL = GetConvar("snailycad_url", "null");

if (API_URL === "null") {
  console.error(`
  ---------------------------------------

[${GetCurrentResourceName()}] Failed to find the "snailycad_url" convar in your server.cfg. Please make sure you are using \`setr\` and not \`set\`:

\`setr snailycad_url "<api-url-here>/v1" \`

  ---------------------------------------`);
}

emit(
  "chat:addSuggestion",
  `/${SnCommands.PanicButton}`,
  "Toggle the panic button state for your active unit.",
);

/**
 * send a message to the NUI with the API URL when a player joins or when the resource is started
 */
on("onClientResourceStart", (resource: string) => {
  if (resource !== GetCurrentResourceName()) return;
  // @ts-expect-error index is not required
  const currentResourceVersion = GetResourceMetadata(GetCurrentResourceName(), "version");

  setTimeout(() => {
    SendNuiMessage(
      JSON.stringify({
        action: "sn:initialize",
        data: { version: currentResourceVersion, url: API_URL },
      }),
    );
  }, 500);
});

onNet(
  ClientEvents.CreateNotification,
  (options: { timeout?: number; title: string; message: string }) => {
    SendNuiMessage(
      JSON.stringify({
        action: ClientEvents.CreateNotification,
        data: { ...options, url: API_URL },
      }),
    );
  },
);

/**
 * event: connected
 * simply send a message back to the NUI side to confirm that we are connected.
 */
RegisterNuiCallbackType(NuiEvents.Connected);
on(`__cfx_nui:${NuiEvents.Connected}`, (_data: never, cb: Function) => {
  console.info("Connected to SnailyCAD!");
  cb({ ok: true });
});

/**
 * event: closeNui
 * close the NUI window.
 */
RegisterNuiCallbackType(NuiEvents.CloseNui);
on(`__cfx_nui:${NuiEvents.CloseNui}`, (_data: never, cb: Function) => {
  SetNuiFocus(false, false);
  cb({ ok: true });
});

RegisterNuiCallbackType(NuiEvents.ConnectionError);
on(`__cfx_nui:${NuiEvents.ConnectionError}`, (data: Partial<Error> | null, cb: Function) => {
  console.info(data?.message ?? data?.name ?? (String(data) || "Unknown error"));
  console.info("Unable to connect to SnailyCAD. Error:", data);
  cb({ ok: true });
});

RegisterNuiCallbackType(NuiEvents.Create911Call);
on(`__cfx_nui:${NuiEvents.Create911Call}`, (data: Call911, cb: Function) => {
  emitNet(ServerEvents.Incoming911Call, data);
  cb({ ok: true });
});

RegisterNuiCallbackType(NuiEvents.PanicButtonOn);
on(`__cfx_nui:${NuiEvents.PanicButtonOn}`, (data: { formattedUnitData: string }, cb: Function) => {
  emitNet(ServerEvents.PanicButtonOn, data);
  cb({ ok: true });
});

RegisterNuiCallbackType(NuiEvents.Update911Call);
on(`__cfx_nui:${NuiEvents.Update911Call}`, (data: any, cb: Function) => {
  emitNet(ServerEvents.CallUpdated, data);
  cb({ ok: true });
});
