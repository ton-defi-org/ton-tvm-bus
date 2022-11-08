// @ts-ignore
import { SmartContract, SuccessfulExecutionResult, FailedExecutionResult, OutAction } from "ton-contract-executor";
import { Address, Cell, CellMessage, InternalMessage, Slice, CommonMessageInfo, TonClient, toNano } from "ton";
import BN from "bn.js";
import { OPS } from "./ops";
const ZERO_ADDRESS = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");
export declare type ExecutionResult = FailedExecutionResult | SuccessfulExecutionResult;

import { iTvmBusContract, TvmBus } from "../src";
import { bytesToAddress, transformStateInitToCell } from "../src/utils";
import { compileFuncToB64 } from "./test-utils";
import { getFeeCollector } from "../src/FeeCollector";
import { ExecutionResultWithFees } from "../src/types";

type UsdcTransferNextOp = OPS.ADD_LIQUIDITY | OPS.SWAP_TOKEN;

export class JettonWallet implements iTvmBusContract {
    public initMessageResult: { logs?: string; actionsList?: OutAction[] } = {};
    public address = ZERO_ADDRESS;
    public initMessageResultRaw?: ExecutionResult;

    private constructor(public readonly contract: SmartContract) {}

    static getCodeCell(): Cell {
        const jettonWalletCodeB64: string = compileFuncToB64(["test/jetton-wallet.fc"]);
        return Cell.fromBoc(jettonWalletCodeB64)[0];
    }

    async getData() {
        let res = await this.contract.invokeGetMethod("get_wallet_data", []);
        const balance = res.result[0] as BN;
        const owner = res.result[1] as Slice;
        const jettonMaster = res.result[2] as Slice;
        const code = res.result[3] as Cell;

        return {
            balance,
            owner,
            //jettonMaster: sliceToAddress(jettonMaster),
            code,
        };
    }

    async sendInternalMessage(message: InternalMessage): Promise<ExecutionResultWithFees | FailedExecutionResult> {
        if (!this.contract) {
            return Promise.resolve({} as FailedExecutionResult);
        }
        let msg = transformStateInitToCell(message);
        let result = await this.contract.sendInternalMessage(msg);
        if (result.type == "failed") {
            return result as FailedExecutionResult;
        }
        let collector = await getFeeCollector();
        const fees = await collector.processMessageFees(message, result);

        return {
            ...result,
            ...fees,
        };
    }

    //    transfer#f8a7ea5 query_id:uint64 amount:(VarUInteger 16) destination:MsgAddress
    //    response_destination:MsgAddress custom_payload:(Maybe ^Cell)
    //    forward_ton_amount:(VarUInteger 16) forward_payload:(Either Cell ^Cell)
    //    = InternalMsgBody;

    static Transfer(to: Address, jettonAmount: BN, responseDestination: Address, forwardTonAmount: BN = new BN(0)) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(OPS.Transfer, 32); // action
        messageBody.bits.writeUint(1, 64); // query-id
        messageBody.bits.writeCoins(jettonAmount);
        messageBody.bits.writeAddress(to);
        messageBody.bits.writeAddress(responseDestination);
        messageBody.bits.writeBit(false); // null custom_payload
        messageBody.bits.writeCoins(forwardTonAmount);
        messageBody.bits.writeUint(1, 1); // to satisfy throw_unless(708, slice_bits(in_msg_body) >= 1);

        return messageBody;
    }

    async transfer(
        from: Address,
        to: Address,
        amount: BN,
        responseDestination: Address,
        customPayload: Cell | undefined,
        forwardTonAmount: BN = new BN(0),
        overloadOp: UsdcTransferNextOp,
        overloadValue: BN,
        tonLiquidity?: BN,
    ) {
        const messageBody = JettonWallet.Transfer(to, amount, responseDestination, forwardTonAmount);

        let res = await this.contract.sendInternalMessage(
            new InternalMessage({
                from: from,
                to: to,
                value: forwardTonAmount.add(toNano("0.08")), // TODO
                bounce: false,
                body: new CommonMessageInfo({ body: new CellMessage(messageBody) }),
            }),
        );

        return {
            ...res,
        };
    }

    setUnixTime(time: number) {
        this.contract.setUnixTime(time);
    }

    static async GetData(client: TonClient, jettonWallet: Address) {
        let res = await client.callGetMethod(jettonWallet, "get_wallet_data", []);

        const balance = BigInt(res.stack[0][1]);
        const owner = bytesToAddress(res.stack[1][1].bytes);
        const jettonMaster = bytesToAddress(res.stack[2][1].bytes);

        return {
            balance,
            owner,
            jettonMaster,
        };
    }

    static async createFromMessage(
        code: Cell,
        data: Cell,
        initMessage: InternalMessage,
        tvmBus?: TvmBus,
    ): Promise<iTvmBusContract> {
        const jettonWallet = await SmartContract.fromCell(code, data, { getMethodsMutate: true, debug: true });

        const contract = new JettonWallet(jettonWallet);

        let msg = transformStateInitToCell(initMessage);
        const initRes = await jettonWallet.sendInternalMessage(msg);
        let successResult = initRes as SuccessfulExecutionResult;
        const initMessageResponse = {
            ...successResult,
        };
        // @ts-ignore
        contract.initMessageResult = initMessageResponse;
        contract.initMessageResultRaw = initRes;
        contract.address = initMessage.to;
        if (tvmBus) {
            tvmBus.registerContract(contract as iTvmBusContract);
        }

        return contract;
    }
}
