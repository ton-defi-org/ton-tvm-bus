//@ts-ignore
import { SmartContract } from "ton-contract-executor";
import { Address, Cell, InternalMessage, TonClient } from "ton";
import BN from "bn.js";
import { TvmBus, iTvmBusContract } from ".";
import { transformStateInitToCell } from "./utils";
import { getFeeCollector } from "./FeeCollector";
import { FailedExecutionResult, ExecutionResultWithFees } from "./types";

export class OnChainContract implements iTvmBusContract {
    contract: SmartContract;
    public address: Address;
    public code: Cell;

    private constructor(contract: SmartContract, myAddress: Address, balance: BN, code: Cell) {
        this.contract = contract;
        this.address = myAddress;
        this.code = code;
        this.contract.setC7Config({
            myself: myAddress,
            balance: balance,
        });
    }

    async sendInternalMessage(message: InternalMessage) {
        let msg = transformStateInitToCell(message);
        return this.contract.sendInternalMessage(msg);
    }

    async sendInternalMessage2(message: InternalMessage): Promise<ExecutionResultWithFees | FailedExecutionResult> {
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

    getCodeCell() {
        return this.code;
    }

    static async Create(client: TonClient, contractAddress: Address, tvmBus: TvmBus) {
        const state = await client.getContractState(contractAddress);
        if (!state.code) {
            return null;
        }
        const code = Cell.fromBoc(state.code!)[0];
        const data = Cell.fromBoc(state.data!)[0];
        const balance = await client.getBalance(contractAddress);

        const contract = await SmartContract.fromCell(code, data, {
            getMethodsMutate: true,
        });

        const instance = new OnChainContract(contract, contractAddress, balance, Cell.fromBoc(state.code!)[0]);
        if (tvmBus) {
            tvmBus.registerContract(instance);
        }
        return instance;
    }
}
