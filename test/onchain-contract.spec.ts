import BN from "bn.js";
import { expect } from "chai";
import { Address, Cell, toNano, TonClient } from "ton";
import { printChain, TvmBus } from "../src";
import { OnChainContract } from "../src/onChainContract";
import { JettonMinter } from "./jetton-minter";
import { JettonWallet } from "./jetton-wallet";
import { cellFromString, messageGenerator } from "./utils";
import { Wallet } from "./wallet";

const INITIAL_MINT = toNano(100);

const client = new TonClient({
    endpoint: "https://scalable-api.tonwhales.com/jsonRPC",
});

describe("Tvm Bus on chain contracts Test Suite", () => {
    it.only("Swap ", async () => {
        const tvmBus = new TvmBus({
            client,
        });

        const myWallet = await OnChainContract.Create(
            client,
            Address.parse("EQDjhy1Ig-S0vKCWwd3XZRKODGx0RJyhqW37ZDMl-pgv8iBr"),
            tvmBus,
        );
        // console.log(myWallet);

        const ammPool = Address.parse("EQBVyErgx7BCboNXOx0CwA9KYuLY4kXMHanURAGvMWeO-VCE");
        const msg = messageGenerator({
            to: ammPool,
            from: myWallet.address,
            body: cellFromString("000000190000000000000001405F5E1006168322CDFD2E"),
            value: toNano("0.19"),
        });
        let messageList = await tvmBus.broadcast(msg);
        printChain(messageList);

        // const { usdcMinter, usdcWallet } = await createBaseContracts(tvmBus);
        // const data = await usdcMinter.getData();
        // expect((await usdcWallet.getData()).balance.toString()).eq(data?.totalSupply.toString());
    }).timeout(5000);
});

async function createBaseContracts(tvmBus: TvmBus) {
    const deployWallet = await Wallet.Create(tvmBus, toNano(10), new BN(101), 0); // address EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI
    const deployerAddress = deployWallet.address;

    const usdcMinter = await JettonMinter.Create(
        new BN(0),
        deployerAddress,
        "https://ipfs.io/ipfs/dasadas",
        tvmBus,
        toNano("0.2"),
    );
    const data = await usdcMinter.getData();
    expect(data?.totalSupply.toString()).eq("0");
    tvmBus.registerCode(JettonWallet);

    let mintMessage = await usdcMinter.mintMessage(deployerAddress, deployerAddress, INITIAL_MINT);
    let messageList = await tvmBus.broadcast(mintMessage);

    const data2 = await usdcMinter.getData();
    expect(data2?.totalSupply.toString()).eq(INITIAL_MINT.toString());

    const usdcWallet = messageList[1].contractImpl as JettonWallet;

    expect((await usdcWallet.getData()).balance.toString()).eq(INITIAL_MINT.toString());

    return {
        usdcMinter,
        usdcWallet,
        deployWallet,
    };
}
