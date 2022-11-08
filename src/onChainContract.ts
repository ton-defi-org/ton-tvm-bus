//@ts-ignore
import { SmartContract } from "ton-contract-executor";
import { Address, Cell, InternalMessage, TonClient } from "ton";
import BN from "bn.js";
import { TvmBus, iTvmBusContract } from ".";
import { transformStateInitToCell } from "./utils";
import { getFeeCollector } from "./FeeCollector";
import { FailedExecutionResult, ExecutionResultWithFees, ContractData } from "./types";

export class OnChainContract implements iTvmBusContract {
    contract: SmartContract;
    public address: Address;
    public code: Cell;
    public dataState: ContractData;

    private constructor(contract: SmartContract, myAddress: Address, balance: BN, code: Cell) {
        this.contract = contract;
        this.address = myAddress;
        this.code = code;
        this.contract.setC7Config({
            myself: myAddress,
            balance: balance,
        });

        this.dataState = {
            previousState: contract.dataCell,
            currentState: contract.dataCell,
            hasChanged: false,
        };
    }

    async sendInternalMessage(message: InternalMessage): Promise<ExecutionResultWithFees | FailedExecutionResult> {
        let msg = transformStateInitToCell(message);
        const initialDataCell = this.contract.dataCell;
        let result = await this.contract.sendInternalMessage(msg);
        const currentDataCell = this.contract.dataCell;
        if (result.type == "failed") {
            return result as FailedExecutionResult;
        }
        this.dataState = {
            previousState: initialDataCell,
            currentState: currentDataCell,
            hasChanged: !initialDataCell.equals(currentDataCell),
        };
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
