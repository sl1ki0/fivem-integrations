import { cadRequest } from "~/utils/fetch.server";
import { getPlayerApiToken, prependSnailyCAD } from "../server";
import { ClientEvents, ServerEvents, SnCommands } from "~/types/events";
import {
  Get911CallByIdData,
  Get911CallsData,
  GetUserData,
  Post911CallAssignUnAssign,
} from "@snailycad/types/api";

RegisterCommand(
  SnCommands.AttachTo911Call,
  async (source: number, extraArgs?: string[]) => {
    CancelEvent();

    const userApiToken = getPlayerApiToken(source);
    const { data } = await cadRequest<GetUserData>({
      method: "POST",
      path: "/user?includeActiveUnit=true",
      headers: { userApiToken },
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

    const [caseNumber] = extraArgs ?? [];
    if (caseNumber) {
      const caseNumberWithoutHash = caseNumber.startsWith("#")
        ? caseNumber.replace("#", "")
        : caseNumber;

      const { data: call } = await cadRequest<Get911CallByIdData>({
        method: "GET",
        path: `/911-calls/${caseNumberWithoutHash}`,
        headers: { userApiToken },
      });

      if (!call?.id) {
        emitNet("chat:addMessage", source, {
          args: [
            prependSnailyCAD("That call could not be found. Please try a different case-number."),
          ],
        });
        return;
      }

      emit(ServerEvents.OnCall911Attach, source, "assign", data.unit.id, call.id);
      return;
    }

    const { data: callData } = await cadRequest<Get911CallsData>({
      method: "GET",
      path: "/911-calls",
      headers: { userApiToken },
    });

    emitNet(
      ClientEvents.RequestCall911AttachFlow,
      source,
      data.unit.id,
      source,
      callData?.calls ?? [],
      userApiToken,
    );
  },
  false,
);

onNet(
  ServerEvents.OnCall911Attach,
  async (source: number, type: "assign" | "unassign", unitId: string, callId: string) => {
    const { data: updatedCall } = await cadRequest<Post911CallAssignUnAssign>({
      method: "POST",
      path: `/911-calls/${type}/${callId}`,
      data: {
        unit: unitId,
      },
      headers: { userApiToken: getPlayerApiToken(source) },
    });

    if (!updatedCall?.id) {
      emitNet("chat:addMessage", source, {
        args: [prependSnailyCAD("An error occurred while attaching you to the call.")],
      });

      return;
    }

    if (type === "assign") {
      emitNet("chat:addMessage", source, {
        args: [
          prependSnailyCAD(
            `Successfully attached yourself to a call with case number: #${updatedCall.caseNumber}.`,
          ),
        ],
      });
      emitNet(ClientEvents.AutoPostalOnAttach, source, updatedCall.postal);
    } else {
      emitNet("chat:addMessage", source, {
        args: [
          prependSnailyCAD(
            `Successfully removed yourself from a call with case number: #${updatedCall.caseNumber}.`,
          ),
        ],
      });
    }
  },
);
