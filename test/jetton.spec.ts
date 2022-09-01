import BN from "bn.js";
import { expect } from "chai";
import { toNano } from "ton";
import { TvmBus } from "../src";
import { JettonMinter } from "./jetton-minter";
import { JettonWallet } from "./jetton-wallet";
import { messageGenerator } from "./utils";
import { Wallet } from "./wallet";

const INITIAL_MINT = toNano(100);

describe("Ton Swap Bus Test Suite", () => {
    it("mint USDC", async () => {
        const tvmBus = new TvmBus();
        const { usdcMinter, usdcWallet } = await createBaseContracts(tvmBus);
        const data = await usdcMinter.getData();
        expect((await usdcWallet.getData()).balance.toString()).eq(data?.totalSupply.toString());
    });

    it("mint USDC twice", async () => {
        const tvmBus = new TvmBus();
        const { usdcMinter, usdcWallet, deployWallet } = await createBaseContracts(tvmBus);

        let mintMessage = await usdcMinter.mintMessage(deployWallet.address, deployWallet.address, toNano(7505));
        let res = await tvmBus.broadcast(mintMessage);

        const data = await usdcMinter.getData();

        expect((await usdcWallet.getData()).balance.toString()).eq(data?.totalSupply.toString());
    });

    it.only("transfer jetton", async () => {
        const tvmBus = new TvmBus();
        const { usdcMinter, usdcWallet, deployWallet } = await createBaseContracts(tvmBus);
        const data = await usdcMinter.getData();
        expect((await usdcWallet.getData()).balance.toString()).eq(data?.totalSupply.toString());

        const joeWallet = await Wallet.Create(tvmBus, toNano(10), new BN(101), 10);

        const jettonAmount = toNano(20);
        const msgBody = JettonWallet.Transfer(joeWallet.address, jettonAmount, deployWallet.address, undefined);

        const transferMessage = messageGenerator({
            from: deployWallet.address,
            to: usdcWallet.address,
            value: toNano("0.3"),
            body: msgBody,
        });

        let messagesLog = await tvmBus.broadcast(transferMessage);
        expect(messagesLog.length).eq(3);

        // Deployer Jetton Balance should be mint - sent jettons
        const deployerJettonData = await (messagesLog[0].contractImpl as JettonWallet).getData();
        expect(deployerJettonData.balance.toString()).eq(INITIAL_MINT.sub(jettonAmount).toString());

        const joesJettonData = await (messagesLog[1].contractImpl as JettonWallet).getData();
        expect(joesJettonData.balance.toString()).eq(jettonAmount.toString());

        // const ammMinterData = await (messagesLog[2].contractImpl as JettonWallet).getData();
        // expect(ammMinterData.tonReserves.toString()).toBe(tonLiquidity.toString());
    });
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
