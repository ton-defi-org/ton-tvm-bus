import {
    Address,
    Cell,
    InternalMessage,
    Message,
    CommonMessageInfo,
    CellMessage,
    beginCell,
    Slice,
    StateInit,
} from "ton";
import { OutAction } from "ton-contract-executor";
import { execSync } from "child_process";

import {
    ExecutionResult,
    iTvmBusContract,
    ParsedExecutionResult,
    SuccessfulExecutionResult,
    ThinInternalMessage,
} from "./types";
import BN from "bn.js";

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

export function parseResponse(
    inMessage: InternalMessage,
    response: ExecutionResult,
    receivingContract: iTvmBusContract,
    isDeployedByAction = false,
    caller = "",
): ParsedExecutionResult {
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
    //return "xxx{xx}xxxx";
    let cell = new Cell();
    try {
        message.writeTo(cell);
        return cell.toString().replace("\n", "");
    } catch (e) {
        // TODO: fix this part
        return "}x{";
    }
}

export function actionToMessage(
    from: Address,
    action: OutAction,
    inMessage: InternalMessage,
    response: ExecutionResult,
    bounce = true,
) {
    //@ts-ignore
    //console.log("action1", action);

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
        stateInit: sendMessageAction.message?.init,
    });

    return new InternalMessage({
        to: sendMessageAction.message?.info.dest,
        from,
        value: messageValue,
        bounce,
        body: msg,
    });
}

export function stripStatInitFromMessage(message: InternalMessage) {
    return new InternalMessage({
        to: message.to as Address,
        from: message.from as Address,
        bounce: message.bounce,
        body: new CommonMessageInfo({
            body: message.body.body,
        }),
        value: message.value,
    });
}

export function bytesToAddress(bufferB64: string) {
    const buff = Buffer.from(bufferB64, "base64");
    let c2 = Cell.fromBoc(buff);
    return c2[0].beginParse().readAddress() as Address;
}

export function messageGenerator(opts: {
    to: Address;
    from: Address;
    body: Cell;
    stateInit?: StateInit;
    value: BN;
    bounce?: boolean;
}) {
    return new InternalMessage({
        from: opts.from,
        to: opts.to,
        value: opts.value,
        bounce: opts.bounce || false,
        body: new CommonMessageInfo({
            body: new CellMessage(opts.body),
            stateInit: opts.stateInit,
        }),
    });
}

type encoding = "hex" | "base64";

export function cellFromString(cellStr: string, stringEncoding: encoding = "hex") {
    return beginCell().storeBuffer(Buffer.from(cellStr, stringEncoding)).endCell();
}

// Source: https://github.com/ton-blockchain/ton/blob/24dc184a2ea67f9c47042b4104bbb4d82289fac1/crypto/block/block.tlb#L141
// _ split_depth:(Maybe (## 5)) special:(Maybe TickTock)
//  code:(Maybe ^Cell) data:(Maybe ^Cell)
//  library:(HashmapE 256 SimpleLib) = StateInit;
export type RawStateInit2 = {
    splitDepth: number | null;
    code: Cell | null;
    data: Cell | null;
    special: null;
    raw: Cell;
};
export function parseStateInit2(slice: Slice): RawStateInit2 {
    let raw = slice.toCell();
    let splitDepth: number | null = null;
    if (slice.readBit()) {
        splitDepth = slice.readUintNumber(5);
    }
    const special = null;
    const hasCode = slice.readBit();
    const code = hasCode ? slice.readCell() : null;
    const hasData = slice.readBit();
    const data = hasData ? slice.readCell() : null;
    if (slice.readBit()) {
        slice.readCell(); // Skip libraries for now
    }

    return { splitDepth, data, code, special, raw };
}
