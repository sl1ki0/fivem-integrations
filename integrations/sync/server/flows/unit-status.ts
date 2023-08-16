import { cadRequest } from "~/utils/fetch.server";
import { getPlayerApiToken, prependSnailyCAD } from "../server";
import { getPlayerIds } from "~/utils/get-player-ids.server";
import { ClientEvents, ServerEvents, SnCommands } from "~/types/Events";

// todo: add general docs for this plugin.

/**
 * duty status
 */
export interface User {
  id: string;
  username: string;
  steamId: string | null;
  discordId: string | null;
  permissions: string[];
}

RegisterCommand(
  SnCommands.ActiveUnit,
  async (source: number) => {
    CancelEvent();

    const { data } = await cadRequest<User & { unit: any }>({
      method: "POST",
      path: "/user?includeActiveUnit=true",
      headers: {
        userApiToken: getPlayerApiToken(source),
      },
    });

    if (!data?.id) {
      emitNet("chat:addMessage", source, {
        args: [prependSnailyCAD("Please make sure you're authenticated. Use: ^5/sn-auth^7.")],
      });
      return;
    }

    if (!data.unit) {
      emitNet("chat:addMessage", source, {
        args: [
          prependSnailyCAD(
            "No active unit found. Go on-duty first in the SnailyCAD web interface.",
          ),
        ],
      });
      return;
    }

    const unitName = getUnitName(data.unit);
    const unitStatus = data.unit.status?.value?.value ?? "None";

    emitNet("chat:addMessage", source, {
      args: [
        prependSnailyCAD(`Your active unit is ^5${unitName} ^7with status of ^5${unitStatus}^7.`),
      ],
    });
  },
  false,
);

RegisterCommand(
  SnCommands.SetStatus,
  async (source: number, extraArgs?: string[]) => {
    CancelEvent();

    const { data } = await cadRequest<User & { unit: any }>({
      method: "POST",
      path: "/user?includeActiveUnit=true",
      headers: {
        userApiToken: getPlayerApiToken(source),
      },
    });

    if (!data?.id) {
      emitNet("chat:addMessage", source, {
        args: [prependSnailyCAD("Please make sure you're authenticated. Use: ^5/sn-auth^7.")],
      });
      return;
    }

    if (!data.unit) {
      emitNet("chat:addMessage", source, {
        args: [prependSnailyCAD("No active unit found. Go on-duty first.")],
      });
      return;
    }

    const { data: values } = await cadRequest<{ type: string; values: any[] }[]>({
      method: "GET",
      path: "/admin/values/codes_10?includeAll=true",
      headers: {
        userApiToken: getPlayerApiToken(source),
      },
    });

    const all10Codes = values?.find((v) => v.type === "CODES_10") ?? null;
    const statusCodes = all10Codes?.values.filter((v) => v.type === "STATUS_CODE") ?? [];

    const [statusCode] = extraArgs ?? [];

    if (statusCode) {
      const nearestStatusCode = statusCodes.find((v) =>
        v.value.value.toLowerCase().startsWith(statusCode.toLowerCase()),
      );

      if (!nearestStatusCode) {
        emitNet("chat:addMessage", source, {
          args: [prependSnailyCAD("An invalid status code was provided.")],
        });
        return;
      }

      emit(ServerEvents.OnSetUnitStatus, source, data.unit.id, nearestStatusCode.id);

      return;
    }

    const identifiers = getPlayerIds(source, "array");
    emitNet(
      ClientEvents.RequestSetStatusFlow,
      source,
      data.unit.id,
      source,
      identifiers,
      statusCodes,
    );
  },
  false,
);

onNet(
  ServerEvents.OnSetUnitStatus,
  async (source: number, unitId: string, statusCodeId: string) => {
    const { data: updatedUnit } = await cadRequest<{ id: string } & Record<string, any>>({
      method: "PUT",
      path: `/dispatch/status/${unitId}`,
      headers: {
        userApiToken: getPlayerApiToken(source),
      },
      data: {
        status: statusCodeId,
      },
    });

    if (!updatedUnit?.id) {
      emitNet("chat:addMessage", source, {
        args: [prependSnailyCAD("An error occurred while updating your status.")],
      });

      return;
    }

    emitNet("chat:addMessage", source, {
      args: [
        prependSnailyCAD(`Your status has been updated to ^5${updatedUnit.status?.value.value}^7.`),
      ],
    });
  },
);

function getUnitName(unit: any) {
  if ("deputies" in unit || "officers" in unit) return "";
  if (!unit.citizen) return "Unknown";
  return `${unit.citizen.name} ${unit.citizen.surname}`;
}