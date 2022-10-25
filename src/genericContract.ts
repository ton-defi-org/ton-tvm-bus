//@ts-ignore
import { SmartContract } from "ton-contract-executor";
import { Address, Cell, CommonMessageInfo, contractAddress, InternalMessage, toNano, TonClient } from "ton";
import BN from "bn.js";
import { TvmBus, iTvmBusContract } from ".";
import { ExecutionResult } from "./types";
import { stripStatInitFromMessage } from "./utils";

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
        });
    }

    async sendInternalMessage(message: InternalMessage) {
        let msg = stripStatInitFromMessage(message);
        return this.contract.sendInternalMessage(msg);
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
        // const deployerAddress = Address.parse("EQDjhy1Ig-S0vKCWwd3XZRKODGx0RJyhqW37ZDMl-pgv8iBr");
        // const usdcMinter = await JettonMinter.Create(
        //     new BN(0),
        //     deployerAddress,
        //     "https://ipfs.io/ipfs/dasadas",
        //     tvmBus,
        //     toNano("0.2"),
        // );

        //console.log("initMessage", initMessage);
        console.log({ data });
        // console.log({ dataFake: usdcMinter.contract?.dataCell as Cell });

        console.log({ code });
        // console.log({ codeFake: usdcMinter.contract?.codeCell as Cell });

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
            console.log("Logs => initMessageResultRaw", instance.initMessageResultRaw);
        }
        return instance;
    }
}
