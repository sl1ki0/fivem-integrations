import { cadRequest } from "~/utils/fetch.server";
import { getPlayerIds } from "~/utils/get-player-ids.server";
import { getPlayerApiToken, prependSnailyCAD } from "../server";
import { ClientEvents, ServerEvents, SnCommands } from "~/types/events";

// todo: add general docs for this plugin.

/**
 * authentication flow
 */
export interface User {
  id: string;
  username: string;
  steamId: string | null;
  discordId: string | null;
  permissions: string[];
}

RegisterCommand(
  SnCommands.WhoAmI,
  async (source: number) => {
    CancelEvent();

    const { data } = await cadRequest<User>({
      method: "POST",
      path: "/user",
      headers: {
        userApiToken: getPlayerApiToken(source),
      },
    });

    if (!data?.id) {
      emitNet("chat:addMessage", source, {
        args: [prependSnailyCAD("Please make sure you're authenticated. Use: ^5/sn-auth^7.")],
      });
      // todo: send client event that user doesn't exist
      return;
    }

    emitNet("chat:addMessage", source, {
      args: [
        prependSnailyCAD(
          `Your SnailyCAD username is ^5${data.username} ^7and user ID is ^5${data.id}^7.`,
        ),
      ],
    });
  },
  false,
);

RegisterCommand(
  SnCommands.Auth,
  (source: number) => {
    CancelEvent();

    const identifiers = getPlayerIds(source, "array");
    emitNet(ClientEvents.RequestAuthFlow, source, identifiers);
  },
  false,
);

onNet(ServerEvents.OnUserSave, async (userData: { token: string }) => {
  const identifiers = getPlayerIds(source, "object");
  if (!identifiers.license) {
    console.error("no license found");
    return;
  }

  SetResourceKvp(`snailycad:${identifiers.license}:token`, userData.token);
});
