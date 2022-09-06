//@ts-ignore
import { SmartContract, SuccessfulExecutionResult } from "ton-contract-executor";

import {
    Address,
    Cell,
    CellMessage,
    InternalMessage,
    Slice,
    CommonMessageInfo,
    ExternalMessage,
    toNano,
    TonClient,
    contractAddress,
    Contract,
    beginCell,
} from "ton";
import BN from "bn.js";
import { compileFuncToB64 } from "../src/utils";
import { OPS } from "./ops";
import { TvmBus, iTvmBusContract, ExecutionResult } from "../src";

const OFFCHAIN_CONTENT_PREFIX = 0x01;

export class JettonMinter implements iTvmBusContract {
    private constructor(contract: SmartContract, myAddress: Address, balance: BN) {
        this.contract = contract;
        this.address = myAddress;

        this.contract.setC7Config({
            myself: myAddress,
            balance: balance,
        });
    }

    contract?: SmartContract;
    public address?: Address;

    async getData() {
        if (!this.contract) {
            return;
        }

        let res = await this.contract.invokeGetMethod("get_jetton_data", []);
        //@ts-ignore
        const totalSupply = res.result[0] as BN;
        const wc = res.result[1] as BN;
        const jettonMaster = res.result[2] as Slice;
        const content = res.result[2] as Cell;
        const code = res.result[3] as Cell;

        return {
            totalSupply,
            wc,
            content,
            jettonMaster,
            code,
        };
    }

    async init(fakeAddress: Address) {
        if (!this.contract) {
            return;
        }
        let messageBody = new Cell();
        messageBody.bits.writeUint(1, 1);
        let msg = new CommonMessageInfo({ body: new CellMessage(messageBody) });

        let res = await this.contract.sendExternalMessage(
            new ExternalMessage({
                to: fakeAddress,
                body: msg,
            }),
        );
        return res;
    }

    // const body = new Cell();
    // body.bits.writeUint(21, 32); // OP mint
    // body.bits.writeUint(params.queryId || 0, 64); // query_id
    // body.bits.writeAddress(params.destination);
    // body.bits.writeCoins(params.amount); // in Toncoins

    // const transferBody = new Cell(); // internal transfer
    // transferBody.bits.writeUint(0x178d4519, 32); // internal_transfer op
    // transferBody.bits.writeUint(params.queryId || 0, 64);
    // transferBody.bits.writeCoins(params.jettonAmount);
    // transferBody.bits.writeAddress(null); // from_address
    // transferBody.bits.writeAddress(null); // response_address
    // transferBody.bits.writeCoins(new BN(0)); // forward_amount
    // transferBody.bits.writeBit(false); // forward_payload in this slice, not separate cell

    static Mint(receiver: Address, jettonAmount: BN, tonAmount = toNano(0.04)) {
        let messageBody = new Cell();
        messageBody.bits.writeUint(OPS.MINT, 32); // action;
        messageBody.bits.writeUint(1, 64); // query;
        messageBody.bits.writeAddress(receiver);
        messageBody.bits.writeCoins(tonAmount);

        const masterMessage = new Cell();
        masterMessage.bits.writeUint(0x178d4519, 32); // action;
        masterMessage.bits.writeUint(0, 64); // query;
        masterMessage.bits.writeCoins(jettonAmount);
        masterMessage.bits.writeAddress(null); // from_address
        masterMessage.bits.writeAddress(null); // response_address
        masterMessage.bits.writeCoins(new BN(0)); // forward_amount
        masterMessage.bits.writeBit(false); // forward_payload in this slice, not separate cell

        messageBody.refs.push(masterMessage);
        return messageBody;
    }

    async mint(sender: Address, receiver: Address, jettonAmount: BN) {
        if (!this.contract) {
            return;
        }
        let res = await this.contract.sendInternalMessage(
            new InternalMessage({
                from: sender,
                to: this.address as Address,
                value: new BN(10001),
                bounce: false,
                body: new CommonMessageInfo({
                    body: new CellMessage(JettonMinter.Mint(receiver, jettonAmount)),
                }),
            }),
        );

        let successResult = res as SuccessfulExecutionResult;

        return {
            ...res,
            returnValue: res.result[1] as BN,
        };
    }

    async sendInternalMessage(message: InternalMessage) {
        if (!this.contract) {
            return Promise.resolve({} as ExecutionResult);
        }
        return this.contract.sendInternalMessage(message);
    }

