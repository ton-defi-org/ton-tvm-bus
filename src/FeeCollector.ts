import { SuccessResult } from "@ton.org/func-js";
import BN from "bn.js";
import {
    Address,
    Cell,
    computeGasPrices,
    computeMessageForwardFees,
    computeStorageFees,
    configParse18,
    configParseGasLimitsPrices,
    configParseMsgPrices,
    fromNano,
    InternalMessage,
    parseDictRefs,
    Slice,
    StateInit,
    TonClient,
    TonClient4,
} from "ton";
import { OutAction, SendMsgAction } from "ton-contract-executor";
import { StoragePrices } from "ton/dist/contracts/configs/configParsing";
import { ExecutionResult } from "../lib/src";
import { actionToMessage } from "./utils";

type MessagePrices = {
    lumpPrice: BN;
    bitPrice: BN;
    cellPrice: BN;
    ihrPriceFactor: BN;
    firstFrac: BN;
    nextFrac: BN;
};

type GasLimitsPrices = {
    flatLimit: BN;
    flatGasPrice: BN;
    other:
        | {
              gasPrice: BN;
              gasLimit: BN;
              specialGasLimit: BN;
              gasCredit: BN;
              blockGasLimit: BN;
              freezeDueLimit: BN;
              deleteDueLimit: BN;
          }
        | {
              gasPrice: BN;
              gasLimit: BN;
              gasCredit: BN;
              blockGasLimit: BN;
              freezeDueLimit: BN;
              deleteDueLimit: BN;
              specialGasLimit?: undefined;
          };
};

type FwdFee = {
    fees: BN;
    remaining: BN;
};

type MessageFees = {
    computationPhase: BN;
    fwdFee: BN;
    fwdFeeRemaining: BN;
};

class FeeCollector {
    #storagePrices: StoragePrices[];
    #msgPrices: MessagePrices;
    #gasPrices: GasLimitsPrices;

    constructor(storagePrices: StoragePrices[], msgPrices: MessagePrices, gasPrices: GasLimitsPrices) {
        this.#storagePrices = storagePrices;
        this.#msgPrices = msgPrices;
        this.#gasPrices = gasPrices;
    }

    static async Create() {
        const client = new TonClient4({ endpoint: "https://mainnet-v4.tonhubapi.com" });
        const seqno = 20713508;
        const config = await client.getConfig(seqno);
        const dict = parseDictRefs(Cell.fromBoc(Buffer.from(config.config.cell, "base64"))[0].beginParse(), 32);
        const storagePrices = configParse18(dict.get("18"));
        const msgPrices = configParseMsgPrices(dict.get("25")); // Workchain
        const gasPrices = configParseGasLimitsPrices(dict.get("21")); // Workchain
        return new FeeCollector(storagePrices, msgPrices, gasPrices);
    }

    //async beforeMessage(message: InternalMessage): Promise<InternalMessage> {}

    async processFwd(message: InternalMessage) {
        const cell = new Cell();

        try {
            message.writeTo(cell);
            return computeMessageForwardFees(this.#msgPrices, cell);
        } catch (e) {
            console.log(
                `message.fwdFees throw message.body.stateInit=${message.body.stateInit} message.body.body=${message.body.body}`,
                message.body.stateInit,
                message.body.body,
            );
            return {
                fees: new BN(0),
                remaining: new BN(0),
            };
        }
    }

    async processMessageFees(message: InternalMessage, result: ExecutionResult): Promise<MessageFees> {
        // let storageFees = computeStorageFees({
        //     lastPaid: storageStat.lastPaid,
        //     masterchain: false,
        //     now: now,
        //     special: false,
        //     storagePrices,
        //     storageStat: {
        //         bits: storageStat.used.bits,
        //         cells: storageStat.used.cells,
        //         publicCells: storageStat.used.publicCells,
        //     },
        // });

        const gasFees = computeGasPrices(new BN(result.gas_consumed), {
            flatLimit: this.#gasPrices.flatLimit,
            flatPrice: this.#gasPrices.flatGasPrice,
            price: this.#gasPrices.other.gasPrice,
        });

        const fwdFee = await this.processFwd(message);

        return {
            // TODO: STORAGE_FEES
            computationPhase: gasFees,
            fwdFee: fwdFee.fees,
            fwdFeeRemaining: fwdFee.remaining,
        };
    }
}

let instance = FeeCollector.Create();

export function getFeeCollector() {
    return instance;
}
