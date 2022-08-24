import BN from "bn.js";
import { Address, Cell, InternalMessage, Message, CommonMessageInfo, CellMessage, OutAction } from "ton";
import { ExecutionResult, iTvmBusContract, ParsedExecutionResult, SuccessfulExecutionResult, ThinInternalMessage } from "./types";

function filterLogs(logs: string): string[] {
    if (typeof logs == "object") {
        return [];
    }

    const arr = logs.split("\n");
    //    console.log(arr.length);

    let filtered = arr.filter((it) => {
        return it.indexOf("#DEBUG#") !== -1 || it.indexOf("error") !== -1;
    });
    const beautified = filtered.map((it, i) => {
        const tabIndex = it.indexOf("\t");
        return `${i + 1}. ${it.substring(tabIndex + 1, it.length)}`;
    });

    return beautified;
}

export function parseResponse(inMessage: InternalMessage, response: ExecutionResult, receivingContract: iTvmBusContract, isDeployedByAction = false): ParsedExecutionResult {
    // @ts-ignore

    let successResult = response as SuccessfulExecutionResult;
    return {
        time: new Date().toISOString(),
        from: inMessage.from as Address,
        inMessage: stripMessage(inMessage),
        contractImpl: receivingContract,
        contractAddress: receivingContract.address as Address,
        exit_code: response.exit_code,
        // returnValue: response.result[1] as BN,
        logs: filterLogs(response.logs),
        actions: successResult.actionList,
        actionList: successResult.actionList,
        isDeployedByAction,
    };
}

function stripMessage(message: InternalMessage): ThinInternalMessage {
    const bodyStr = messageToString(message.body?.body);
    const stateInitStr = messageToString(message.body?.stateInit);

    return {
        value: message.value,
        body: bodyStr,
        stateInit: stateInitStr,
        mode: -1,
    };
}

function messageToString(message: Message | null) {
    if (!message) {
        return "";
    }
    let cell = new Cell();
    message.writeTo(cell);
    return cell.toString().replace("\n", "");
}

export function actionToMessage(from: Address, action: OutAction | undefined, inMessage: InternalMessage, response: ExecutionResult, bounce = true) {
    //@ts-ignore
    const sendMessageAction = action as SendMsgOutAction;

    let messageValue = sendMessageAction.message?.info?.value.coins;
    if (sendMessageAction.mode == 64) {
        messageValue = inMessage.value;
        //console.log(`message.coins`, sendMessageAction.mode, fromNano(messageValue));
    }

    //  if (sendMessageAction.message?.info?.value.coins.toString() == "0") {
    // console.log(sendMessageAction, sendMessageAction.message, fromNano(sendMessageAction.message?.info?.value.coins));
    //  }
    let msg = new CommonMessageInfo({
        body: new CellMessage(sendMessageAction.message?.body),
    });

    return new InternalMessage({
        to: sendMessageAction.message?.info.dest,
        from,
        value: messageValue,
        bounce,
        body: msg,
    });
}
