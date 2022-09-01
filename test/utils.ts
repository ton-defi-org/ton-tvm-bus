import BN from "bn.js";
import { execSync } from "child_process";
import { Address, beginCell, Cell, CellMessage, CommonMessageInfo, InternalMessage } from "ton";

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