    async mintMessage(sender: Address, receiver: Address, jettonAmount: BN) {
        return new InternalMessage({
            from: sender,
            to: this.address as Address,
            value: toNano(0.1),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(JettonMinter.Mint(receiver, jettonAmount)),
            }),
        });
    }

    // burn#595f07bc query_id:uint64 amount:(VarUInteger 16)
    //           response_destination:MsgAddress custom_payload:(Maybe ^Cell)
    //           = InternalMsgBody;
    async receiveBurn(subWalletOwner: Address, sourceWallet: Address, amount: BN) {
        if (!this.contract) {
            return;
        }
        let messageBody = new Cell();
        messageBody.bits.writeUint(OPS.Burn_notification, 32); // action
        messageBody.bits.writeUint(1, 64); // query-id
        messageBody.bits.writeCoins(amount); // jetton amount received
        messageBody.bits.writeAddress(sourceWallet);

        const removeLiquidityAmount = 300000;
        let customPayload = new Cell();
        customPayload.bits.writeUint(2, 32); // sub op for removing liquidty
        customPayload.bits.writeCoins(removeLiquidityAmount); // sub op for removing liquidty

        messageBody.refs.push(customPayload);

        let res = await this.contract.sendInternalMessage(
            new InternalMessage({
                from: subWalletOwner,
                to: this.address as Address,
                value: new BN(10000),
                bounce: false,
                body: new CommonMessageInfo({ body: new CellMessage(messageBody) }),
            }),
        );

        return res;
    }

    async getJettonData() {
        if (!this.contract) {
            return;
        }
        let data = await this.contract.invokeGetMethod("get_jetton_data", []);
        const rawAddress = data.result[2] as Slice;
        return {
            totalSupply: data.result[0] as BN,
            mintable: data.result[1] as BN,
            //adminAddress: sliceToAddress(rawAddress, true),
            content: data.result[3],
            jettonWalletCode: data.result[4],
        };
    }

    setUnixTime(time: number) {
        if (!this.contract) {
            return;
        }
        this.contract.setUnixTime(time);
    }

    static async createDeployData(totalSupply: BN, tokenAdmin: Address, content: string) {
        const jettonWalletCode = await serializeWalletCodeToCell();
        const initDataCell = await buildStateInit(totalSupply, tokenAdmin, content, jettonWalletCode[0]);
        const minterSources = await serializeMinterCodeToCell();
        return {
            codeCell: minterSources,
            initDataCell,
        };
    }

    static async Create(totalSupply: BN, tokenAdmin: Address, content: string, tvmBus?: TvmBus, balance = toNano("1")) {
        const jettonWalletCode = await serializeWalletCodeToCell();
        const stateInit = await buildStateInit(totalSupply, tokenAdmin, content, jettonWalletCode[0]);
        const cellCode = await CompileCodeToCell();

        let contract = await SmartContract.fromCell(cellCode[0], stateInit, {
            getMethodsMutate: true,
        });
        const myAddress = await contractAddress({
            workchain: 0,
            initialData: stateInit,
            initialCode: jettonWalletCode[0],
        });

        const instance = new JettonMinter(contract, myAddress, balance);
        if (tvmBus) {
            tvmBus.registerContract(instance);
        }
        return instance;
    }
}

// custom solution, using func to compile, and fift to serialize the code into a string
async function serializeWalletCodeToCell() {
    const jettonWalletCodeB64: string = compileFuncToB64(["test/jetton-wallet.fc"]);
    return Cell.fromBoc(jettonWalletCodeB64);
}

async function serializeMinterCodeToCell() {
    const jettonMinterCodeB64: string = compileFuncToB64(["test/jetton-minter.fc"]);
    return Cell.fromBoc(jettonMinterCodeB64);
}

async function CompileCodeToCell() {
    const ammMinterCodeB64: string = compileFuncToB64(["test/jetton-minter.fc"]);
    return Cell.fromBoc(ammMinterCodeB64);
}

async function buildStateInit(totalSupply: BN, admin: Address, contentUri: string, tokenCode: Cell) {
    let contentCell = beginCell()
        .storeInt(OFFCHAIN_CONTENT_PREFIX, 8)
        .storeBuffer(Buffer.from(contentUri, "ascii"))
        .endCell();

    let dataCell = new Cell();
    dataCell.bits.writeCoins(totalSupply);
    dataCell.bits.writeAddress(admin);
    dataCell.refs.push(contentCell);
    dataCell.refs.push(tokenCode);
    return dataCell;
}
