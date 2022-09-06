import { Address, Cell, InternalMessage, Message, CommonMessageInfo, CellMessage, beginCell } from "ton";
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
    let cell = new Cell();
    message.writeTo(cell);
    return cell.toString().replace("\n", "");
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

    // if (action.ran) {
    //     throw "action ran twice";
    // }
    // action.ran = 1;

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

export function compileFuncToB64(funcFiles: string[]): string {
    const funcPath = process.env.FUNC_PATH || "func";
    try {
        execSync(`${funcPath} -o build/tmp.fif  -SPA ${funcFiles.join(" ")}`);
    } catch (e: any) {
        if (e.message.indexOf("error: `#include` is not a type identifier") > -1) {
            console.log(`
===============================================================================
Please update your func compiler to support the latest func features
to set custom path to your func compiler please set  the env variable "export FUNC_PATH=/usr/local/bin/func" 
===============================================================================
`);
            process.exit(1);
        } else {
            console.log(e.message);
        }
    }

    const stdOut = execSync(`fift -s build/print-hex.fif`).toString();
    return stdOut.trim();
}

export function bytesToAddress(bufferB64: string) {
    const buff = Buffer.from(bufferB64, "base64");
    let c2 = Cell.fromBoc(buff);
    return c2[0].beginParse().readAddress() as Address;
}

export function messageGenerator(opts: { to: Address; from: Address; body: Cell; value: BN; bounce?: boolean }) {
    return new InternalMessage({
        from: opts.from,
        to: opts.to,
        value: opts.value,
        bounce: opts.bounce || false,
        body: new CommonMessageInfo({
            body: new CellMessage(opts.body),
        }),
    });
}

type encoding = "hex" | "base64";

export function cellFromString(cellStr: string, stringEncoding: encoding = "hex") {
    return beginCell().storeBuffer(Buffer.from(cellStr, stringEncoding)).endCell();
}
