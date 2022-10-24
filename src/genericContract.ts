//@ts-ignore
import { SmartContract } from "ton-contract-executor";
import { Address, Cell, contractAddress, InternalMessage, TonClient } from "ton";
import BN from "bn.js";
import { TvmBus, iTvmBusContract } from ".";
import { ExecutionResult } from "../lib/src";

export class GenericContract implements iTvmBusContract {
    contract: SmartContract;
    public address: Address;
    public code: Cell;
    public initMessageResultRaw?: ExecutionResult;

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
        return this.contract.sendInternalMessage(message);
    }

    getCodeCell() {
        return this.code;
    }

    static async Create(tvmBus: TvmBus, code: Cell, data: Cell, initMessage: InternalMessage, balance: BN) {
        const contract = await SmartContract.fromCell(code, data, {
            getMethodsMutate: true,
        });
        const address = contractAddress({ workchain: 0, initialCode: code, initialData: data });
        const instance = new GenericContract(contract, address, balance, code);
        if (tvmBus) {
            tvmBus.registerContract(instance);
        }
        instance.initMessageResultRaw = await instance.contract.sendInternalMessage(initMessage);
        return instance;
    }
}
