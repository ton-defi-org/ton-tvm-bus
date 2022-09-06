//@ts-ignore
import { SmartContract } from "ton-contract-executor";
import { Address, Cell, InternalMessage, TonClient } from "ton";
import BN from "bn.js";
import { TvmBus, iTvmBusContract } from ".";

export class OnChainContract implements iTvmBusContract {
    contract: SmartContract;
    public address: Address;
    public code: Cell[];

    private constructor(contract: SmartContract, myAddress: Address, balance: BN, code: Cell[]) {
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

    static async Create(client: TonClient, contractAddress: Address, tvmBus: TvmBus) {
        const state = await client.getContractState(contractAddress);

        const code = Cell.fromBoc(state.code!)[0];
        const data = Cell.fromBoc(state.data!)[0];
        const balance = await client.getBalance(contractAddress);

        const contract = await SmartContract.fromCell(code, data, {
            getMethodsMutate: true,
        });

        const instance = new OnChainContract(contract, contractAddress, balance, Cell.fromBoc(state.code!));
        if (tvmBus) {
            tvmBus.registerContract(instance);
        }
        return instance;
    }
}
