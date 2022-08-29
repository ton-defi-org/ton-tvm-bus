import BN from "bn.js";
import { expect } from "chai";
import { toNano } from "ton";
import { TvmBus } from "../src";
import { JettonMinter } from "./jetton-minter";
import { JettonWallet } from "./jetton-wallet";
import { Wallet } from "./wallet";

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

    // it("transfer jetton", async () => {
    //     const tvmBus = new TvmBus();
    //     const { usdcMinter, usdcWallet, deployWallet } = await createBaseContracts(tvmBus);
    //     const data = await usdcMinter.getData();
    //     expect((await usdcWallet.getData()).balance.toString()).eq(data?.totalSupply.toString());

    //     const joeWallet = await Wallet.Create(tvmBus, toNano(10), new BN(101), 10);

    //     const JettonWallet.Transfer(joeWallet, toNano(20), deployWallet.address, undefined);

    //     usdcWallet.transfer();
    // });
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

    let mintAmount = toNano(100);
    let mintMessage = await usdcMinter.mintMessage(deployerAddress, deployerAddress, mintAmount);

    let messageList = await tvmBus.broadcast(mintMessage);

    const data2 = await usdcMinter.getData();
    expect(data2?.totalSupply.toString()).eq(mintAmount.toString());

    const usdcWallet = messageList[1].contractImpl as JettonWallet;

    expect((await usdcWallet.getData()).balance.toString()).eq(mintAmount.toString());

    return {
        usdcMinter,
        usdcWallet,
        deployWallet,
    };
}
ç;
