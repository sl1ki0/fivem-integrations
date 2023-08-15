import { cadRequest } from "~/utils/fetch.server";
import { getPlayerIds } from "~/utils/get-player-ids.server";

type Response = {
  id: string;
  username: string;
  steamId: string | null;
  discordId: string | null;
  permissions: string[];
} | null;

function prependSnailyCAD(text: string) {
  return `^8^*[SnailyCAD]:^7^r ${text}`;
}

/**
 * authentication flow
 */
RegisterCommand(
  "sn-whoami",
  async (source: number) => {
    CancelEvent();

    const identifiers = getPlayerIds(source, "object");
    const userId = identifiers.license;
    const apiToken = GetResourceKvpString(`snailycad:${userId}:token`);

    const response = await cadRequest("/user", "POST", { userApiToken: apiToken }).catch(
      (error) => {
        console.error(error);
        return null;
      },
    );

    const data = (await response?.body.json()) as Response;

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
  "sn-auth",
  (source: number) => {
    CancelEvent();

    const identifiers = getPlayerIds(source, "array");
    emitNet("sna-sync:request-authentication-flow", source, identifiers);
  },
  false,
);

onNet("sna-sync:request-user-save", async (userData: { token: string }) => {
  const identifiers = getPlayerIds(source, "object");
  if (!identifiers.license) {
    console.error("no license found");
    return;
  }

  SetResourceKvp(`snailycad:${identifiers.license}:token`, userData.token);
});
