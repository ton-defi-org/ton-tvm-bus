import BN from "bn.js";
import { expect } from "chai";
import { Address, Cell, parseMessage, RawCurrencyCollection, StateInit, toNano, TonClient } from "ton";
import { printChain, TvmBus } from "../src";
import { OnChainContract } from "../src/onChainContract";
import { cellFromString, messageGenerator } from "../src/utils";

const INITIAL_MINT = toNano(100);

const client = new TonClient({
    endpoint: "https://scalable-api.tonwhales.com/jsonRPC",
});

type RawCommonMessageInfoInternal = {
    type: "internal";
    ihrDisabled: boolean;
    bounce: boolean;
    bounced: boolean;
    src: Address | null;
    dest: Address | null;
    value: RawCurrencyCollection;
    ihrFee: BN;
    fwdFee: BN;
    createdLt: BN;
    createdAt: number;
};

describe("Tvm Bus on chain contracts Test Suite", () => {
    it("deploy jetton with forkNetwork enabled", async () => {
        const DEPLOY_JETTON =
            "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";

        const externalMessage = parseMessage(Cell.fromBoc(Buffer.from(DEPLOY_JETTON, "base64"))[0].beginParse());

        let message = externalMessage.body.refs[0];
        //console.log("messgage", message);

        if (!message) {
            throw 1;
        }
        let slice = message.beginParse();
        console.log(slice);

        let innerMessage = parseMessage(slice);
        const innerInfo = innerMessage.info as RawCommonMessageInfoInternal;

        const tvmBus = new TvmBus({
            client,
        });
        let stateInit = undefined;
        if (innerMessage.init) {
            stateInit = new StateInit({
                code: innerMessage.init.code,
                data: innerMessage.init.data,
            });
        }
        const msg = messageGenerator({
            to: innerInfo.dest as Address,
            from: externalMessage.info.dest as Address,
            body: innerMessage.body,
            stateInit: stateInit,
            value: toNano("0.19"),
        });

        let messageList = await tvmBus.broadcast(msg);
        console.log("messageList.length", messageList.length);

        printChain(messageList, "deploy new contract with onchain enabled");

        expect(tvmBus.pool.size).eq(3);
    }).timeout(10000);

    it("Should exit gracefully when contract is not deployed", async () => {
        const tvmBus = new TvmBus({
            client,
        });

        const contractDoesntExists = await OnChainContract.Create(
            client,
            Address.parse("EQAVvGGS_aAsSluqqlDUcbFzMWluIDxmLVrNs7vBy8MElxns"),
            tvmBus,
        );

        expect(tvmBus.pool.size).eq(0);
    });

    it("Fork Contact from main net, and run a swap transaction", async () => {
        const tvmBus = new TvmBus({
            client,
        });

        const myWallet = await OnChainContract.Create(
            client,
            Address.parse("EQDjhy1Ig-S0vKCWwd3XZRKODGx0RJyhqW37ZDMl-pgv8iBr"),
            tvmBus,
        );
        if (!myWallet) {
            throw "wallet should be initialized";
            return;
        }
        // console.log(myWallet);

        const ammPool = Address.parse("EQBVyErgx7BCboNXOx0CwA9KYuLY4kXMHanURAGvMWeO-VCE");
        const msg = messageGenerator({
            to: ammPool,
            from: myWallet.address,
            body: cellFromString("000000190000000000000001405F5E1006168322CDFD2E"),
            value: toNano("0.19"),
        });
        let messageList = await tvmBus.broadcast(msg);
        printChain(messageList, "Fork Contact from main net, and run a swap transaction");

        // const { usdcMinter, usdcWallet } = await createBaseContracts(tvmBus);
        // const data = await usdcMinter.getData();
        // expect((await usdcWallet.getData()).balance.toString()).eq(data?.totalSupply.toString());

        expect(messageList.length).eq(4);
        expect(tvmBus.pool.size).eq(4);
    }).timeout(10000);
});

// async function createBaseContracts(tvmBus: TvmBus) {
//     const deployWallet = await Wallet.Create(tvmBus, toNano(10), new BN(101), 0); // address EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI
//     const deployerAddress = deployWallet.address;

//     const usdcMinter = await JettonMinter.Create(
//         new BN(0),
//         deployerAddress,
//         "https://ipfs.io/ipfs/dasadas",
//         tvmBus,
//         toNano("0.2"),
//     );
//     const data = await usdcMinter.getData();
//     expect(data?.totalSupply.toString()).eq("0");
//     tvmBus.registerCode(JettonWallet);

//     let mintMessage = await usdcMinter.mintMessage(deployerAddress, deployerAddress, INITIAL_MINT);
//     let messageList = await tvmBus.broadcast(mintMessage);

//     const data2 = await usdcMinter.getData();
//     expect(data2?.totalSupply.toString()).eq(INITIAL_MINT.toString());

//     const usdcWallet = messageList[1].contractImpl as JettonWallet;

//     expect((await usdcWallet.getData()).balance.toString()).eq(INITIAL_MINT.toString());

//     return {
//         usdcMinter,
//         usdcWallet,
//         deployWallet,
//     };
// }
