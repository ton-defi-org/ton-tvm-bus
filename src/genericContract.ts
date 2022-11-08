//@ts-ignore
import { SmartContract } from "ton-contract-executor";
import { Address, Cell, CommonMessageInfo, contractAddress, InternalMessage, toNano, TonClient } from "ton";
import BN from "bn.js";
import { TvmBus, iTvmBusContract } from ".";
import { ContractData, ExecutionResult, ExecutionResultWithFees, FailedExecutionResult } from "./types";
import { transformStateInitToCell } from "./utils";
import { getFeeCollector } from "./FeeCollector";

export class GenericContract implements iTvmBusContract {
    contract: SmartContract;
    public address: Address;
    public code: Cell;
    public initMessageResultRaw?: ExecutionResult;
    public dataState: ContractData;

    private constructor(contract: SmartContract, myAddress: Address, balance: BN, code: Cell) {
        this.contract = contract;
        this.address = myAddress;
        this.code = code;
        this.contract.setC7Config({
            myself: myAddress,
        });
        this.dataState = {
            previousState: contract.dataCell,
            currentState: contract.dataCell,
            hasChanged: false,
        };
    }

    async sendInternalMessage(message: InternalMessage): Promise<ExecutionResultWithFees | FailedExecutionResult> {
        let collector = await getFeeCollector();
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
        const fees = await collector.processMessageFees(message, result);

        return {
            ...result,
            ...fees,
        };
    }

    getCodeCell() {
        return this.code;
    }

    static async Create(
        tvmBus: TvmBus,
        code: Cell,
        data: Cell,
        initMessage: InternalMessage,
        balance: BN,
        processMessageAfterInit: boolean,
    ) {
        const contract = await SmartContract.fromCell(code, data, {
            getMethodsMutate: true,
        });

        const address = contractAddress({ workchain: 0, initialCode: code, initialData: data });
        const instance = new GenericContract(contract, address, balance, code);
        tvmBus.registerContract(instance);

        if (processMessageAfterInit) {
            console.log("to", initMessage.to.toFriendly());
            console.log("from", initMessage?.from!.toFriendly());

            instance.initMessageResultRaw = await instance.sendInternalMessage(initMessage);
        }
        return instance;
    }
}
